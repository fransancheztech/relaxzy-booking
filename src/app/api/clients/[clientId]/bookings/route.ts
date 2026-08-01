import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { therapistDisplayName } from "@/utils/therapistName";

// How many history rows to return. Ordered newest-first, so a cap only ever drops the
// OLDEST bookings — the most recent is always included. The panel is scrollable, and the
// summary reports the true total + last visit independently of this cap.
const HISTORY_LIMIT = 50;

const therapistSelect = { select: { id: true, nickname: true, name: true, surname: true } } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;

    const [rows, total, lastVisit] = await Promise.all([
      prisma.bookings.findMany({
        where: { client_id: clientId, deleted_at: null },
        orderBy: { start_time: "desc" },
        take: HISTORY_LIMIT,
        include: {
          therapists: therapistSelect,
          services_names: { select: { name: true, short_name: true } },
        },
      }),
      prisma.bookings.count({ where: { client_id: clientId, deleted_at: null } }),
      // "Last visit" = the most recent NON-cancelled booking (a cancellation isn't a visit),
      // computed independently so it's correct even if the newest row is a cancellation.
      prisma.bookings.findFirst({
        where: { client_id: clientId, deleted_at: null, status: { not: "cancelled" } },
        orderBy: { start_time: "desc" },
        include: { therapists: therapistSelect },
      }),
    ]);

    return NextResponse.json({
      total,
      lastVisit: lastVisit
        ? {
            start_time: lastVisit.start_time,
            therapist_name: lastVisit.therapists ? therapistDisplayName(lastVisit.therapists) : null,
          }
        : null,
      rows: rows.map((b) => ({
        id: b.id,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        price: b.price,
        service_name: b.services_names?.short_name ?? b.services_names?.name ?? null,
        therapist_name: b.therapists ? therapistDisplayName(b.therapists) : null,
      })),
    });
  } catch (err) {
    console.error("GET /api/clients/[clientId]/bookings error", err);
    return NextResponse.json({ error: "Failed to load client bookings" }, { status: 500 });
  }
}
