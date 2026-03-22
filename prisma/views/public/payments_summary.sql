SELECT
  p.id AS payment_id,
  p.booking_id,
  p.amount,
  p.notes,
  p.created_at,
  pes.method,
  pes.paid_at,
  pes.refunded_amount,
  pes.refunded_at
FROM
  (
    payments p
    LEFT JOIN payment_events_summary pes ON ((pes.payment_id = p.id))
  )
WHERE
  (p.deleted_at IS NULL);