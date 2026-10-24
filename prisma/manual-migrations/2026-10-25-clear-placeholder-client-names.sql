-- Clear placeholder names typed when the client's name wasn't known.
--
-- These are REAL clients — each has their own phone number and a completed booking — but the name
-- field holds a placeholder instead of a name. The record stays; only the fake name becomes empty
-- (NULL), the same as the 125 clients imported with a phone and no name. Their bookings, phone and
-- history are untouched, and they stop appearing at the top of the Clients list sorted A→Z.
--
-- New ones can't be created any more: the booking and voucher forms already reject a name made only
-- of punctuation ("-", ".") and placeholder words like "walk in".
--
-- Run each STEP on its own.

-- STEP 0 (read-only). Expected, as checked on 25/10/2026:
--   punctuation_names = 6   ("." x5, one with surname "Ramirez"; "-" x1)
--   walk_in_names     = 7   ("walk in" / "walk-in" / "Walk-in")
SELECT
  (SELECT count(*) FROM clients
    WHERE deleted_at IS NULL AND client_name IS NOT NULL AND btrim(client_name) !~ '[[:alpha:][:digit:]]') AS punctuation_names,
  (SELECT count(*) FROM clients
    WHERE deleted_at IS NULL AND client_name_folded IN ('walk in', 'walk-in', 'walkin')) AS walk_in_names;


-- STEP 1: the six "-" / "." names. Expected: UPDATE 6
UPDATE clients
   SET client_name = NULL, updated_at = now()
 WHERE deleted_at IS NULL
   AND client_name IS NOT NULL
   AND btrim(client_name) !~ '[[:alpha:][:digit:]]';


-- STEP 2 (optional): the seven clients named "walk in". Same situation — a real person with their
-- own phone and one booking, kept when the two shared "Walk in" records were retired on 18/10.
-- Expected: UPDATE 7
UPDATE clients
   SET client_name = NULL, updated_at = now()
 WHERE deleted_at IS NULL
   AND client_name_folded IN ('walk in', 'walk-in', 'walkin');


-- STEP 3 (read-only): expected 0 | 0 (or 0 | 7 if STEP 2 was skipped)
SELECT
  (SELECT count(*) FROM clients
    WHERE deleted_at IS NULL AND client_name IS NOT NULL AND btrim(client_name) !~ '[[:alpha:][:digit:]]') AS punctuation_names,
  (SELECT count(*) FROM clients
    WHERE deleted_at IS NULL AND client_name_folded IN ('walk in', 'walk-in', 'walkin')) AS walk_in_names;
