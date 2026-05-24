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
      voucherPayment = 0,
      voucherCode,
    } = await req.json();

    if (cashPayment <= 0 && cardPayment <= 0 && voucherPayment <= 0) {
      return NextResponse.json(
        { error: "At least one payment must be greater than zero" },
        { status: 400 }
      );
    }

    const performed_by = await getCurrentUserId();

    // ---------------------------------------------------
    // 1. Ensure booking exists
    // ---------------------------------------------------
    const booking = await prisma.bookings.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, price: true, client_id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot add payments to a cancelled booking" },
        { status: 409 }
      );
    }

    // ---------------------------------------------------
    // 2. Resolve voucher if needed
    // ---------------------------------------------------
    let voucherId: string | null = null;

    if (voucherPayment > 0) {
      if (!voucherCode?.trim()) {
        return NextResponse.json(
          { error: "Voucher code is required" },
          { status: 400 }
        );
      }

      if (!booking.client_id) {
        return NextResponse.json(
          { error: "Cannot apply a voucher to an anonymous booking" },
          { status: 400 }
        );
      }

      const voucher = await prisma.vouchers.findFirst({
        where: { code: voucherCode.trim().toUpperCase(), deleted_at: null },
        select: { id: true, balance: true, expiration_date: true },
      });

      if (!voucher) {
        return NextResponse.json(
          { error: "Voucher not found" },
          { status: 404 }
        );
      }

      if (voucher.expiration_date < new Date()) {
        return NextResponse.json(
          { error: "Voucher has expired" },
          { status: 400 }
        );
      }

      if (Number(voucher.balance ?? 0) < voucherPayment) {
        return NextResponse.json(
          { error: "Insufficient voucher balance" },
          { status: 400 }
        );
      }

      voucherId = voucher.id;
    }

    // ---------------------------------------------------
    // 3. Compute already-paid amount (cash/card + voucher)
    // ---------------------------------------------------
    const [paymentsAgg, voucherUsesAgg] = await Promise.all([
      prisma.payments.aggregate({
        where: { booking_id: id },
        _sum: { amount: true },
      }),
      prisma.voucher_uses.aggregate({
        where: { booking_id: id, deleted_at: null },
        _sum: { amount: true },
      }),
    ]);

    const alreadyPaid =
      Number(paymentsAgg._sum.amount ?? 0) +
      Number(voucherUsesAgg._sum.amount ?? 0);
    const incomingTotal = cashPayment + cardPayment + voucherPayment;

    // Compare in integer cents to avoid JS float drift (0.1 + 0.2 = 0.30000000000000004).
    // Round half-away-from-zero, matching how the DB stores numeric(10, 2).
    const toCents = (n: number) => Math.round(n * 100);
    if (
      booking.price !== null &&
      toCents(alreadyPaid + incomingTotal) > toCents(Number(booking.price))
    ) {
      return NextResponse.json(
        { error: "Total payment exceeds booking price" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------
    // 4. Register all payments atomically
    // ---------------------------------------------------
    await prisma.$transaction(async (tx) => {
      if (cashPayment > 0) {
        await tx.$queryRaw`
          SELECT register_payment_event(
            'CHARGE'::payment_types,
            ${cashPayment}::numeric,
            'cash'::payment_methods,
            ${performed_by}::uuid,
            NULL::text,
            ${id}::uuid,
            NULL::uuid
          )
        `;
      }

      if (cardPayment > 0) {
        await tx.$queryRaw`
          SELECT register_payment_event(
            'CHARGE'::payment_types,
            ${cardPayment}::numeric,
            'credit_card'::payment_methods,
            ${performed_by}::uuid,
            NULL::text,
            ${id}::uuid,
            NULL::uuid
          )
        `;
      }

      if (voucherPayment > 0 && voucherId) {
        await tx.$queryRaw`
          SELECT register_voucher_use(
            ${voucherId}::uuid,
            'CHARGE',
            ${voucherPayment}::numeric,
            ${booking.client_id}::uuid,
            ${performed_by}::uuid,
            NULL::text,
            ${id}::uuid
          )
        `;
      }
    });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    console.error("POST /bookings/[id]/payment error:", error);

    return NextResponse.json(
      { error: "Failed to register payment" },
      { status: 500 }
    );
  }
}
