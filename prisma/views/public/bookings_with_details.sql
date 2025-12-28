SELECT
  b.id AS booking_id,
  b.start_time,
  b.end_time,
  b.notes AS booking_notes,
  b.status,
  b.created_at AS booking_created_at,
  b.updated_at AS booking_updated_at,
  c.id AS client_id,
  c.client_name,
  c.client_email,
  c.client_phone,
  c.client_notes,
  c.created_at AS client_created_at,
  s.id AS service_id,
  s.name AS service_name,
  s.created_at AS service_created_at,
  p.id AS payment_id,
  p.amount AS payment_amount,
  p.method AS payment_method,
  p.refunded AS payment_refunded,
  p.paid_at AS payment_paid_at
FROM
  (
    (
      (
        bookings b
        LEFT JOIN clients c ON ((b.client_id = c.id))
      )
      LEFT JOIN services s ON ((b.service_id = s.id))
    )
    LEFT JOIN payments p ON ((b.id = p.booking_id))
  );