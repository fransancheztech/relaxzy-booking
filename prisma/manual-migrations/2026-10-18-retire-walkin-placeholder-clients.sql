-- Retire the "Walk in" placeholder CLIENTS and return their bookings to being true walk-ins.
--
-- Found via the new Top clients table: a client literally named "Walk in" ranked among the
-- best clients in the business. It is not a person — it is a bucket that many anonymous
-- walk-ins were filed under over time, so its bookings, money and visit count were being
-- attributed to one fictional client. It also inflated nothing less than the client stats:
-- unique clients, retention and avg-bookings-per-client are all computed per client_id.
--
-- The system already has a correct representation for an anonymous customer:
-- bookings.client_id IS NULL. That is exactly what the Walk-in toggle in New Booking
-- produces, and what every client-facing stat already excludes. So the fix is to point
-- these bookings at NULL and retire the two fake client rows.
--
-- NOTHING IS LOST. The bookings keep their price, payments, therapist, service, times and
-- status; they stop claiming to belong to one person. Verified before writing this:
-- 0 vouchers and 0 tips are attached to these rows, so there is nothing else to re-home.
--
-- DELIBERATELY NOT TOUCHED: seven other rows named "walk-in" that each carry a real foreign
-- phone number (+44, +33, +41, +49) and exactly one booking. Those are individual tourists
-- whose name was never captured — real people with a contact detail, not buckets. Renaming
-- or merging them is a judgement call for a human, and with one booking each they cannot
-- distort any ranking.
--
-- Accents are folded with translate() rather than unaccent(): that extension is NOT
-- installed on this database (checked), and a plain regexp would turn "anónimo" into
-- "an nimo" and miss it.
--
-- This is a DATA migration only: no schema change, so no `prisma db pull` or
-- `prisma generate` is needed afterwards.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Verify the targets before changing anything
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect exactly 2 rows: "Walk in" with 17 bookings and "Walk in" with 1, both with NO
-- phone and NO email. If you see a row WITH a phone or email here, stop: the filter has
-- caught an individual and must not be run.

SELECT c.id,
       c.client_name,
       c.client_surname,
       c.client_phone,
       c.client_email,
       (SELECT count(*) FROM bookings b WHERE b.client_id = c.id) AS bookings,
       (SELECT count(*) FROM vouchers v WHERE v.buyer_id = c.id OR v.recipient_id = c.id) AS vouchers
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.client_phone IS NULL
  AND c.client_email IS NULL
  AND btrim(regexp_replace(translate(lower(coalesce(c.client_name, '') || ' ' || coalesce(c.client_surname, '')),
                                     'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
                           '[^a-z0-9]+', ' ', 'g')) IN ('walk in', 'walkin')
ORDER BY bookings DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Re-point the bookings, then retire the client rows
-- ─────────────────────────────────────────────────────────────────────────────
-- One transaction: a half-applied version would leave bookings pointing at a soft-deleted
-- client, which no screen expects. The CTE pins the target ids once so both statements act
-- on exactly the same set even though the first one changes what the filter would match.

BEGIN;

WITH targets AS (
  SELECT c.id
  FROM clients c
  WHERE c.deleted_at IS NULL
    AND c.client_phone IS NULL
    AND c.client_email IS NULL
    AND btrim(regexp_replace(translate(lower(coalesce(c.client_name, '') || ' ' || coalesce(c.client_surname, '')),
                                     'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
                             '[^a-z0-9]+', ' ', 'g')) IN ('walk in', 'walkin')
),
-- Includes soft-deleted bookings on purpose: leaving one pointing at a retired client
-- would resurrect the name if that booking were ever restored.
repointed AS (
  UPDATE bookings
     SET client_id = NULL
   WHERE client_id IN (SELECT id FROM targets)
  RETURNING 1
)
UPDATE clients
   SET deleted_at = now()
 WHERE id IN (SELECT id FROM targets);

-- Expect: 18 bookings re-pointed, 2 clients retired.
-- The clients_history trigger records both retirements, so this edit is auditable.

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Confirm
-- ─────────────────────────────────────────────────────────────────────────────
-- First query must return 0 rows. Second shows the 18 bookings are now anonymous and still
-- carry their money.

SELECT count(*) AS placeholder_clients_remaining
FROM clients c
WHERE c.deleted_at IS NULL
  AND btrim(regexp_replace(translate(lower(coalesce(c.client_name, '') || ' ' || coalesce(c.client_surname, '')),
                                     'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
                           '[^a-z0-9]+', ' ', 'g')) IN ('walk in', 'walkin');

SELECT count(*)                                  AS anonymous_bookings,
       count(*) FILTER (WHERE p.id IS NOT NULL)  AS with_a_payment
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.id AND p.deleted_at IS NULL
WHERE b.client_id IS NULL AND b.deleted_at IS NULL;
