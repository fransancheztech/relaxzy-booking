-- Make the database itself refuse badly formatted phones and emails on active clients, so the
-- table can't drift back to "689 59 01 23" / "(+34) 689.59.01.23" / "Ana@Gmail.com" even if a write
-- skips the app (manual SQL, a script, the public API key).
--
--   clients_phone_e164        active client phones must be E.164: +34689590123
--   clients_email_canonical   active client emails must be trimmed and lower-case, never ''
--   therapists_phone_e164     same phone rule for therapists
--
-- Only ACTIVE rows (deleted_at IS NULL) are checked. Retired rows keep their original values as
-- history (113 retired clients still hold old-format phones, mostly the losers of the duplicate merges).
--
-- Trade-off: a merge made before this migration can no longer be undone, because undoing it would
-- bring back an old-format phone. The app now explains that instead of failing with a generic error.
--
-- ORDER: deploy the app first (it lower-cases emails on every write path), then run this.
-- Otherwise a booking typed with "Ana@Gmail.com" would be rejected by the database.
--
-- Run each STEP on its own and compare with the expected result before going on.

-- STEP 0 (read-only). Expected, as checked on 24/10/2026:
--   active_bad_phones = 1   (the empty client below, phone '')
--   active_bad_emails = 5   (the empty client's '' + 4 capitalised addresses)
--   email_collisions  = 0   (lower-casing creates no clash with another client)
--   therapist_bad_phones = 0
SELECT
  (SELECT count(*) FROM clients WHERE deleted_at IS NULL AND client_phone IS NOT NULL
      AND client_phone !~ '^[+][1-9][0-9]{6,14}$') AS active_bad_phones,
  (SELECT count(*) FROM clients WHERE deleted_at IS NULL AND client_email IS NOT NULL
      AND client_email IS DISTINCT FROM nullif(lower(btrim(client_email)), '')) AS active_bad_emails,
  (SELECT count(*) FROM (
      SELECT lower(btrim(client_email)) FROM clients
      WHERE deleted_at IS NULL AND nullif(btrim(client_email), '') IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1) x) AS email_collisions,
  (SELECT count(*) FROM therapists WHERE deleted_at IS NULL AND phone IS NOT NULL
      AND phone !~ '^[+][1-9][0-9]{6,14}$') AS therapist_bad_phones;


-- STEP 1: fix the 5 rows.
--
-- a) Retire the empty client 474ff90d…: name, surname, phone and email are all '' (created
--    10/01/2026). Its only booking (10/01/2026 10:30) is already deleted; no vouchers, no voucher uses.
-- b) Lower-case the 4 capitalised emails (Familia Dental, Asunción, Rossmery, "Tus brodas de crosfit").
--
-- Expected: UPDATE 1, then UPDATE 4.
UPDATE clients
   SET deleted_at = now()
 WHERE id = '474ff90d-661c-43e5-989a-508cd5c94a9c'
   AND deleted_at IS NULL
   AND coalesce(client_name, '') = '' AND coalesce(client_phone, '') = '' AND coalesce(client_email, '') = '';

UPDATE clients
   SET client_email = lower(btrim(client_email)), updated_at = now()
 WHERE deleted_at IS NULL
   AND client_email IS NOT NULL
   AND btrim(client_email) <> ''
   AND client_email <> lower(btrim(client_email));


-- STEP 2: the constraints. Each one checks every active row as it is added, so if STEP 1 missed
-- anything this fails with "check constraint … is violated by some row" and nothing is changed.
ALTER TABLE clients
  ADD CONSTRAINT clients_phone_e164
  CHECK (deleted_at IS NOT NULL OR client_phone IS NULL OR client_phone ~ '^[+][1-9][0-9]{6,14}$');

ALTER TABLE clients
  ADD CONSTRAINT clients_email_canonical
  CHECK (deleted_at IS NOT NULL OR client_email IS NULL
         OR (client_email <> '' AND client_email = lower(btrim(client_email))));

ALTER TABLE therapists
  ADD CONSTRAINT therapists_phone_e164
  CHECK (deleted_at IS NOT NULL OR phone IS NULL OR phone ~ '^[+][1-9][0-9]{6,14}$');


-- STEP 3 (read-only). Expected 3 rows: clients_email_canonical, clients_phone_e164,
-- therapists_phone_e164.
SELECT conrelid::regclass AS "table", conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('clients_phone_e164', 'clients_email_canonical', 'therapists_phone_e164')
ORDER BY conname;


-- UNDO (only if something goes wrong):
-- ALTER TABLE clients    DROP CONSTRAINT IF EXISTS clients_phone_e164;
-- ALTER TABLE clients    DROP CONSTRAINT IF EXISTS clients_email_canonical;
-- ALTER TABLE therapists DROP CONSTRAINT IF EXISTS therapists_phone_e164;
