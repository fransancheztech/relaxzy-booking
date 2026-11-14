-- Fix the *_history tables: record emptied fields correctly, and record when and who.
--
-- THE PROBLEMS
--   1. Every history trigger writes COALESCE(NEW.x, OLD.x) for each column. When a save empties a
--      field (NEW.x is NULL), the history row gets the OLD value instead, so the history shows the
--      field as never emptied. Today: 9 clients with their phone removed and 7 with their surname
--      removed, 5 bookings with their therapist removed and 3 vouchers with their notes deleted
--      all show the old value. Undoing a deletion would also be recorded as still deleted.
--      Affects all 8 triggers: bookings, clients, therapists, the three services tables, vouchers
--      and voucher_uses.
--   2. bookings_history, clients_history, therapists_history and the three services history tables
--      have no changed_at or changed_by: a change can't be dated or attributed.
--   3. log_booking_changes never copies booking_group_id: bookings_history.booking_group_id is NULL
--      in all 31,663 rows, although 1,139 bookings belong to a group.
--
-- WHAT THIS DOES
--   * Adds changed_at and changed_by to the 6 tables without them. Existing rows keep NULL in both
--     (unknown): the default is set after the column is added, so only new rows get now().
--   * Rewrites the 8 trigger functions to copy the row as it is after the change (OLD for a
--     DELETE), with booking_group_id for bookings, and to fill changed_at/changed_by the same way
--     vouchers_history already does (app.user_id, else auth.uid()).
--   * Nothing else changes: same tables, same columns, same triggers, same security (the functions
--     stay SECURITY INVOKER, owned by postgres). Existing history rows are not modified.
--
-- Run each STEP on its own and compare with the expected result.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new columns on 6 models).


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Precondition (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: tables_with_changed_at = 0, functions_with_coalesce = 8.
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'changed_at'
           AND table_name IN ('bookings_history', 'clients_history', 'therapists_history',
                              'services_details_history', 'services_durations_history',
                              'services_names_history')) AS tables_with_changed_at,
       (SELECT count(*) FROM pg_proc
         WHERE pronamespace = 'public'::regnamespace
           AND proname IN ('log_booking_changes', 'log_client_changes', 'log_therapist_changes',
                           'log_services_details_changes', 'log_services_durations_changes',
                           'log_services_names_changes', 'log_voucher_changes', 'log_voucher_uses_changes')
           AND strpos(lower(pg_get_functiondef(oid)), 'coalesce(new.') > 0) AS functions_with_coalesce;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- 1. When and who. Added without a default first, so existing rows stay NULL (unknown).
ALTER TABLE public.bookings_history           ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;
ALTER TABLE public.clients_history            ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;
ALTER TABLE public.therapists_history         ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;
ALTER TABLE public.services_details_history   ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;
ALTER TABLE public.services_durations_history ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;
ALTER TABLE public.services_names_history     ADD COLUMN changed_at timestamptz, ADD COLUMN changed_by uuid;

ALTER TABLE public.bookings_history           ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.clients_history            ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.therapists_history         ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.services_details_history   ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.services_durations_history ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.services_names_history     ALTER COLUMN changed_at SET DEFAULT now();

-- 2. The trigger functions. Each copies r: the row after the change, or the deleted row.

CREATE OR REPLACE FUNCTION public.log_booking_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.bookings%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.bookings_history (
    id, booking_id, client_id, therapist_id, start_time, end_time,
    service_id, notes, status, created_at, updated_at, price,
    deleted_at, change_type, therapist_requested, booking_group_id, changed_at, changed_by
  )
  VALUES (
    gen_random_uuid(), r.id, r.client_id, r.therapist_id, r.start_time, r.end_time,
    r.service_id, r.notes, r.status, r.created_at, r.updated_at, r.price,
    r.deleted_at, TG_OP::change_type, r.therapist_requested, r.booking_group_id, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_client_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.clients%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.clients_history (
    client_id, client_name, client_surname, client_email, client_phone, client_notes,
    created_at, updated_at, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    r.id, r.client_name, r.client_surname, r.client_email, r.client_phone, r.client_notes,
    r.created_at, r.updated_at, r.deleted_at, TG_OP::public.change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_therapist_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.therapists%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.therapists_history (
    therapist_id, nickname, name, surname, email, phone, notes, active, off_days,
    created_at, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    r.id, r.nickname, r.name, r.surname, r.email, r.phone, r.notes, r.active, r.off_days,
    r.created_at, r.deleted_at, TG_OP::public.change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_services_details_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.services_details%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.services_details_history (
    service_details_id, service_name_id, service_duration_id, price, notes,
    created_at, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    r.id, r.service_name_id, r.service_duration_id, r.price, r.notes,
    r.created_at, r.deleted_at, TG_OP::public.change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_services_durations_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.services_durations%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.services_durations_history (
    service_duration_id, duration, notes, created_at, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    r.id, r.duration, r.notes, r.created_at, r.deleted_at, TG_OP::public.change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_services_names_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.services_names%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.services_names_history (
    service_name_id, name, short_name, notes, created_at, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    r.id, r.name, r.short_name, r.notes, r.created_at, r.deleted_at, TG_OP::public.change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_voucher_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.vouchers%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.vouchers_history (
    id, voucher_id, buyer_id, recipient_id, code, balance, notes, source, external_reference,
    created_at, updated_at, expiration_date, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    gen_random_uuid(), r.id, r.buyer_id, r.recipient_id, r.code, r.balance, r.notes, r.source,
    r.external_reference, r.created_at, r.updated_at, r.expiration_date, r.deleted_at,
    TG_OP::change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_voucher_uses_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r public.voucher_uses%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  INSERT INTO public.voucher_uses_history (
    id, voucher_event_id, voucher_id, booking_id, recipient_id, amount, notes, code,
    created_at, updated_at, performed_by, deleted_at, change_type, changed_at, changed_by
  )
  VALUES (
    gen_random_uuid(), r.id, r.voucher_id, r.booking_id, r.recipient_id, r.amount, r.notes, r.code,
    r.created_at, r.updated_at, r.performed_by, r.deleted_at, TG_OP::change_type, now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );
  RETURN NULL;
END;
$$;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Test (changes nothing: every test change is undone before it ends)
-- ─────────────────────────────────────────────────────────────────────────────
-- Inside a block that is always rolled back, on one row of each of the 8 tables: sets its notes to
-- "[test]", then empties them. The last history row must show the notes EMPTY (before this fix it
-- showed "[test]"), with changed_at and the test user as changed_by. On a booking with a group it
-- also checks booking_group_id. A service name is added and removed for good, to check that
-- INSERT and DELETE are recorded too.
--
-- Expect: "Success. No rows returned" (the editor may also show the notice "TEST PASSED").
-- An error starting with "TEST FAILED" lists what didn't work: don't rely on the fix, and ask
-- for the file to be reviewed. Either way, nothing is left changed.
DO $$
DECLARE
  spec       record;
  v_id       uuid;
  v_group    uuid;
  v_set      int;
  v_emptied  int;
  v_owner_ok boolean;
  v_failures text := '';
  v_skipped  text := '';
  v_test     constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  BEGIN
    PERFORM set_config('app.user_id', v_test::text, true);

    FOR spec IN
      SELECT * FROM (VALUES
        ('bookings',           'bookings_history',           'booking_id',          'notes'),
        ('clients',            'clients_history',            'client_id',           'client_notes'),
        ('therapists',         'therapists_history',         'therapist_id',        'notes'),
        ('services_details',   'services_details_history',   'service_details_id',  'notes'),
        ('services_durations', 'services_durations_history', 'service_duration_id', 'notes'),
        ('services_names',     'services_names_history',     'service_name_id',     'notes'),
        ('vouchers',           'vouchers_history',           'voucher_id',          'notes'),
        ('voucher_uses',       'voucher_uses_history',       'voucher_event_id',    'notes')
      ) AS s(tbl, hist, key, col)
    LOOP
      -- An active row (it passes every current check). For bookings, one in a group if there is
      -- one, so booking_group_id is checked too.
      IF spec.tbl = 'bookings' THEN
        SELECT id, booking_group_id INTO v_id, v_group FROM public.bookings
         WHERE deleted_at IS NULL ORDER BY (booking_group_id IS NULL), created_at LIMIT 1;
      ELSE
        EXECUTE format('SELECT id FROM public.%I WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1', spec.tbl)
          INTO v_id;
      END IF;
      IF v_id IS NULL THEN
        v_skipped := v_skipped || spec.tbl || ' (no rows) ';
        CONTINUE;
      END IF;

      EXECUTE format('UPDATE public.%I SET %I = %L WHERE id = $1', spec.tbl, spec.col, '[test]') USING v_id;
      EXECUTE format('UPDATE public.%I SET %I = NULL WHERE id = $1', spec.tbl, spec.col) USING v_id;

      EXECUTE format(
        'SELECT count(*) FILTER (WHERE %1$I = %2$L), count(*) FILTER (WHERE %1$I IS NULL),
                coalesce(bool_and(changed_at IS NOT NULL), false)
           FROM public.%3$I WHERE %4$I = $1 AND changed_by = $2',
        spec.col, '[test]', spec.hist, spec.key)
        INTO v_set, v_emptied, v_owner_ok USING v_id, v_test;

      IF v_set <> 1 OR v_emptied <> 1 OR NOT v_owner_ok THEN
        v_failures := v_failures || format('%s (set = %s, emptied = %s, when and who = %s); ',
                                           spec.tbl, v_set, v_emptied, v_owner_ok);
      END IF;

      IF spec.tbl = 'bookings' AND v_group IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.bookings_history
            WHERE booking_id = v_id AND changed_by = v_test
              AND booking_group_id IS DISTINCT FROM v_group) THEN
        v_failures := v_failures || 'bookings (booking_group_id not recorded); ';
      END IF;
    END LOOP;

    -- INSERT and DELETE, on a service name nothing uses.
    INSERT INTO public.services_names (name, short_name, notes)
    VALUES ('[history test]', '[test]', '[test]') RETURNING id INTO v_id;
    DELETE FROM public.services_names WHERE id = v_id;
    IF (SELECT count(*) FROM public.services_names_history
         WHERE service_name_id = v_id AND changed_by = v_test AND name = '[history test]'
           AND change_type IN ('INSERT', 'DELETE')) <> 2 THEN
      v_failures := v_failures || 'services_names (insert or delete not recorded); ';
    END IF;

    -- Undo every change made in this block (the results above are kept).
    RAISE EXCEPTION USING ERRCODE = 'TSTRB', MESSAGE = 'undo the test changes';
  EXCEPTION WHEN SQLSTATE 'TSTRB' THEN
    NULL;
  END;

  IF v_failures <> '' THEN
    RAISE EXCEPTION 'TEST FAILED: %', v_failures;
  END IF;
  RAISE NOTICE 'TEST PASSED: emptied fields, when and who are recorded on all 8 tables. %',
    CASE WHEN v_skipped = '' THEN '' ELSE 'Skipped: ' || v_skipped END;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: tables_with_when_and_who = 8, functions_with_coalesce = 0, old_rows_still_unknown = 31663
-- or more (existing bookings_history rows keep NULL), new_rows_with_when = 0 unless something was
-- saved since STEP 1.
SELECT (SELECT count(DISTINCT table_name) FROM information_schema.columns
         WHERE table_schema = 'public' AND right(table_name, 8) = '_history' AND column_name = 'changed_by')
                                                                                   AS tables_with_when_and_who,
       (SELECT count(*) FROM pg_proc
         WHERE pronamespace = 'public'::regnamespace
           AND proname IN ('log_booking_changes', 'log_client_changes', 'log_therapist_changes',
                           'log_services_details_changes', 'log_services_durations_changes',
                           'log_services_names_changes', 'log_voucher_changes', 'log_voucher_uses_changes')
           AND strpos(lower(pg_get_functiondef(oid)), 'coalesce(new.') > 0) AS functions_with_coalesce,
       (SELECT count(*) FROM public.bookings_history WHERE changed_at IS NULL)     AS old_rows_still_unknown,
       (SELECT count(*) FROM public.bookings_history WHERE changed_at IS NOT NULL) AS new_rows_with_when;


-- ─────────────────────────────────────────────────────────────────────────────
-- UNDO (only if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run 2026-11-14-fix-history-tables-undo.sql: it puts back the 8 functions exactly as they were
-- before this file (with the COALESCE problem) and removes the new columns.
