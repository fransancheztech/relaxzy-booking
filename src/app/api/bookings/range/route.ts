// app/api/bookings/range/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing date range" }, { status: 400 });
  }

  try {
    const bookings = await prisma.bookings.findMany({
      where: {
        deleted_at: null, // ← only active bookings
        start_time: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      include: {
        clients: {
          where: { deleted_at: null }, // ← only active clients
        },
        services_names: {
          where: { deleted_at: null }, // ← only active services
        },
      },
      orderBy: { start_time: "asc" },
    });

    const formatted = bookings.map((b) => ({
      id: b.id,

      client_name: b.clients?.client_name ?? "Unknown",
      client_surname: b.clients?.client_surname ?? null,
      client_phone: b.clients?.client_phone ?? null,
      client_email: b.clients?.client_email ?? null,

      service_name: b.services_names?.name ?? "Unknown",
      short_service_name: b.services_names?.short_name ?? null,

      start_time: b.start_time,
      end_time: b.end_time,

      notes: b.notes ?? "",
      status: b.status,

      created_at: b.created_at,
      updated_at: b.updated_at,

      price: b.price,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching bookings in range:", error);
    return NextResponse.json(
      { error: "Error fetching bookings in range" },
      { status: 500 }
    );
  }
}
