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
          COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float  AS refunded,
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
      }[]>`
        SELECT
          vu.id::text,
          vu.amount::float,
          v.code AS voucher_code,
          vu.created_at
        FROM voucher_uses vu
        LEFT JOIN vouchers v ON v.id = vu.voucher_id AND v.deleted_at IS NULL
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
      })),
    });
  } catch (err) {
    console.error("GET /api/bookings/[id]/payments-detail error", err);
    return NextResponse.json({ error: "Failed to load payment detail" }, { status: 500 });
  }
}
