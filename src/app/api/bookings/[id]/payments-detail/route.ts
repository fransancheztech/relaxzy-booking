import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [paymentRows, voucherRows, eventRows] = await Promise.all([
      prisma.$queryRaw<{
        id: string;
        charged: number;
        refunded: number;
        method: string | null;
        created_at: Date;
      }[]>`
        SELECT
          p.id::text,
          COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0)::float AS charged,
          COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunded,
          MAX(pe.method::text)   FILTER (WHERE pe.type = 'CHARGE')              AS method,
          p.created_at
        FROM payments p
        LEFT JOIN payment_events pe ON pe.payment_id = p.id AND pe.deleted_at IS NULL
        WHERE p.booking_id = ${id}::uuid AND p.deleted_at IS NULL
        GROUP BY p.id, p.created_at
        HAVING COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0) > 0
        ORDER BY p.created_at ASC
      `,
      prisma.$queryRaw<{
        id: string;
        amount: number;
        voucher_code: string | null;
        created_at: Date;
        expiration_date: Date | null;
        source: string | null;
        external_reference: string | null;
        notes: string | null;
        buyer_name: string | null;
        buyer_surname: string | null;
        buyer_phone: string | null;
        buyer_email: string | null;
        recipient_name: string | null;
        recipient_surname: string | null;
        recipient_phone: string | null;
        recipient_email: string | null;
      }[]>`
        SELECT
          vu.id::text,
          vu.amount::float,
          v.code AS voucher_code,
          vu.created_at,
          v.expiration_date,
          v.source::text AS source,
          v.external_reference,
          v.notes,
          cb.client_name     AS buyer_name,
          cb.client_surname  AS buyer_surname,
          cb.client_phone    AS buyer_phone,
          cb.client_email    AS buyer_email,
          cr.client_name     AS recipient_name,
          cr.client_surname  AS recipient_surname,
          cr.client_phone    AS recipient_phone,
          cr.client_email    AS recipient_email
        FROM voucher_uses vu
        LEFT JOIN vouchers v ON v.id = vu.voucher_id AND v.deleted_at IS NULL
        LEFT JOIN clients cb ON cb.id = v.buyer_id     AND cb.deleted_at IS NULL
        LEFT JOIN clients cr ON cr.id = v.recipient_id AND cr.deleted_at IS NULL
        WHERE vu.booking_id = ${id}::uuid AND vu.deleted_at IS NULL
        ORDER BY vu.created_at ASC
      `,
      prisma.$queryRaw<{
        id: string;
        payment_id: string;
        type: "CHARGE" | "REFUND";
        amount: number;
        method: string;
        notes: string | null;
        created_at: Date;
      }[]>`
        SELECT
          pe.id::text,
          pe.payment_id::text,
          pe.type::text AS type,
          pe.amount::float,
          pe.method::text AS method,
          pe.notes,
          pe.created_at
        FROM payment_events pe
        JOIN payments p ON p.id = pe.payment_id
        WHERE p.booking_id = ${id}::uuid
          AND p.deleted_at IS NULL
          AND pe.deleted_at IS NULL
        ORDER BY pe.created_at ASC
      `,
    ]);

    const eventsByPayment = new Map<string, Array<{
      id: string;
      type: "CHARGE" | "REFUND";
      amount: number;
      method: string;
      notes: string | null;
      created_at: Date;
    }>>();
    for (const e of eventRows) {
      const list = eventsByPayment.get(e.payment_id) ?? [];
      list.push({
        id: e.id,
        type: e.type,
        amount: Number(e.amount),
        method: e.method,
        notes: e.notes,
        created_at: e.created_at,
      });
      eventsByPayment.set(e.payment_id, list);
    }

    return NextResponse.json({
      payments: paymentRows.map((p) => ({
        id: p.id,
        charged: Number(p.charged),
        refunded: Number(p.refunded),
        net: Number(p.charged) - Number(p.refunded),
        method: p.method ?? "cash",
        created_at: p.created_at,
        events: eventsByPayment.get(p.id) ?? [],
      })),
      voucher_uses: voucherRows.map((vu) => ({
        id: vu.id,
        amount: Number(vu.amount),
        voucher_code: vu.voucher_code,
        created_at: vu.created_at,
        expiration_date: vu.expiration_date,
        source: vu.source,
        external_reference: vu.external_reference,
        notes: vu.notes,
        buyer_name: vu.buyer_name,
        buyer_surname: vu.buyer_surname,
        buyer_phone: vu.buyer_phone,
        buyer_email: vu.buyer_email,
        recipient_name: vu.recipient_name,
        recipient_surname: vu.recipient_surname,
        recipient_phone: vu.recipient_phone,
        recipient_email: vu.recipient_email,
      })),
    });
  } catch (err) {
    console.error("GET /api/bookings/[id]/payments-detail error", err);
    return NextResponse.json({ error: "Failed to load payment detail" }, { status: 500 });
  }
}
