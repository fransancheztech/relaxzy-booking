import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(req: Request) {
  try {
    const { start, end } = await req.json();

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    if (startDate > new Date()) {
      return NextResponse.json({ error: "Cannot close a future day" }, { status: 400 });
    }

    const performed_by = await getCurrentUserId();
    const result = await prisma.$transaction(async (tx) => {
      // Attribute the bookings_history rows the trigger writes for the completed bookings.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by}, true)`;
      return tx.bookings.updateMany({
        where: {
          deleted_at: null,
          status: "confirmed",
          start_time: { gte: startDate, lt: endDate },
        },
        data: {
          status: "completed",
          updated_at: new Date(),
        },
      });
    });

    return NextResponse.json({ updated: result.count });
  } catch (err) {
    console.error("POST /api/bookings/batch-complete error", err);
    return NextResponse.json({ error: "Failed to close day" }, { status: 500 });
  }
}
