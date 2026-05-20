import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await req.json();
    const { notes } = body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return NextResponse.json(
        { error: "A reason note is required" },
        { status: 400 }
      );
    }

    const event = await prisma.payment_events.findFirst({
      where: { id: eventId, deleted_at: null },
      select: { id: true, payment_id: true, type: true, amount: true, notes: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Payment event not found" }, { status: 404 });
    }

    if (event.type !== "CHARGE") {
      return NextResponse.json(
        { error: "Only CHARGE events can be removed" },
        { status: 400 }
      );
    }

    const performed_by = await getCurrentUserId();
    const amount =
      typeof event.amount === "number"
        ? event.amount
        : (event.amount as any)?.toNumber?.() ?? 0;

    const updatedNotes = event.notes
      ? `${event.notes} [Removed by ${performed_by}: ${notes.trim()}]`
      : `[Removed by ${performed_by}: ${notes.trim()}]`;

    await prisma.$transaction(async (tx) => {
      await tx.payment_events.update({
        where: { id: eventId },
        data: { deleted_at: new Date(), notes: updatedNotes },
      });

      if (event.payment_id) {
        await tx.payments.update({
          where: { id: event.payment_id },
          data: { amount: { decrement: amount } },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /payment-events/[id]/remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove payment event" },
      { status: 500 }
    );
  }
}
