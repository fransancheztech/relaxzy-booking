import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { payment_methods } from "generated/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // <--- params is a Promise
) {
  try {
    const { id: paymentId } = await params; // <--- unwrap it

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { amount, method, notes } = body;

    // -------------------------------
    // Basic validation
    // -------------------------------

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Refund amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!method || !Object.values(payment_methods).includes(method)) {
      return NextResponse.json(
        { error: "A known refund method is required" },
        { status: 400 }
      );
    }

    // 🔐 Resolve identity server-side
    const performed_by = await getCurrentUserId();

    // -------------------------------
    // Ensure payment exists
    // -------------------------------
    const payment = await prisma.payments.findFirst({
      where: { id: paymentId, deleted_at: null },
      select: { id: true, booking_id: true, amount: true },
    });

    if (!payment || !payment.booking_id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // -------------------------------
    // Calculate refundable amount
    // -------------------------------
    const totalPaid =
      typeof payment.amount === "number"
        ? payment.amount
        : (payment.amount?.toNumber() ?? 0);

    if (amount > totalPaid) {
      return NextResponse.json(
        {
          error: "Refund amount exceeds remaining refundable balance",
          totalPaid,
        },
        { status: 400 }
      );
    }

    // -------------------------------
    // Create refund event
    // -------------------------------
    await prisma.$queryRaw`
      SELECT register_payment_event(
        ${payment.booking_id}::uuid,
        'REFUND'::payment_types,
        ${amount}::numeric,
        ${method}::payment_methods,
        ${performed_by}::uuid,
        ${notes ?? null}::text
      )
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /payments/[id]/refund error:", error);

    return NextResponse.json(
      { error: "Failed to register refund" },
      { status: 500 }
    );
  }
}
