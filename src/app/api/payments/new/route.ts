import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.booking_id) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!["cash", "credit_card"].includes(body.method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    if (!["CHARGE", "REFUND"].includes(body.payment_type)) {
      return NextResponse.json(
        { error: "Invalid payment type" },
        { status: 400 }
      );
    }

    // 🔐 Resolve identity server-side
    const performed_by = await getCurrentUserId();

    const result = await prisma.$queryRaw<{ register_payment_event: string }[]>`
      SELECT register_payment_event(
        ${body.booking_id}::uuid,
        ${body.payment_type}::payment_types,
        ${body.amount}::numeric,
        ${body.method}::payment_methods,
        ${performed_by}::uuid
      )
    `;

    return NextResponse.json({
      payment_id: result[0].register_payment_event,
    });
  } catch (err) {
    console.error("Create payment error:", err);
    return NextResponse.json(
      { error: "Error creating payment" },
      { status: 500 }
    );
  }
}
