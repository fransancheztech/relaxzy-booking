-- Old-data cleanup: move payments that were typed in late back to the day of the massage.
--
-- From January to May 2026, payments were entered in batches days or weeks after the visits, and
-- each one was dated the day it was typed. With Stats or Daily Totals on "Payment date", those
-- entry days look huge and the real days look empty:
--
--   entry day    events   money moved back to the visit days
--   23/01/2026    227     12,138.00
--   13/02/2026    148      8,120.00
--   10/04/2026     92      5,643.00
--   21/02/2026     88      4,975.00
--   01/03/2026     73      4,290.00
--   07/03/2026     75      4,175.00
--
-- Scope: every payment event of a booking that starts before 01/06/2026 and whose date (Madrid)
-- differs from the booking's date. Checked read-only on 2026-11-15:
--   * 1,178 events in 1,169 payments: 1,177 charges (65,829.00) and 1 refund (30.00);
--   * none was paid before its booking; the delays run from 1 to 48 days;
--   * by booking month: Jan 332, Feb 305, Mar 314, Apr 143, May 84 (bookings up to 23/05);
--   * the refund is the 30.00 "Error" correction on the 08/02 booking (85.00 charged, so 55.00 net);
--   * 2024–2025 payments are already on their booking's day, and the few later cases from
--     June 2026 onwards (some are prepayments) are left alone.
--
-- New date: the booking's end time, i.e. as if paid when the massage ended (live data shows
-- payments ~1h after the start). Each payment keeps its events in their original order: when a
-- payment has several moved events, or already has an event on the booking day, each moved event
-- goes 1 minute after the previous one. Every new date falls on the booking's day.
--
-- payments.created_at (the date shown on each payment in Manage payments) follows its first event,
-- for the 1,164 payments whose own date is also on another day.
--
-- Undo: the audit triggers keep the old created_at of every row in payment_events_log and
-- payments_log (old_data). Yesterday's backup also has them.
--
-- Data only, no schema change: no db pull / prisma generate needed.
--
-- Run STEP 1 first and check it, then STEP 2 on its own, then STEP 3.

-- STEP 1 (read-only): expected one row: 1178 | 1169 | 65829.00 | 30.00
SELECT count(*) AS events,
       count(DISTINCT p.id) AS payments,
       sum(e.amount) FILTER (WHERE e.type = 'CHARGE') AS charges,
       sum(e.amount) FILTER (WHERE e.type = 'REFUND') AS refunds
FROM bookings b
JOIN payments p ON p.booking_id = b.id AND p.deleted_at IS NULL
JOIN payment_events e ON e.payment_id = p.id AND e.deleted_at IS NULL
WHERE b.deleted_at IS NULL
  AND b.start_time < '2026-06-01'
  AND (e.created_at AT TIME ZONE 'Europe/Madrid')::date <> (b.start_time AT TIME ZONE 'Europe/Madrid')::date;

-- STEP 2: the change. It stops and changes nothing if the numbers differ from STEP 1's.
BEGIN;

CREATE TEMP TABLE redate ON COMMIT DROP AS
WITH scope AS (
  SELECT e.id AS event_id, p.id AS payment_id, b.start_time, b.end_time,
         row_number() OVER (PARTITION BY p.id ORDER BY e.created_at, e.id) AS rn
  FROM bookings b
  JOIN payments p ON p.booking_id = b.id AND p.deleted_at IS NULL
  JOIN payment_events e ON e.payment_id = p.id AND e.deleted_at IS NULL
  WHERE b.deleted_at IS NULL
    AND b.start_time < '2026-06-01'
    AND (e.created_at AT TIME ZONE 'Europe/Madrid')::date <> (b.start_time AT TIME ZONE 'Europe/Madrid')::date
)
SELECT s.event_id, s.payment_id, s.start_time,
       greatest(
         s.end_time,
         -- after any event of the same payment that is already on the booking's day
         (SELECT max(x.created_at) + interval '1 minute'
            FROM payment_events x
           WHERE x.payment_id = s.payment_id AND x.deleted_at IS NULL
             AND (x.created_at AT TIME ZONE 'Europe/Madrid')::date = (s.start_time AT TIME ZONE 'Europe/Madrid')::date)
       ) + (s.rn - 1) * interval '1 minute' AS new_at
FROM scope s;

DO $$
DECLARE
  n_events int;
  n_payments int;
  n_off_day int;
BEGIN
  SELECT count(*), count(DISTINCT payment_id) INTO n_events, n_payments FROM redate;
  SELECT count(*) INTO n_off_day FROM redate
   WHERE (new_at AT TIME ZONE 'Europe/Madrid')::date <> (start_time AT TIME ZONE 'Europe/Madrid')::date;
  IF n_events <> 1178 OR n_payments <> 1169 OR n_off_day <> 0 THEN
    RAISE EXCEPTION 'Stopped, nothing changed: % events in % payments, % not on the booking day (expected 1178, 1169, 0)',
      n_events, n_payments, n_off_day;
  END IF;
END $$;

UPDATE payment_events e
SET created_at = r.new_at
FROM redate r
WHERE e.id = r.event_id;

UPDATE payments p
SET created_at = (SELECT min(x.created_at) FROM payment_events x WHERE x.payment_id = p.id AND x.deleted_at IS NULL)
FROM bookings b
WHERE b.id = p.booking_id
  AND p.id IN (SELECT payment_id FROM redate)
  AND (p.created_at AT TIME ZONE 'Europe/Madrid')::date <> (b.start_time AT TIME ZONE 'Europe/Madrid')::date;

COMMIT;

-- STEP 3 (read-only): expected one row: 0 | 0
SELECT
  (SELECT count(*)
     FROM bookings b
     JOIN payments p ON p.booking_id = b.id AND p.deleted_at IS NULL
     JOIN payment_events e ON e.payment_id = p.id AND e.deleted_at IS NULL
    WHERE b.deleted_at IS NULL AND b.start_time < '2026-06-01'
      AND (e.created_at AT TIME ZONE 'Europe/Madrid')::date <> (b.start_time AT TIME ZONE 'Europe/Madrid')::date) AS events_on_another_day,
  (SELECT count(*)
     FROM bookings b
     JOIN payments p ON p.booking_id = b.id AND p.deleted_at IS NULL
    WHERE b.deleted_at IS NULL AND b.start_time < '2026-06-01'
      AND (p.created_at AT TIME ZONE 'Europe/Madrid')::date <> (b.start_time AT TIME ZONE 'Europe/Madrid')::date) AS payments_on_another_day;
