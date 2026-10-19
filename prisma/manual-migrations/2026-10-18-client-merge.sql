-- Client merge: fold duplicate client records into one, with an exact undo.
--
-- Part 3 of the duplicate-client work (plans/2026-10-18-phone-normalization.md). 125 phone
-- numbers are still shared by 2-4 client rows (Emilio x3, Bruno x2, …). Normalisation stopped NEW
-- duplicates; this folds the existing ones together.
--
-- What a merge has to move. Checked against the live database, not just the Prisma schema:
--   bookings.client_id            — the only one with a real foreign key
--   vouchers.buyer_id             — NO foreign key: nothing would stop a dangling reference
--   vouchers.recipient_id         — NO foreign key
--   voucher_uses.recipient_id     — NO foreign key
-- Payments and tips hang off the booking, so they follow it. History tables and the
-- bookings_with_details view are left alone: history records what was true at the time.
--
-- Why a merge log (client_merges): bookings_history and clients_history have no actor or
-- timestamp columns, so without it a merge would be anonymous and practically irreversible. The
-- log records exactly which rows moved and from whom, which is what makes unmerge_clients()
-- exact rather than a best guess — the safety net for merging two different people by mistake
-- (e.g. a couple sharing one phone).
--
-- Both functions are SECURITY INVOKER and NOT callable through Supabase's public REST API: the
-- app calls them through Prisma (the postgres role), like register_payment_event. EXECUTE is
-- revoked from PUBLIC, anon and authenticated, and the log table has RLS on with no policies.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new table → new Prisma model).
-- Installing changes no data. Merging is done separately (see 2026-10-18-merge-test-emilio.sql).


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Preconditions (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect all three NULL. If any is not, this file has already been applied.
SELECT to_regclass('public.client_merges')                               AS log_table,
       to_regprocedure('public.merge_clients(uuid,uuid[],jsonb,uuid)')   AS merge_fn,
       to_regprocedure('public.unmerge_clients(uuid,uuid)')              AS unmerge_fn;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.client_merges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id      uuid        NOT NULL REFERENCES public.clients (id),
  loser_ids        uuid[]      NOT NULL,
  -- {"bookings": [{"id": …, "from": …}], "voucher_buyers": […], "voucher_recipients": […],
  --  "voucher_use_recipients": […]} — every row that was re-pointed, and its previous client.
  moved            jsonb       NOT NULL,
  survivor_before  jsonb       NOT NULL,
  survivor_after   jsonb       NOT NULL,
  losers_before    jsonb       NOT NULL,
  merged_by        uuid,
  merged_at        timestamptz NOT NULL DEFAULT now(),
  undone_by        uuid,
  undone_at        timestamptz
);

CREATE INDEX client_merges_survivor_idx ON public.client_merges (survivor_id);
CREATE INDEX client_merges_loser_ids_idx ON public.client_merges USING gin (loser_ids);

ALTER TABLE public.client_merges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_merges FROM anon, authenticated;


-- merge_clients(survivor, losers, details, actor) → merge id
--
-- p_details: optional final values for the kept client, applied AFTER the losers are retired so a
-- phone or email can move from a loser to the survivor without tripping the unique indexes. Only
-- the keys present are applied: client_name (cannot be blanked), client_surname, client_email,
-- client_phone (must already be E.164 — the app canonicalises it), client_notes.
-- Raises a stable code on misuse: MERGE_NO_LOSERS, MERGE_SURVIVOR_IN_LOSERS,
-- MERGE_DUPLICATE_LOSERS, MERGE_SURVIVOR_NOT_FOUND, MERGE_LOSER_NOT_FOUND, MERGE_PHONE_NOT_E164.
CREATE OR REPLACE FUNCTION public.merge_clients(
  p_survivor_id uuid,
  p_loser_ids   uuid[],
  p_details     jsonb DEFAULT '{}'::jsonb,
  p_actor       uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_merge_id        uuid := gen_random_uuid();
  v_details         jsonb := coalesce(p_details, '{}'::jsonb);
  v_phone           text  := v_details->>'client_phone';
  v_survivor_before jsonb;
  v_survivor_after  jsonb;
  v_losers_before   jsonb;
  v_bookings        jsonb;
  v_voucher_buyers  jsonb;
  v_voucher_recips  jsonb;
  v_use_recips      jsonb;
  v_active_losers   int;
BEGIN
  IF p_loser_ids IS NULL OR cardinality(p_loser_ids) = 0 THEN
    RAISE EXCEPTION 'MERGE_NO_LOSERS';
  END IF;
  IF p_survivor_id = ANY (p_loser_ids) THEN
    RAISE EXCEPTION 'MERGE_SURVIVOR_IN_LOSERS';
  END IF;
  IF cardinality(p_loser_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_loser_ids) AS x) THEN
    RAISE EXCEPTION 'MERGE_DUPLICATE_LOSERS';
  END IF;

  -- Lock every client involved, so a concurrent edit can't interleave with the merge.
  PERFORM 1 FROM clients WHERE id = p_survivor_id OR id = ANY (p_loser_ids) FOR UPDATE;

  SELECT to_jsonb(c) INTO v_survivor_before
    FROM clients c WHERE c.id = p_survivor_id AND c.deleted_at IS NULL;
  IF v_survivor_before IS NULL THEN
    RAISE EXCEPTION 'MERGE_SURVIVOR_NOT_FOUND';
  END IF;

  SELECT count(*) INTO v_active_losers
    FROM clients WHERE id = ANY (p_loser_ids) AND deleted_at IS NULL;
  IF v_active_losers <> cardinality(p_loser_ids) THEN
    RAISE EXCEPTION 'MERGE_LOSER_NOT_FOUND';
  END IF;

  IF v_details ? 'client_phone' AND v_phone IS NOT NULL AND v_phone !~ '^[+][1-9][0-9]{6,14}$' THEN
    RAISE EXCEPTION 'MERGE_PHONE_NOT_E164';
  END IF;

  SELECT jsonb_agg(to_jsonb(c)) INTO v_losers_before FROM clients c WHERE c.id = ANY (p_loser_ids);

  -- Attributes the vouchers_history / voucher_uses_history rows the triggers write below.
  PERFORM set_config('app.user_id', coalesce(p_actor::text, ''), true);

  -- Re-point every reference, recording each row and the client it came from. Soft-deleted
  -- bookings and vouchers are included: one left on a retired client would bring that client's
  -- name back if it were ever restored.
  WITH moved AS (
    UPDATE bookings t SET client_id = p_survivor_id
      FROM (SELECT id, client_id AS from_id FROM bookings WHERE client_id = ANY (p_loser_ids)) src
     WHERE t.id = src.id
    RETURNING t.id, src.from_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'from', from_id)), '[]'::jsonb)
    INTO v_bookings FROM moved;

  WITH moved AS (
    UPDATE vouchers t SET buyer_id = p_survivor_id
      FROM (SELECT id, buyer_id AS from_id FROM vouchers WHERE buyer_id = ANY (p_loser_ids)) src
     WHERE t.id = src.id
    RETURNING t.id, src.from_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'from', from_id)), '[]'::jsonb)
    INTO v_voucher_buyers FROM moved;

  WITH moved AS (
    UPDATE vouchers t SET recipient_id = p_survivor_id
      FROM (SELECT id, recipient_id AS from_id FROM vouchers WHERE recipient_id = ANY (p_loser_ids)) src
     WHERE t.id = src.id
    RETURNING t.id, src.from_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'from', from_id)), '[]'::jsonb)
    INTO v_voucher_recips FROM moved;

  WITH moved AS (
    UPDATE voucher_uses t SET recipient_id = p_survivor_id
      FROM (SELECT id, recipient_id AS from_id FROM voucher_uses WHERE recipient_id = ANY (p_loser_ids)) src
     WHERE t.id = src.id
    RETURNING t.id, src.from_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'from', from_id)), '[]'::jsonb)
    INTO v_use_recips FROM moved;

  -- Retire the losers BEFORE applying the survivor's details: phone and email are unique among
  -- active clients, so a value moving from a loser to the survivor must be released first.
  UPDATE clients SET deleted_at = now() WHERE id = ANY (p_loser_ids);

  UPDATE clients SET
    client_name    = CASE WHEN v_details ? 'client_name'
                          THEN coalesce(nullif(btrim(v_details->>'client_name'), ''), client_name)
                          ELSE client_name END,
    client_surname = CASE WHEN v_details ? 'client_surname'
                          THEN nullif(btrim(v_details->>'client_surname'), '') ELSE client_surname END,
    client_email   = CASE WHEN v_details ? 'client_email'
                          THEN nullif(btrim(v_details->>'client_email'), '') ELSE client_email END,
    client_phone   = CASE WHEN v_details ? 'client_phone'
                          THEN nullif(btrim(v_phone), '') ELSE client_phone END,
    client_notes   = CASE WHEN v_details ? 'client_notes'
                          THEN nullif(btrim(v_details->>'client_notes'), '') ELSE client_notes END,
    updated_at     = now()
  WHERE id = p_survivor_id;

  SELECT to_jsonb(c) INTO v_survivor_after FROM clients c WHERE c.id = p_survivor_id;

  INSERT INTO client_merges
    (id, survivor_id, loser_ids, moved, survivor_before, survivor_after, losers_before, merged_by)
  VALUES
    (v_merge_id, p_survivor_id, p_loser_ids,
     jsonb_build_object(
       'bookings',               v_bookings,
       'voucher_buyers',         v_voucher_buyers,
       'voucher_recipients',     v_voucher_recips,
       'voucher_use_recipients', v_use_recips),
     v_survivor_before, v_survivor_after, v_losers_before, p_actor);

  RETURN v_merge_id;
END;
$$;


-- unmerge_clients(merge id, actor)
--
-- Reverses one merge exactly: the survivor's fields go back (only those not edited since the
-- merge), the losers come back, and exactly the rows that moved go back to the client they came
-- from — only if they still point at the survivor. Bookings created for the survivor after the
-- merge stay with it. Raises UNMERGE_NOT_FOUND, UNMERGE_ALREADY_UNDONE, or
-- UNMERGE_SURVIVOR_MERGED_AWAY (the survivor was itself merged into someone else since: undo that
-- merge first).
CREATE OR REPLACE FUNCTION public.unmerge_clients(
  p_merge_id uuid,
  p_actor    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m client_merges%ROWTYPE;
  b jsonb;
  a jsonb;
BEGIN
  SELECT * INTO m FROM client_merges WHERE id = p_merge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNMERGE_NOT_FOUND';
  END IF;
  IF m.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'UNMERGE_ALREADY_UNDONE';
  END IF;

  PERFORM 1 FROM clients WHERE id = m.survivor_id OR id = ANY (m.loser_ids) FOR UPDATE;

  IF EXISTS (SELECT 1 FROM clients WHERE id = m.survivor_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'UNMERGE_SURVIVOR_MERGED_AWAY';
  END IF;

  PERFORM set_config('app.user_id', coalesce(p_actor::text, ''), true);
  b := m.survivor_before;
  a := m.survivor_after;

  -- 1) The survivor's own fields first, so a phone or email that came from a loser is released
  --    before that loser returns. A field edited since the merge is kept, not overwritten.
  UPDATE clients SET
    client_name    = CASE WHEN client_name    IS NOT DISTINCT FROM a->>'client_name'    THEN b->>'client_name'    ELSE client_name    END,
    client_surname = CASE WHEN client_surname IS NOT DISTINCT FROM a->>'client_surname' THEN b->>'client_surname' ELSE client_surname END,
    client_email   = CASE WHEN client_email   IS NOT DISTINCT FROM a->>'client_email'   THEN b->>'client_email'   ELSE client_email   END,
    client_phone   = CASE WHEN client_phone   IS NOT DISTINCT FROM a->>'client_phone'   THEN b->>'client_phone'   ELSE client_phone   END,
    client_notes   = CASE WHEN client_notes   IS NOT DISTINCT FROM a->>'client_notes'   THEN b->>'client_notes'   ELSE client_notes   END,
    updated_at     = now()
  WHERE id = m.survivor_id;

  -- 2) The losers come back.
  UPDATE clients SET deleted_at = NULL WHERE id = ANY (m.loser_ids);

  -- 3) Exactly the rows that moved go back — only those still pointing at the survivor.
  UPDATE bookings t SET client_id = (x->>'from')::uuid
    FROM jsonb_array_elements(m.moved->'bookings') x
   WHERE t.id = (x->>'id')::uuid AND t.client_id = m.survivor_id;

  UPDATE vouchers t SET buyer_id = (x->>'from')::uuid
    FROM jsonb_array_elements(m.moved->'voucher_buyers') x
   WHERE t.id = (x->>'id')::uuid AND t.buyer_id = m.survivor_id;

  UPDATE vouchers t SET recipient_id = (x->>'from')::uuid
    FROM jsonb_array_elements(m.moved->'voucher_recipients') x
   WHERE t.id = (x->>'id')::uuid AND t.recipient_id = m.survivor_id;

  UPDATE voucher_uses t SET recipient_id = (x->>'from')::uuid
    FROM jsonb_array_elements(m.moved->'voucher_use_recipients') x
   WHERE t.id = (x->>'id')::uuid AND t.recipient_id = m.survivor_id;

  UPDATE client_merges SET undone_at = now(), undone_by = p_actor WHERE id = p_merge_id;
END;
$$;

-- Not reachable through Supabase's public REST API: only the app (via Prisma) may merge.
REVOKE ALL ON FUNCTION public.merge_clients(uuid, uuid[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unmerge_clients(uuid, uuid)              FROM PUBLIC, anon, authenticated;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: log_table and both functions present; anon_can_merge and anon_can_unmerge = false.
SELECT to_regclass('public.client_merges')                                              AS log_table,
       to_regprocedure('public.merge_clients(uuid,uuid[],jsonb,uuid)')                  AS merge_fn,
       to_regprocedure('public.unmerge_clients(uuid,uuid)')                             AS unmerge_fn,
       has_function_privilege('anon', 'public.merge_clients(uuid,uuid[],jsonb,uuid)', 'EXECUTE') AS anon_can_merge,
       has_function_privilege('anon', 'public.unmerge_clients(uuid,uuid)', 'EXECUTE')            AS anon_can_unmerge;
