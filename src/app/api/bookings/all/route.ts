import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// /api/bookings/all
export async function GET() {
  try {
    const bookings = await prisma.bookings.findMany({
      where: {
        deleted_at: null, // ⬅️ Only active bookings
      },
      include: {
        clients: {
          where: { deleted_at: null }, // ⬅️ Only active clients
        },
        services_names: {
          where: { deleted_at: null }, // ⬅️ Only active services
        },
        payments: {
          where: { deleted_at: null }, // ⬅️ Only active services
        },
      },
      orderBy: {
        start_time: "asc",
      },
    });

    const formatted = bookings.map((b) => ({
      id: b.id,
      client_name: b.clients?.client_name ?? "Unknown",
      client_surname: b.clients?.client_surname ?? null,
      service_name: b.services_names?.name ?? "Unknown",
      start_time: b.start_time,
      end_time: b.end_time,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Error fetching bookings" },
      { status: 500 }
    );
  }
}
