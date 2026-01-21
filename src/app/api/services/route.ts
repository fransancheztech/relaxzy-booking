import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BaseServiceSchema } from "@/schemas/service.schema";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BaseServiceSchema.parse(body);

    const { name, short_name, notes, duration_prices } = parsed;

    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Create service name
      const service = await tx.services_names.create({
        data: {
          name,
          short_name: short_name || null,
          notes: notes || null,
        },
      });

      // 2️⃣ Create durations + prices
      for (const item of duration_prices) {
        const duration = await tx.services_durations.upsert({
          where: {
            duration: item.duration,
          },
          update: {
            deleted_at: null, // revive if soft-deleted
          },
          create: {
            duration: item.duration,
          },
        });

        await tx.services_details.create({
          data: {
            service_name_id: service.id,
            service_duration_id: duration.id,
            price: item.price,
          },
        });
      }

      return service;
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating service:", error);

    return NextResponse.json(
      { error: error?.message ?? "Error creating service" },
      { status: 500 }
    );
  }
}
