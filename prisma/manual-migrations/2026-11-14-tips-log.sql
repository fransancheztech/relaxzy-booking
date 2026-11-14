-- A log of every change to tips, so an edited or deleted tip can always be traced.
--
-- Today an edit overwrites a tip's amount, method or notes for good, and a deletion only leaves
-- deleted_at: there is no way to see what a tip was before, or who changed it. Tips are money
-- handed to the therapists, and the 2026-10 duplicated-tip incident was exactly this kind of
-- change. From now on every change is kept in a new table, tips_log.
--
-- SAME SHAPE AS guidelines_log and payments_log: each row keeps the tip BEFORE the change
-- (old_data) and AFTER it (new_data) as JSON, plus when (changed_at) and who (changed_by).
--   * INSERT → new_data only; UPDATE → both; DELETE → old_data only. Deleting a tip in the app is
--     an UPDATE that sets deleted_at, so it is logged with the tip as it was.
--   * An UPDATE that changes nothing is not logged.
--   * transaction_id groups the rows written by one save (e.g. several tips changed at once).
--   * changed_by comes from the app.user_id setting, as for payments, vouchers and guidelines.
--     The tip routes don't set it yet: until that code change, rows are logged with
--     changed_by = NULL.
--   * No foreign key to tips: the log must outlive the tip.
--
-- Same protection as the other app-only tables: RLS on with no policies, no access for
-- anon/authenticated. Only the app (through Prisma, as postgres) reads or writes it.
--
-- Run each STEP on its own and compare with the expected result.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new table → new Prisma model).


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Precondition (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: log_table = NULL (not applied yet), existing_triggers = 0, tips = 147 or more.
SELECT to_regclass('public.tips_log') AS log_table,
       (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = 'public.tips'::regclass AND NOT tgisinternal) AS existing_triggers,
       (SELECT count(*) FROM public.tips) AS tips;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.tips_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id          uuid        NOT NULL,
  change_type     change_type NOT NULL,
  old_data        jsonb,
  new_data        jsonb,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      uuid,
  transaction_id  bigint      NOT NULL DEFAULT txid_current()
);

COMMENT ON TABLE public.tips_log IS
  'Every change to tips: the tip before (old_data) and after (new_data).';
COMMENT ON COLUMN public.tips_log.transaction_id IS
  'Same value for every row written by one save.';

CREATE INDEX tips_log_tip_idx ON public.tips_log (tip_id, changed_at DESC);

ALTER TABLE public.tips_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tips_log FROM anon, authenticated;

CREATE FUNCTION public.log_tip_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  -- An update that leaves the tip exactly as it was isn't a change.
  IF TG_OP = 'UPDATE' AND v_old = v_new THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.tips_log (tip_id, change_type, old_data, new_data, changed_by)
  VALUES (
    (coalesce(v_new, v_old)->>'id')::uuid,
    TG_OP::change_type,
    v_old,
    v_new,
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_tip_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_log_tips_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.tips
  FOR EACH ROW EXECUTE FUNCTION public.log_tip_changes();

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Test (changes nothing: every test change is undone before it ends)
-- ─────────────────────────────────────────────────────────────────────────────
-- On one existing tip, inside a block that is always rolled back, this tries: an update that
-- changes nothing (must log nothing), an amount edit and a deletion as the app does it (each must
-- log one row), and adding a copy of the tip and removing it for good (one row each), all with the
-- test user as changed_by.
--
-- Expect: "Success. No rows returned" (the editor may also show the notice "TEST PASSED").
-- An error starting with "TEST FAILED" means the log doesn't work as described: don't continue,
-- and use UNDO below. Either way, no tip or log row is left changed.
DO $$
DECLARE
  v_tip      public.tips%ROWTYPE;
  v_copy_id  uuid;
  v_noop     int;
  v_rows     int;
  v_edit     int;
  v_deleted  int;
  v_added    int;
  v_removed  int;
  v_owner_ok boolean;
BEGIN
  SELECT * INTO v_tip FROM public.tips WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST FAILED: there is no active tip to test with.';
  END IF;

  BEGIN
    PERFORM set_config('app.user_id', '00000000-0000-0000-0000-000000000001', true);

    -- An update that changes nothing.
    UPDATE public.tips SET amount = amount WHERE id = v_tip.id;
    SELECT count(*) INTO v_noop FROM public.tips_log WHERE transaction_id = txid_current();

    -- Amount edit, then a deletion the way the app does it.
    UPDATE public.tips SET amount = amount + 1 WHERE id = v_tip.id;
    UPDATE public.tips SET deleted_at = now() WHERE id = v_tip.id;

    -- A new tip, then removed for good.
    INSERT INTO public.tips (therapist_id, booking_id, amount, payment_method, iva_applies, notes)
    VALUES (v_tip.therapist_id, v_tip.booking_id, v_tip.amount, v_tip.payment_method, v_tip.iva_applies, 'test')
    RETURNING id INTO v_copy_id;
    DELETE FROM public.tips WHERE id = v_copy_id;

    SELECT count(*),
           count(*) FILTER (WHERE tip_id = v_tip.id AND change_type = 'UPDATE'
                              AND (old_data->>'amount')::numeric = v_tip.amount
                              AND (new_data->>'amount')::numeric = v_tip.amount + 1
                              AND new_data->>'deleted_at' IS NULL),
           count(*) FILTER (WHERE tip_id = v_tip.id AND change_type = 'UPDATE'
                              AND old_data->>'deleted_at' IS NULL
                              AND new_data->>'deleted_at' IS NOT NULL),
           count(*) FILTER (WHERE tip_id = v_copy_id AND change_type = 'INSERT'
                              AND old_data IS NULL AND new_data->>'notes' = 'test'),
           count(*) FILTER (WHERE tip_id = v_copy_id AND change_type = 'DELETE'
                              AND new_data IS NULL AND old_data->>'notes' = 'test'),
           coalesce(bool_and(changed_by = '00000000-0000-0000-0000-000000000001'), false)
      INTO v_rows, v_edit, v_deleted, v_added, v_removed, v_owner_ok
      FROM public.tips_log
     WHERE transaction_id = txid_current();

    -- Undo every change made in this block (the counts above are kept).
    RAISE EXCEPTION USING ERRCODE = 'TSTRB', MESSAGE = 'undo the test changes';
  EXCEPTION WHEN SQLSTATE 'TSTRB' THEN
    NULL;
  END;

  IF v_noop <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: an update that changed nothing was logged (% rows).', v_noop;
  END IF;
  IF v_rows <> 4 OR v_edit <> 1 OR v_deleted <> 1 OR v_added <> 1 OR v_removed <> 1 OR NOT v_owner_ok THEN
    RAISE EXCEPTION 'TEST FAILED: rows = % (expected 4); amount edit = %, deletion = %, added = %, removed = % (expected 1 each); user recorded = %.',
      v_rows, v_edit, v_deleted, v_added, v_removed, v_owner_ok;
  END IF;

  RAISE NOTICE 'TEST PASSED: every change was logged, and the test left nothing behind.';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: log_table = true, log_rows = 0 (more only if someone saved a tip since STEP 1),
-- triggers = 1, rls_on = true, anon_can_read = false, authenticated_can_read = false.
SELECT to_regclass('public.tips_log') IS NOT NULL                              AS log_table,
       (SELECT count(*) FROM public.tips_log)                                  AS log_rows,
       (SELECT count(*) FROM pg_trigger
         WHERE tgname = 'trigger_log_tips_changes' AND NOT tgisinternal)       AS triggers,
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tips_log'::regclass) AS rls_on,
       has_table_privilege('anon', 'public.tips_log', 'SELECT')                AS anon_can_read,
       has_table_privilege('authenticated', 'public.tips_log', 'SELECT')       AS authenticated_can_read;


-- ─────────────────────────────────────────────────────────────────────────────
-- UNDO (only if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes the log and everything recorded in it. The tips themselves are not touched.
-- BEGIN;
-- DROP TRIGGER trigger_log_tips_changes ON public.tips;
-- DROP FUNCTION public.log_tip_changes();
-- DROP TABLE public.tips_log;
-- COMMIT;
