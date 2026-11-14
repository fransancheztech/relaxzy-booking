-- A log of every change to the guidelines, so any past version can be seen again.
--
-- Today a guideline edit overwrites the old text for good: a section pasted over by mistake can't
-- be recovered. From now on every change is kept in a new table, guidelines_log.
--
-- ONE LOG, TWO TRIGGERS. The text lives in guideline_translations (one row per language); the
-- guidelines row holds who can see it (target_roles) and the dates. Both tables write into the same
-- guidelines_log, so a guideline's whole history is in one place:
--   * entity = 'translation' → a language's title/text was added, edited or removed (language set);
--   * entity = 'guideline'   → the guideline itself: created, roles changed, deleted (language NULL).
--
-- SAME SHAPE AS payments_log, not as the *_history tables: each row keeps the row BEFORE the change
-- (old_data) and AFTER it (new_data) as JSON, plus when (changed_at) and who (changed_by). Keeping
-- the "before" means the first edit after this migration already saves today's text; nothing has
-- to be copied in first. It also avoids the *_history pattern's COALESCE(NEW.x, OLD.x), which
-- records a field that was emptied as its old value.
--
--   * A save rewrites updated_at even on rows whose text didn't change. A change to updated_at
--     alone is not logged, so an untouched language or an unchanged guideline adds nothing.
--   * transaction_id groups the rows written by one save (e.g. the Spanish and English texts plus
--     the roles), so a versions screen can show them as a single save.
--   * changed_by comes from the app.user_id setting, as for payments and vouchers. The guideline
--     routes don't set it yet: until that code change, rows are logged with changed_by = NULL.
--   * No foreign key to guidelines: the log must outlive the guideline. (Guidelines are only ever
--     soft-deleted today; a hard delete would still be logged, translations included.)
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
-- Expect: log_table = NULL (not applied yet), existing_triggers = 0.
SELECT to_regclass('public.guidelines_log') AS log_table,
       (SELECT count(*) FROM pg_trigger
         WHERE tgrelid IN ('public.guidelines'::regclass, 'public.guideline_translations'::regclass)
           AND NOT tgisinternal) AS existing_triggers;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.guidelines_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id    uuid        NOT NULL,
  entity          text        NOT NULL,
  language        text,
  change_type     change_type NOT NULL,
  old_data        jsonb,
  new_data        jsonb,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      uuid,
  transaction_id  bigint      NOT NULL DEFAULT txid_current(),
  CONSTRAINT guidelines_log_entity_check CHECK (entity IN ('guideline', 'translation'))
);

COMMENT ON TABLE public.guidelines_log IS
  'Every change to guidelines and guideline_translations: the row before (old_data) and after (new_data).';
COMMENT ON COLUMN public.guidelines_log.entity IS
  '''guideline'' = the guidelines row (roles, deletion); ''translation'' = one language''s title and text.';
COMMENT ON COLUMN public.guidelines_log.transaction_id IS
  'Same value for every row written by one save.';

CREATE INDEX guidelines_log_guideline_idx ON public.guidelines_log (guideline_id, changed_at DESC);

ALTER TABLE public.guidelines_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guidelines_log FROM anon, authenticated;

-- One function for both tables: TG_TABLE_NAME tells them apart.
CREATE FUNCTION public.log_guideline_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  -- A save rewrites updated_at even when nothing else changed: that isn't a new version.
  IF TG_OP = 'UPDATE' AND (v_old - 'updated_at') = (v_new - 'updated_at') THEN
    RETURN NULL;
  END IF;

  v_row := coalesce(v_new, v_old);

  INSERT INTO public.guidelines_log (guideline_id, entity, language, change_type, old_data, new_data, changed_by)
  VALUES (
    CASE TG_TABLE_NAME WHEN 'guidelines' THEN (v_row->>'id')::uuid ELSE (v_row->>'guideline_id')::uuid END,
    CASE TG_TABLE_NAME WHEN 'guidelines' THEN 'guideline' ELSE 'translation' END,
    v_row->>'language',
    TG_OP::change_type,
    v_old,
    v_new,
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_guideline_changes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_log_guidelines_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.guidelines
  FOR EACH ROW EXECUTE FUNCTION public.log_guideline_changes();

CREATE TRIGGER trigger_log_guideline_translations_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.guideline_translations
  FOR EACH ROW EXECUTE FUNCTION public.log_guideline_changes();

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Test (changes nothing: every test change is undone before it ends)
-- ─────────────────────────────────────────────────────────────────────────────
-- On one existing translation, inside a block that is always rolled back, this tries: a save that
-- only rewrites updated_at (must log nothing), a text edit, a roles change, removing the language
-- and adding it back (each must log one row, with the test user as changed_by).
--
-- Expect: "Success. No rows returned" (the editor may also show the notice "TEST PASSED").
-- An error starting with "TEST FAILED" means the log doesn't work as described: don't continue,
-- and use UNDO below. Either way, no guideline or log row is left changed.
DO $$
DECLARE
  v_tr        public.guideline_translations%ROWTYPE;
  v_touch     int;
  v_rows      int;
  v_edit      int;
  v_roles     int;
  v_removed   int;
  v_added     int;
  v_owner_ok  boolean;
BEGIN
  SELECT * INTO v_tr FROM public.guideline_translations ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST FAILED: there is no guideline translation to test with.';
  END IF;

  BEGIN
    PERFORM set_config('app.user_id', '00000000-0000-0000-0000-000000000001', true);

    -- A save that changes nothing but updated_at.
    UPDATE public.guidelines SET updated_at = now() WHERE id = v_tr.guideline_id;
    UPDATE public.guideline_translations SET updated_at = now() WHERE id = v_tr.id;
    SELECT count(*) INTO v_touch FROM public.guidelines_log WHERE transaction_id = txid_current();

    -- Text edit, roles change, language removed, language added back.
    UPDATE public.guideline_translations SET content = content || ' [test]', updated_at = now()
     WHERE id = v_tr.id;
    UPDATE public.guidelines SET target_roles = array_append(target_roles, 'test')
     WHERE id = v_tr.guideline_id;
    DELETE FROM public.guideline_translations WHERE id = v_tr.id;
    INSERT INTO public.guideline_translations (guideline_id, language, title, content)
    VALUES (v_tr.guideline_id, v_tr.language, v_tr.title, v_tr.content);

    SELECT count(*),
           count(*) FILTER (WHERE entity = 'translation' AND change_type = 'UPDATE' AND language = v_tr.language
                              AND old_data->>'content' = v_tr.content
                              AND new_data->>'content' = v_tr.content || ' [test]'),
           count(*) FILTER (WHERE entity = 'guideline' AND change_type = 'UPDATE' AND language IS NULL
                              AND NOT (old_data->'target_roles') ? 'test'
                              AND (new_data->'target_roles') ? 'test'),
           count(*) FILTER (WHERE entity = 'translation' AND change_type = 'DELETE' AND new_data IS NULL
                              AND old_data->>'content' = v_tr.content || ' [test]'),
           count(*) FILTER (WHERE entity = 'translation' AND change_type = 'INSERT' AND old_data IS NULL
                              AND new_data->>'content' = v_tr.content),
           coalesce(bool_and(changed_by = '00000000-0000-0000-0000-000000000001'
                             AND guideline_id = v_tr.guideline_id), false)
      INTO v_rows, v_edit, v_roles, v_removed, v_added, v_owner_ok
      FROM public.guidelines_log
     WHERE transaction_id = txid_current();

    -- Undo every change made in this block (the counts above are kept).
    RAISE EXCEPTION USING ERRCODE = 'TSTRB', MESSAGE = 'undo the test changes';
  EXCEPTION WHEN SQLSTATE 'TSTRB' THEN
    NULL;
  END;

  IF v_touch <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: a save that only rewrote updated_at was logged (% rows).', v_touch;
  END IF;
  IF v_rows <> 4 OR v_edit <> 1 OR v_roles <> 1 OR v_removed <> 1 OR v_added <> 1 OR NOT v_owner_ok THEN
    RAISE EXCEPTION 'TEST FAILED: rows = % (expected 4); text edit = %, roles = %, removed = %, added = % (expected 1 each); user and guideline recorded = %.',
      v_rows, v_edit, v_roles, v_removed, v_added, v_owner_ok;
  END IF;

  RAISE NOTICE 'TEST PASSED: every change was logged, and the test left nothing behind.';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: log_table = true, log_rows = 0 (more only if someone saved a guideline since STEP 1),
-- triggers = 2, rls_on = true, anon_can_read = false, authenticated_can_read = false.
SELECT to_regclass('public.guidelines_log') IS NOT NULL                              AS log_table,
       (SELECT count(*) FROM public.guidelines_log)                                  AS log_rows,
       (SELECT count(*) FROM pg_trigger
         WHERE tgname IN ('trigger_log_guidelines_changes', 'trigger_log_guideline_translations_changes')
           AND NOT tgisinternal)                                                     AS triggers,
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guidelines_log'::regclass) AS rls_on,
       has_table_privilege('anon', 'public.guidelines_log', 'SELECT')                AS anon_can_read,
       has_table_privilege('authenticated', 'public.guidelines_log', 'SELECT')       AS authenticated_can_read;


-- ─────────────────────────────────────────────────────────────────────────────
-- UNDO (only if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes the log and everything recorded in it. The guidelines themselves are not touched.
-- BEGIN;
-- DROP TRIGGER trigger_log_guidelines_changes ON public.guidelines;
-- DROP TRIGGER trigger_log_guideline_translations_changes ON public.guideline_translations;
-- DROP FUNCTION public.log_guideline_changes();
-- DROP TABLE public.guidelines_log;
-- COMMIT;
