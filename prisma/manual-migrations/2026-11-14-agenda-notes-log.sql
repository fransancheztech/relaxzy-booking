-- A log of every change to agenda notes, so an edited or deleted note can always be read again.
--
-- Today an edit overwrites a note's text for good, including the daily "sin atender" totals used
-- to study lost clients, and nothing shows who changed it. Deleted notes survive only as
-- deleted_at. From now on every change is kept in a new table, agenda_notes_log.
--
-- SAME SHAPE AS guidelines_log and tips_log: each row keeps the note BEFORE the change (old_data)
-- and AFTER it (new_data) as JSON, plus when (changed_at) and who (changed_by).
--   * INSERT → new_data only; UPDATE → both; DELETE → old_data only. Deleting a note in the app
--     is an UPDATE that sets deleted_at, so it is logged with the note as it was.
--   * Every save in the app rewrites updated_at, even when nothing else changed. A change to
--     updated_at alone is not logged.
--   * transaction_id groups the rows written by one save.
--   * changed_by comes from the app.user_id setting, as for guidelines and tips. The agenda routes
--     don't set it yet: until that code change, rows are logged with changed_by = NULL.
--   * No foreign key to agenda_notes: the log must outlive the note.
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
-- Expect: log_table = NULL (not applied yet), existing_triggers = 0, notes = 81 or more.
SELECT to_regclass('public.agenda_notes_log') AS log_table,
       (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = 'public.agenda_notes'::regclass AND NOT tgisinternal) AS existing_triggers,
       (SELECT count(*) FROM public.agenda_notes) AS notes;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.agenda_notes_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid        NOT NULL,
  change_type     change_type NOT NULL,
  old_data        jsonb,
  new_data        jsonb,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      uuid,
  transaction_id  bigint      NOT NULL DEFAULT txid_current()
);

COMMENT ON TABLE public.agenda_notes_log IS
  'Every change to agenda_notes: the note before (old_data) and after (new_data).';
COMMENT ON COLUMN public.agenda_notes_log.transaction_id IS
  'Same value for every row written by one save.';

CREATE INDEX agenda_notes_log_note_idx ON public.agenda_notes_log (note_id, changed_at DESC);

ALTER TABLE public.agenda_notes_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_notes_log FROM anon, authenticated;

CREATE FUNCTION public.log_agenda_note_changes()
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

  -- A save rewrites updated_at even when nothing else changed: that isn't a change.
  IF TG_OP = 'UPDATE' AND (v_old - 'updated_at') = (v_new - 'updated_at') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.agenda_notes_log (note_id, change_type, old_data, new_data, changed_by)
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

REVOKE EXECUTE ON FUNCTION public.log_agenda_note_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_log_agenda_notes_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.agenda_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_agenda_note_changes();

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Test (changes nothing: every test change is undone before it ends)
-- ─────────────────────────────────────────────────────────────────────────────
-- On one existing note, inside a block that is always rolled back, this tries: a save that only
-- rewrites updated_at (must log nothing), a text edit and a deletion as the app does it (each must
-- log one row), and adding a copy of the note and removing it for good (one row each), all with
-- the test user as changed_by.
--
-- Expect: "Success. No rows returned" (the editor may also show the notice "TEST PASSED").
-- An error starting with "TEST FAILED" means the log doesn't work as described: don't continue,
-- and use UNDO below. Either way, no note or log row is left changed.
DO $$
DECLARE
  v_note     public.agenda_notes%ROWTYPE;
  v_copy_id  uuid;
  v_touch    int;
  v_rows     int;
  v_edit     int;
  v_deleted  int;
  v_added    int;
  v_removed  int;
  v_owner_ok boolean;
BEGIN
  SELECT * INTO v_note FROM public.agenda_notes WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST FAILED: there is no active agenda note to test with.';
  END IF;

  BEGIN
    PERFORM set_config('app.user_id', '00000000-0000-0000-0000-000000000001', true);

    -- A save that changes nothing but updated_at.
    UPDATE public.agenda_notes SET updated_at = now() WHERE id = v_note.id;
    SELECT count(*) INTO v_touch FROM public.agenda_notes_log WHERE transaction_id = txid_current();

    -- Text edit, then a deletion the way the app does it.
    UPDATE public.agenda_notes SET content = content || ' [test]', updated_at = now() WHERE id = v_note.id;
    UPDATE public.agenda_notes SET deleted_at = now() WHERE id = v_note.id;

    -- A new note, then removed for good.
    INSERT INTO public.agenda_notes (note_date, content, target_roles, author_id)
    VALUES (v_note.note_date, 'test', v_note.target_roles, v_note.author_id)
    RETURNING id INTO v_copy_id;
    DELETE FROM public.agenda_notes WHERE id = v_copy_id;

    SELECT count(*),
           count(*) FILTER (WHERE note_id = v_note.id AND change_type = 'UPDATE'
                              AND old_data->>'content' = v_note.content
                              AND new_data->>'content' = v_note.content || ' [test]'
                              AND new_data->>'deleted_at' IS NULL),
           count(*) FILTER (WHERE note_id = v_note.id AND change_type = 'UPDATE'
                              AND old_data->>'deleted_at' IS NULL
                              AND new_data->>'deleted_at' IS NOT NULL),
           count(*) FILTER (WHERE note_id = v_copy_id AND change_type = 'INSERT'
                              AND old_data IS NULL AND new_data->>'content' = 'test'),
           count(*) FILTER (WHERE note_id = v_copy_id AND change_type = 'DELETE'
                              AND new_data IS NULL AND old_data->>'content' = 'test'),
           coalesce(bool_and(changed_by = '00000000-0000-0000-0000-000000000001'), false)
      INTO v_rows, v_edit, v_deleted, v_added, v_removed, v_owner_ok
      FROM public.agenda_notes_log
     WHERE transaction_id = txid_current();

    -- Undo every change made in this block (the counts above are kept).
    RAISE EXCEPTION USING ERRCODE = 'TSTRB', MESSAGE = 'undo the test changes';
  EXCEPTION WHEN SQLSTATE 'TSTRB' THEN
    NULL;
  END;

  IF v_touch <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: a save that only rewrote updated_at was logged (% rows).', v_touch;
  END IF;
  IF v_rows <> 4 OR v_edit <> 1 OR v_deleted <> 1 OR v_added <> 1 OR v_removed <> 1 OR NOT v_owner_ok THEN
    RAISE EXCEPTION 'TEST FAILED: rows = % (expected 4); text edit = %, deletion = %, added = %, removed = % (expected 1 each); user recorded = %.',
      v_rows, v_edit, v_deleted, v_added, v_removed, v_owner_ok;
  END IF;

  RAISE NOTICE 'TEST PASSED: every change was logged, and the test left nothing behind.';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: log_table = true, log_rows = 0 (more only if someone saved a note since STEP 1),
-- triggers = 1, rls_on = true, anon_can_read = false, authenticated_can_read = false.
SELECT to_regclass('public.agenda_notes_log') IS NOT NULL                              AS log_table,
       (SELECT count(*) FROM public.agenda_notes_log)                                  AS log_rows,
       (SELECT count(*) FROM pg_trigger
         WHERE tgname = 'trigger_log_agenda_notes_changes' AND NOT tgisinternal)       AS triggers,
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agenda_notes_log'::regclass) AS rls_on,
       has_table_privilege('anon', 'public.agenda_notes_log', 'SELECT')                AS anon_can_read,
       has_table_privilege('authenticated', 'public.agenda_notes_log', 'SELECT')       AS authenticated_can_read;


-- ─────────────────────────────────────────────────────────────────────────────
-- UNDO (only if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes the log and everything recorded in it. The notes themselves are not touched.
-- BEGIN;
-- DROP TRIGGER trigger_log_agenda_notes_changes ON public.agenda_notes;
-- DROP FUNCTION public.log_agenda_note_changes();
-- DROP TABLE public.agenda_notes_log;
-- COMMIT;
