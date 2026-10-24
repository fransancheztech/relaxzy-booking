// app/api/bookings/range/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    const bookings = await prisma.bookings.findMany({
      where: {
        deleted_at: null, // ← only active bookings
        start_time: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      include: {
        clients: {
          where: { deleted_at: null }, // ← only active clients
        },
        services_names: {
          where: { deleted_at: null }, // ← only active services
        },
      },
      orderBy: { start_time: "asc" },
    });

    const bookingIds = bookings.map((b) => b.id);
    const paidMap = new Map<string, number>();
    // What was paid with each method (net of refunds), for the coloured bar on each calendar card.
    const byMethod = new Map<string, { cash: number; card: number; voucher: number }>();
    const methodsOf = (id: string) => {
      let m = byMethod.get(id);
      if (!m) byMethod.set(id, (m = { cash: 0, card: 0, voucher: 0 }));
      return m;
    };

    if (bookingIds.length > 0) {
      const [cashCardRows, voucherRows] = await Promise.all([
        prisma.$queryRaw<{ booking_id: string; method: string | null; total: number }[]>`
          SELECT p.booking_id::text, pe.method::text AS method,
            (COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0) -
             COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0))::float AS total
          FROM payment_events pe
          JOIN payments p ON p.id = pe.payment_id
          WHERE p.booking_id::text = ANY(${bookingIds})
            AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
          GROUP BY p.booking_id, pe.method
        `,
        prisma.$queryRaw<{ booking_id: string; total: number }[]>`
          SELECT booking_id::text, COALESCE(SUM(amount), 0)::float AS total
          FROM voucher_uses
          WHERE booking_id::text = ANY(${bookingIds})
            AND deleted_at IS NULL
          GROUP BY booking_id
        `,
      ]);
      for (const row of cashCardRows) {
        paidMap.set(row.booking_id, (paidMap.get(row.booking_id) ?? 0) + Number(row.total));
        if (row.method === "cash") methodsOf(row.booking_id).cash += Number(row.total);
        else if (row.method === "credit_card") methodsOf(row.booking_id).card += Number(row.total);
      }
      for (const row of voucherRows) {
        paidMap.set(row.booking_id, (paidMap.get(row.booking_id) ?? 0) + Number(row.total));
        methodsOf(row.booking_id).voucher += Number(row.total);
      }
    }

    const formatted = bookings.map((b) => ({
      id: b.id,

      client_name: b.clients?.client_name ?? (b.client_id ? "Unknown" : "Walk-in"),
      client_surname: b.clients?.client_surname ?? null,
      client_phone: b.clients?.client_phone ?? null,
      client_email: b.clients?.client_email ?? null,

      service_name: b.services_names?.name ?? "Unknown",
      short_service_name: b.services_names?.short_name ?? null,

      start_time: b.start_time,
      end_time: b.end_time,

      notes: b.notes ?? "",
      status: b.status,

      created_at: b.created_at,
      updated_at: b.updated_at,

      price: b.price,
      therapist_id: b.therapist_id ?? null,
      therapist_requested: b.therapist_requested,
      paid_total: paidMap.get(b.id) ?? 0,
      paid_by_method: byMethod.get(b.id) ?? { cash: 0, card: 0, voucher: 0 },
      booking_group_id: b.booking_group_id,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching bookings in range:", error);
    return NextResponse.json(
      { error: "Error fetching bookings in range" },
      { status: 500 }
    );
  }
}
