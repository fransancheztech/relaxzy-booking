-- Old-data cleanup: complete the therapists list so old bookings can be assigned to them later.
--
--   ADD     Noi    Kuntima Leelad   inactive  worked 08/03–31/03/2026
--   ADD     Ranoi  (no full name)   inactive  occasional help: 11/01/2025, 14/02/2026, 01/04/2026.
--                                             Written "Ranoy" or "Lanoy" on paper and "N" in notes,
--                                             because she is also called Noi. Not the same person as Noi above.
--   UPDATE  Wiw    name Wiriya, surname Rattanasaengloet Phalahan (both empty today)
--
-- Data only, no schema change: no db pull / prisma generate needed.
-- Bookings are NOT touched here; assigning therapists to old bookings is a separate step.
--
-- Run STEP 1 first and check it, then STEP 2 on its own, then STEP 3.

-- STEP 1 (read-only): expected
--   * one row: Wiw, empty name and surname, note "Leaves 31 August 2025";
--   * no row for Noi or Ranoi (any spelling).
SELECT id, nickname, name, surname, active, notes
FROM therapists
WHERE deleted_at IS NULL
  AND (id = '6e467817-d246-4bf9-a9e1-7a3f9c3b8f70'
       OR lower(nickname) IN ('noi', 'ranoi', 'ranoy', 'lanoy')
       OR lower(name) = 'kuntima');

-- STEP 2: the change. Safe to re-run: the inserts skip a nickname that already exists.
BEGIN;

INSERT INTO therapists (nickname, name, surname, active, notes)
SELECT 'Noi', 'Kuntima', 'Leelad', false, 'Worked 8–31 March 2026'
WHERE NOT EXISTS (SELECT 1 FROM therapists WHERE deleted_at IS NULL AND lower(nickname) = 'noi');

INSERT INTO therapists (nickname, active, notes)
SELECT 'Ranoi', false,
       'Occasional help: 11/01/2025, 14/02/2026, 01/04/2026. Also written Ranoy or Lanoy; sometimes called Noi'
WHERE NOT EXISTS (SELECT 1 FROM therapists WHERE deleted_at IS NULL AND lower(nickname) IN ('ranoi', 'ranoy', 'lanoy'));

UPDATE therapists
SET name = 'Wiriya', surname = 'Rattanasaengloet Phalahan'
WHERE id = '6e467817-d246-4bf9-a9e1-7a3f9c3b8f70' AND nickname = 'Wiw';

COMMIT;

-- STEP 3 (read-only): expected 3 rows, all inactive:
--   Noi    Kuntima  Leelad
--   Ranoi  (empty)  (empty)
--   Wiw    Wiriya   Rattanasaengloet Phalahan
SELECT nickname, name, surname, active, notes
FROM therapists
WHERE deleted_at IS NULL AND nickname IN ('Noi', 'Ranoi', 'Wiw')
ORDER BY nickname;
