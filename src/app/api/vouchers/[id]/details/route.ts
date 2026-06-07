import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const voucher = await prisma.vouchers.findFirst({ where: { id, deleted_at: null } });

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    const [buyer, recipient, paymentEvents, voucherUses] = await Promise.all([
      prisma.clients.findFirst({
        where: { id: voucher.buyer_id, deleted_at: null },
        select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
      }),
      voucher.recipient_id && voucher.recipient_id !== voucher.buyer_id
        ? prisma.clients.findFirst({
            where: { id: voucher.recipient_id, deleted_at: null },
            select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
          })
        : Promise.resolve(null),
      prisma.payment_events.findMany({
        where: {
          deleted_at: null,
          payments: { voucher_id: id, deleted_at: null },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.voucher_uses.findMany({
        where: { voucher_id: id, deleted_at: null },
        orderBy: { created_at: "desc" },
      }),
    ]);

    // Enrich each use that has a booking with that booking's context, so the dialog
    // can show a human-readable reference (and link to it) instead of a raw UUID.
    const bookingIds = [
      ...new Set(voucherUses.map((u) => u.booking_id).filter((b): b is string => !!b)),
    ];
    const bookings = bookingIds.length
      ? await prisma.bookings.findMany({
          where: { id: { in: bookingIds } },
          select: {
            id: true,
            start_time: true,
            deleted_at: true,
            clients: { select: { client_name: true, client_surname: true } },
            services_names: { select: { name: true, short_name: true } },
          },
        })
      : [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    const usesWithBooking = voucherUses.map((u) => {
      const b = u.booking_id ? bookingMap.get(u.booking_id) : undefined;
      return {
        ...u,
        booking: b
          ? {
              id: b.id,
              start_time: b.start_time,
              deleted: !!b.deleted_at,
              client_name:
                [b.clients?.client_name, b.clients?.client_surname]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || null,
              service_name: b.services_names?.short_name ?? b.services_names?.name ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({
      voucher,
      buyer,
      recipient,
      paymentEvents,
      voucherUses: usesWithBooking,
    });
  } catch (err) {
    console.error("Error fetching voucher details", err);
    return NextResponse.json(
      { error: "Error fetching voucher details" },
      { status: 500 },
    );
  }
}
