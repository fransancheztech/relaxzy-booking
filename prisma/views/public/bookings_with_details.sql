SELECT
  b.id AS booking_id,
  b.start_time AS booking_start_time,
  b.end_time AS booking_end_time,
  b.notes AS booking_notes,
  b.status AS booking_status,
  b.price AS booking_price,
  b.created_at AS booking_created_at,
  b.updated_at AS booking_updated_at,
  c.id AS client_id,
  c.client_name,
  c.client_surname,
  c.client_email,
  c.client_phone,
  c.client_notes,
  c.created_at AS client_created_at,
  sn.id AS service_id,
  sn.name AS service_name,
  sn.created_at AS service_created_at,
  sn.short_name AS service_short_name,
  sn.notes AS service_notes,
  sn.deleted_at AS service_deleted_at,
  sd.id AS service_duration_id,
  sd.duration AS service_duration,
  sd.notes AS service_duration_notes,
  sd.created_at AS service_duration_created_at,
  sd.deleted_at AS service_duration_deleted_at,
  sdet.id AS service_details_id,
  sdet.price AS service_catalog_price,
  sdet.notes AS service_details_notes,
  sdet.created_at AS service_details_created_at,
  sdet.deleted_at AS service_details_deleted_at,
  p.id AS payment_id,
  p.amount AS payment_amount,
  p.method AS payment_method,
  p.refunded AS payment_refunded,
  p.refunded_at AS payment_refunded_at,
  p.paid_at AS payment_paid_at,
  p.created_at AS payment_created_at,
  p.notes AS payment_notes
FROM
  (
    (
      (
        (
          (
            bookings b
            LEFT JOIN clients c ON ((b.client_id = c.id))
          )
          LEFT JOIN services_names sn ON ((b.service_id = sn.id))
        )
        LEFT JOIN services_details sdet ON ((sdet.service_name_id = sn.id))
      )
      LEFT JOIN services_durations sd ON ((sd.id = sdet.service_duration_id))
    )
    LEFT JOIN "OLD_payments" p ON ((p.booking_id = b.id))
  );