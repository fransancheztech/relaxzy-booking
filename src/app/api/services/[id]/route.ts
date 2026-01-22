import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BaseServiceSchema } from "@/schemas/service.schema";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const service = await prisma.services_names.findFirst({
      where: { id, deleted_at: null },
      include: {
        services_details: {
          where: { deleted_at: null },
          include: { services_durations: true },
          orderBy: { services_durations: { duration: "asc" } },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: service.name,
      short_name: service.short_name ?? "",
      notes: service.notes ?? "",
      duration_prices: service.services_details.map((d) => ({
        duration: Number(d.services_durations.duration),
        price: Number(d.price),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error loading service" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = BaseServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
    }

    const { name, short_name, notes, duration_prices } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.services_names.update({
        where: { id },
        data: { name, short_name, notes },
      });

      const existingDetails = await tx.services_details.findMany({
        where: { service_name_id: id, deleted_at: null },
        include: { services_durations: true },
      });

      const incomingDurations = duration_prices.map((d) => d.duration);

      // Soft-delete removed
      const toDelete = existingDetails.filter(
        (d) => !incomingDurations.includes(Number(d.services_durations.duration))
      );
      if (toDelete.length) {
        await tx.services_details.updateMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
          data: { deleted_at: new Date() },
        });
      }

      // Upsert durations + details
      for (const item of duration_prices) {
        const durationRow = await tx.services_durations.upsert({
          where: { duration: item.duration },
          update: { deleted_at: null },
          create: { duration: item.duration },
        });

        const existingDetail = existingDetails.find(
          (d) => d.service_duration_id === durationRow.id
        );

        if (existingDetail) {
          await tx.services_details.update({
            where: { id: existingDetail.id },
            data: { price: item.price },
          });
        } else {
          await tx.services_details.create({
            data: {
              service_name_id: id,
              service_duration_id: durationRow.id,
              price: item.price,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error updating service" }, { status: 500 });
  }
}
