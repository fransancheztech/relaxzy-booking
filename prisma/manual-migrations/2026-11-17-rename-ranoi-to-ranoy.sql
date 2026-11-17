-- Old-data cleanup: the occasional helper added on 2026-11-16 as "Ranoi" goes by "Ranoy" (the
-- owner's choice, 2026-11-17). Her note lists the other spellings: Ranoi, Lanoy and Lanoi.
--
-- Data only, no schema change: no db pull / prisma generate needed.
--
-- Run STEP 1 first and check it, then STEP 2, then STEP 3.

-- STEP 1 (read-only): expected one row: Ranoi, inactive,
--   "Occasional help: 11/01/2025, 14/02/2026, 01/04/2026. Also written Ranoy or Lanoy; sometimes called Noi"
SELECT id, nickname, active, notes
FROM therapists
WHERE deleted_at IS NULL AND lower(nickname) IN ('ranoi', 'ranoy');

-- STEP 2: the change.
UPDATE therapists
SET nickname = 'Ranoy',
    notes = 'Occasional help: 11/01/2025, 14/02/2026, 01/04/2026. Also written Ranoi, Lanoy or Lanoi; sometimes called Noi'
WHERE id = 'd9be3856-a62b-493d-bf13-d4112019d849' AND nickname = 'Ranoi';

-- STEP 3 (read-only): expected one row: Ranoy, with the note above.
SELECT nickname, active, notes
FROM therapists
WHERE deleted_at IS NULL AND lower(nickname) IN ('ranoi', 'ranoy');
