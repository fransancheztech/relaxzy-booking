import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export async function GET(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // expected: "YYYY-MM"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      { therapist_id: string; full_name: string; booking_count: number; total_hours: number }[]
    >`
      SELECT
        t.id::text          AS therapist_id,
        t.full_name,
        COUNT(b.id)::int    AS booking_count,
        COALESCE(
          SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600.0),
          0
        )::float            AS total_hours
      FROM therapists t
      INNER JOIN bookings b
        ON  b.therapist_id = t.id
        AND b.status       = 'completed'
        AND b.deleted_at   IS NULL
        AND DATE_TRUNC('month', b.start_time) = DATE_TRUNC('month', ${month + "-01"}::date)
      WHERE t.deleted_at IS NULL AND t.active = true
      GROUP BY t.id, t.full_name
      ORDER BY t.full_name ASC
    `;

    return NextResponse.json({
      month,
      rows: rows.map((r) => ({
        therapist_id: r.therapist_id,
        full_name: r.full_name,
        booking_count: Number(r.booking_count),
        total_hours: Math.round(Number(r.total_hours) * 10) / 10,
      })),
    });
  } catch (err) {
    console.error("GET /api/stats/therapist-hours error:", err);
    return NextResponse.json({ error: "Failed to load therapist hours" }, { status: 500 });
  }
}
