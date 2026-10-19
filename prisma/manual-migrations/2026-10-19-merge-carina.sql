-- Merge the two "Carina" records created on 04/09/2026 into one.
--
--   KEEP    d1a4b797-1c92-40d8-9098-0507b82b7e90  Carina  +34679980075  1 booking (07/09/2026), redeemed V-040926-1
--   ABSORB  dc5aea9c-5f42-4fd5-b594-f05e22ad2ce1  Carina  no phone/email 0 bookings, only the recipient of V-040926-1
--
-- Lilou bought V-040926-1 for Carina, which created a contact-less "Carina". The same day a booking
-- was made for Carina with her phone, which created a second record, and the voucher (60.00) was
-- redeemed against that booking. Afterwards the voucher's recipient still pointed at the empty record.
--
-- merge_clients() moves the voucher's recipient to the kept Carina and retires the empty one. Empty
-- details ('{}') leave the kept Carina's name/phone untouched. The merge is logged and appears in
-- Clients > Review duplicates > Recent merges, where it can be undone.
--
-- Run STEP 1 first and check it, then STEP 2 on its own.

-- STEP 1 (read-only): expected 2 rows, exactly as listed above.
SELECT c.id, c.client_name, c.client_phone, c.client_email,
       (SELECT count(*) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
       (SELECT string_agg(v.code, ', ') FROM vouchers v WHERE v.recipient_id = c.id AND v.deleted_at IS NULL) AS recipient_of
FROM clients c
WHERE c.deleted_at IS NULL
  AND c.id IN ('d1a4b797-1c92-40d8-9098-0507b82b7e90', 'dc5aea9c-5f42-4fd5-b594-f05e22ad2ce1');

-- STEP 2: the merge. Returns the merge id.
SELECT merge_clients(
  'd1a4b797-1c92-40d8-9098-0507b82b7e90'::uuid,
  ARRAY['dc5aea9c-5f42-4fd5-b594-f05e22ad2ce1']::uuid[],
  '{}'::jsonb,
  NULL
) AS merge_id;

-- STEP 3 (read-only): expected 1 row: V-040926-1 with recipient Carina +34679980075.
SELECT v.code, c.client_name, c.client_phone
FROM vouchers v JOIN clients c ON c.id = v.recipient_id
WHERE v.code = 'V-040926-1';
