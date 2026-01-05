import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/services
// Returns service names with their available durations and prices
export async function GET() {
  try {
    const services = await prisma.services_names.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        services_details: {
          where: {
            deleted_at: null,
            services_durations: {
              deleted_at: null,
            },
          },
          include: {
            services_durations: true,
          },
          orderBy: {
            services_durations: {
              duration: "asc",
            },
          },
        },
      },
    });

    const formatted = services.map((service) => ({
      id: service.id,
      name: service.name,
      short_name: service.short_name,
      notes: service.notes,

      durations: service.services_details.map((detail) => ({
        service_details_id: detail.id,

        duration_id: detail.services_durations.id,
        duration_minutes: Number(detail.services_durations.duration),
        duration_notes: detail.services_durations.notes,

        price: Number(detail.price),
        notes: detail.notes,
      })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching services catalog:", error);
    return NextResponse.json(
      { error: "Error fetching services" },
      { status: 500 }
    );
  }
}
