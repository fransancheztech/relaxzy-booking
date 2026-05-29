-- Booking groups: add booking_group_id to bookings and bookings_history.
-- Plan: plans/2026-05-29-booking-groups.md
--
-- No FK to a parent table by design — booking_group_id is a shared marker
-- across sibling bookings, not a reference. No backfill of historical
-- "Group."-prefixed bookings.

ALTER TABLE bookings
  ADD COLUMN booking_group_id uuid;

ALTER TABLE bookings_history
  ADD COLUMN booking_group_id uuid;

CREATE INDEX bookings_booking_group_id_active_idx
  ON bookings (booking_group_id)
  WHERE booking_group_id IS NOT NULL AND deleted_at IS NULL;
