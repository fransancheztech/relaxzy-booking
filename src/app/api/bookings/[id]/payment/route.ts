import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    const {
      cashPayment = 0,
      cardPayment = 0,
      typePayment
    } = await req.json();

    // ---------------------------------------------------
    // 1. Validate payment values
    // ---------------------------------------------------
    if (cashPayment <= 0 && cardPayment <= 0) {
      return NextResponse.json(
        { error: "At least one payment must be greater than zero" },
        { status: 400 }
      );
    }

    // 🔐 Resolve identity server-side
    const performed_by = await getCurrentUserId();

    // ---------------------------------------------------
    // 2. Ensure booking exists
    // ---------------------------------------------------
    const booking = await prisma.bookings.findFirst({
      where: {
        id,
        deleted_at: null,
      },
      select: {
        id: true,
        price: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 }
      );
    }

    // ---------------------------------------------------
    // 3. Compute already-paid amount
    // ---------------------------------------------------
    const existingPayments = await prisma.payments.aggregate({
      where: { booking_id: id },
      _sum: { amount: true },
    });

    const alreadyPaid = Number(existingPayments._sum.amount ?? 0);
    const incomingTotal = cashPayment + cardPayment;

    if (alreadyPaid + incomingTotal > Number(booking.price)) {
      return NextResponse.json(
        { error: "Total payment exceeds booking price" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------
    // 4. Register payment events (atomic)
    // ---------------------------------------------------
    const operations = [];

    if (cashPayment > 0) {
      operations.push(
        prisma.$queryRaw`
          SELECT register_payment_event(
            ${id}::uuid,
            'CHARGE'::payment_types,
            ${cashPayment}::numeric,
            'cash'::payment_methods,
            ${performed_by}::uuid
          )
        `
      );
    }

    if (cardPayment > 0) {
      operations.push(
        prisma.$queryRaw`
          SELECT register_payment_event(
            ${id}::uuid,
            'CHARGE'::payment_types,
            ${cardPayment}::numeric,
            'credit_card'::payment_methods,
            ${performed_by}::uuid
          )
        `
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    console.error("POST /bookings/[id]/payment error:", error);

    return NextResponse.json(
      { error: "Failed to register payment" },
      { status: 500 }
    );
  }
}
