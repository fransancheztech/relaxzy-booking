import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

// Edit a payment event's created_at (its "payment date"). Delicate: it moves the day this
// money is counted in payment-basis totals (Stats / Daily Totals). Date-only — the original
// time-of-day is preserved. Wrapped in a transaction that sets app.user_id so the audit-log
// trigger records who changed it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const { date } = await req.json();

    if (!date || typeof date !== "string") {
      return NextResponse.json({ error: "A date is required" }, { status: 400 });
    }
    const picked = DateTime.fromISO(date).setZone(BUSINESS_TIMEZONE);
    if (!picked.isValid) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const event = await prisma.payment_events.findFirst({
      where: { id: eventId, deleted_at: null },
      select: { id: true, created_at: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Payment event not found" }, { status: 404 });
    }

    // Keep the original wall-clock time (Madrid); swap only the calendar day.
    const orig = DateTime.fromJSDate(event.created_at).setZone(BUSINESS_TIMEZONE);
    const newCreatedAt = picked
      .set({ hour: orig.hour, minute: orig.minute, second: orig.second, millisecond: orig.millisecond })
      .toJSDate();

    const performed_by = await getCurrentUserId();

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by ?? ""}, true)`;
      await tx.payment_events.update({
        where: { id: eventId },
        data: { created_at: newCreatedAt },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /payment-events/[id]/date error:", error);
    return NextResponse.json({ error: "Failed to update payment date" }, { status: 500 });
  }
}
