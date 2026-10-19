-- First real use of merge_clients(): the three Emilios, one phone number (+34 689 59 01 23).
--
-- Requires 2026-10-18-client-merge.sql to be applied first.
--
--   KEEP   86c5aed7…  "Emilio "  +34689590123      25 bookings  created 03/10/2025 (import)
--   FOLD   7ca7588a…  "Emilio"   +34 689 59 01 23  22 bookings  created 06/06/2026 (1 of them deleted)
--   FOLD   bd088f42…  "Emilio"   689590123         18 bookings  created 13/02/2026
--
-- Kept: the oldest row, with the most bookings, already holding the number in +34 format. None of
-- the three has a surname, email or notes, so there are no details to reconcile; the only change to
-- the kept row is trimming the stray space in its name. 40 bookings move; no vouchers involved.
--
-- Run each PART on its own: the Supabase SQL editor only shows the result of the last statement.


-- ─────────────────────────────────────────────────────────────────────────────
-- PART A — Rehearsal (changes NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────
-- Performs the merge AND its undo on the real rows, checks the counts at each stage, then aborts
-- on purpose so everything is rolled back. The RED ERROR MESSAGE IS THE REPORT. Expect:
--
--   REHEARSAL ONLY - nothing was saved. After merge: kept Emilio has 65 bookings, name "Emilio",
--   2 duplicates retired. After undo: 25 / 22 / 18 bookings, name "Emilio ", 0 retired.
DO $$
DECLARE
  k  constant uuid := '86c5aed7-7716-4cab-bb25-029578756aaa';
  f1 constant uuid := '7ca7588a-076c-4139-8e70-479e2a3463bd';
  f2 constant uuid := 'bd088f42-1f90-495c-9027-637d5590d58b';
  v_merge uuid;
  merged_k int; merged_name text; merged_retired int;
  undone_k int; undone_f1 int; undone_f2 int; undone_name text; undone_retired int;
BEGIN
  v_merge := merge_clients(k, ARRAY[f1, f2], '{"client_name": "Emilio"}'::jsonb, NULL);

  SELECT count(*) INTO merged_k FROM bookings WHERE client_id = k;
  SELECT client_name INTO merged_name FROM clients WHERE id = k;
  SELECT count(*) INTO merged_retired FROM clients WHERE id IN (f1, f2) AND deleted_at IS NOT NULL;

  PERFORM unmerge_clients(v_merge, NULL);

  SELECT count(*) INTO undone_k  FROM bookings WHERE client_id = k;
  SELECT count(*) INTO undone_f1 FROM bookings WHERE client_id = f1;
  SELECT count(*) INTO undone_f2 FROM bookings WHERE client_id = f2;
  SELECT client_name INTO undone_name FROM clients WHERE id = k;
  SELECT count(*) INTO undone_retired FROM clients WHERE id IN (f1, f2) AND deleted_at IS NOT NULL;

  RAISE EXCEPTION 'REHEARSAL ONLY - nothing was saved. After merge: kept Emilio has % bookings, name "%", % duplicates retired. After undo: % / % / % bookings, name "%", % retired.',
    merged_k, merged_name, merged_retired, undone_k, undone_f1, undone_f2, undone_name, undone_retired;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART B — The merge (for real)
-- ─────────────────────────────────────────────────────────────────────────────
-- One call, atomic: either everything happens or nothing does. Returns the merge id — keep it,
-- it is what PART D needs. (The last argument is who merged; NULL here, the app will fill it.)
SELECT merge_clients(
  '86c5aed7-7716-4cab-bb25-029578756aaa'::uuid,
  ARRAY['7ca7588a-076c-4139-8e70-479e2a3463bd', 'bd088f42-1f90-495c-9027-637d5590d58b']::uuid[],
  '{"client_name": "Emilio"}'::jsonb,
  NULL
) AS merge_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART C — Check (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: the kept Emilio with 65 bookings and retired = false; the other two with 0 bookings and
-- retired = true.
SELECT c.id, c.client_name, c.client_phone,
       c.deleted_at IS NOT NULL                                      AS retired,
       (SELECT count(*) FROM bookings b WHERE b.client_id = c.id)    AS bookings
FROM clients c
WHERE c.id IN ('86c5aed7-7716-4cab-bb25-029578756aaa',
               '7ca7588a-076c-4139-8e70-479e2a3463bd',
               'bd088f42-1f90-495c-9027-637d5590d58b')
ORDER BY bookings DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART D — Undo (ONLY if something looks wrong)
-- ─────────────────────────────────────────────────────────────────────────────
-- Paste the merge id from PART B. Puts the 40 bookings back on the Emilio each came from, brings
-- the two rows back, and restores the kept row's name.
-- SELECT unmerge_clients('<merge id from PART B>'::uuid, NULL);
