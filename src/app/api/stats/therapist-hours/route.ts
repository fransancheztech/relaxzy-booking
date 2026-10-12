import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { canViewHours, isHoursLookbackLimited, therapistHoursFloor } from "@/lib/hours/window";

export async function GET(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Receptionists have no Hours page, so the endpoint must not serve them either.
    if (!canViewHours(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: "from and to params required" }, { status: 400 });
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    // The therapist lookback floor is enforced HERE, not in the date pickers: `from` arrives
    // from the query string, so a UI-only limit would be bypassed by editing the URL.
    // Admins get no floor and can query back to the beginning.
    const floor = isHoursLookbackLimited(role) ? therapistHoursFloor() : null;
    const effectiveFrom = floor && from < floor ? floor : from;

    // A range entirely below the floor collapses to nothing once clamped; short-circuit
    // rather than sending Postgres an inverted window.
    if (effectiveFrom >= to) {
      return NextResponse.json({ rows: [] });
    }

    const rows = await prisma.$queryRaw<
      { therapist_id: string; full_name: string; booking_count: number; total_hours: number }[]
    >`
      SELECT
        t.id::text          AS therapist_id,
        COALESCE(NULLIF(BTRIM(t.nickname), ''), NULLIF(BTRIM(t.name), ''), NULLIF(BTRIM(t.surname), ''), '—') AS full_name,
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
        AND b.start_time   >= ${effectiveFrom}
        AND b.start_time   <  ${to}
      -- Includes inactive/deleted therapists (symmetric with the Tips section);
      -- the INNER JOIN already limits to therapists with completed bookings in range.
      GROUP BY t.id
      ORDER BY full_name ASC
    `;

    return NextResponse.json({
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
