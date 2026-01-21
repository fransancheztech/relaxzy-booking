import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { page, limit, searchTerm, sort } = await req.json();

    const where = {
      deleted_at: null,
      ...(searchTerm && {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { short_name: { contains: searchTerm, mode: "insensitive" } },
          { notes: { contains: searchTerm, mode: "insensitive" } },
        ],
      }),
    };

    const [services, total] = await Promise.all([
      prisma.services_names.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: {
          [sort?.field ?? "name"]: sort?.sort ?? "desc",
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
      }),
      prisma.services_names.count({ where }),
    ]);

    const rows = services.map((service) => ({
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

    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("Error fetching services catalog:", error);
    return NextResponse.json(
      { error: "Error fetching services" },
      { status: 500 }
    );
  }
}
