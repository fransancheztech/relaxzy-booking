SELECT
  p.id AS payment_id,
  sum(
    CASE
      WHEN (pe.type = 'CHARGE' :: payment_types) THEN pe.amount
      ELSE (0) :: numeric
    END
  ) AS charged_amount,
  sum(
    CASE
      WHEN (pe.type = 'REFUND' :: payment_types) THEN pe.amount
      ELSE (0) :: numeric
    END
  ) AS refunded_amount,
  min(
    CASE
      WHEN (pe.type = 'CHARGE' :: payment_types) THEN pe.created_at
      ELSE NULL :: timestamp WITH time zone
    END
  ) AS paid_at,
  max(
    CASE
      WHEN (pe.type = 'REFUND' :: payment_types) THEN pe.created_at
      ELSE NULL :: timestamp WITH time zone
    END
  ) AS refunded_at,
  max(
    CASE
      WHEN (pe.type = 'CHARGE' :: payment_types) THEN pe.method
      ELSE NULL :: payment_methods
    END
  ) AS method
FROM
  (
    payments p
    LEFT JOIN payment_events pe ON (
      (
        (pe.payment_id = p.id)
        AND (pe.deleted_at IS NULL)
      )
    )
  )
GROUP BY
  p.id;