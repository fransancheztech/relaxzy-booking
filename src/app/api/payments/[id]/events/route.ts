import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/* ======================================================
   GET /api/payment/[id]/events
   ====================================================== */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const payment = await prisma.payments.findUnique({
      where: { id },
      include: {
        payment_events: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment.payment_events);
  } catch (error) {
    console.error("GET /payments/[id]/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment events" },
      { status: 500 }
    );
  }
}
