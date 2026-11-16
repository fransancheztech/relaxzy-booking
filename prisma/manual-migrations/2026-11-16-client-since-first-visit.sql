-- Client-data quality: "client since" is the first visit. Move clients.created_at back to the
-- start of the client's first booking when the record was created on a later day.
--
-- Why they differ (checked read-only on 2026-11-16, 3,267 active clients):
--   * 1,373 were created on a later day than their first booking; 972 on the same day; 627 before
--     (booked ahead); 295 have no bookings.
--   * No client record is older than 03/10/2025, when the old bookings were first typed in:
--       03/10/2025  659 clients, first visits 13/09/2024–30/09/2025
--       03/01/2026  365 clients, first visits 01/10/2025–31/12/2025
--     then weekly batches from January to May 2026 (13/02 46, 10/01 29, 10/04 28, ...), the same
--     late entry already fixed for payments in 2026-11-15-redate-late-entered-payments.sql.
--   * 1,367 of the first bookings were created with this client, so it isn't a re-linking bug.
--     72 clients are merge survivors that inherited older bookings. Only 2 cases since June 2026.
--
-- New value: the start time of the client's first non-deleted booking (the same "first booking"
-- that Stats already uses for new clients). Clients created before or on the day of their first
-- visit, and clients with no bookings, are left alone. updated_at isn't touched.
--
-- Run it again after the old-data cleanup: assigning clients to the old blank-client bookings will
-- move some first visits earlier. Put STEP 1's new number in place of 1373 in STEP 2.
--
-- Undo: the clients_history trigger keeps every client's old created_at (the rows have no author,
-- as for any change made in the SQL editor). Yesterday's backup also has them.
--
-- Data only, no schema change: no db pull / prisma generate needed.
--
-- Run STEP 1 first and check it, then STEP 2 on its own, then STEP 3.

-- STEP 1 (read-only): expected one row: 1373
SELECT count(*) AS clients_to_change
FROM clients c
JOIN (SELECT client_id, min(start_time) AS first_visit
        FROM bookings WHERE deleted_at IS NULL AND client_id IS NOT NULL GROUP BY client_id) f
  ON f.client_id = c.id
WHERE c.deleted_at IS NULL
  AND (f.first_visit AT TIME ZONE 'Europe/Madrid')::date < (c.created_at AT TIME ZONE 'Europe/Madrid')::date;

-- STEP 2: the change. It stops and changes nothing if the count differs from STEP 1's.
DO $$
DECLARE
  n int;
BEGIN
  UPDATE clients c
  SET created_at = f.first_visit
  FROM (SELECT client_id, min(start_time) AS first_visit
          FROM bookings WHERE deleted_at IS NULL AND client_id IS NOT NULL GROUP BY client_id) f
  WHERE f.client_id = c.id
    AND c.deleted_at IS NULL
    AND (f.first_visit AT TIME ZONE 'Europe/Madrid')::date < (c.created_at AT TIME ZONE 'Europe/Madrid')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1373 THEN
    RAISE EXCEPTION 'Stopped, nothing changed: % clients would change (expected 1373)', n;
  END IF;
END $$;

-- STEP 3 (read-only): expected one row: 0
SELECT count(*) AS created_after_first_visit
FROM clients c
JOIN (SELECT client_id, min(start_time) AS first_visit
        FROM bookings WHERE deleted_at IS NULL AND client_id IS NOT NULL GROUP BY client_id) f
  ON f.client_id = c.id
WHERE c.deleted_at IS NULL
  AND (f.first_visit AT TIME ZONE 'Europe/Madrid')::date < (c.created_at AT TIME ZONE 'Europe/Madrid')::date;
