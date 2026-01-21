import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BaseServiceSchema } from "@/schemas/service.schema";

type Params = {
  params: { id: string };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const service = await prisma.services_names.findFirst({
      where: {
        id: params.id,
        deleted_at: null,
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

    if (!service) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
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
    console.error("Error loading service:", error);
    return NextResponse.json(
      { error: "Error loading service" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const parsed = BaseServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { name, short_name, notes, duration_prices } = parsed.data;
    const serviceNameId = params.id;

    await prisma.$transaction(async (tx) => {
      /* 1️⃣ Update service name */
      await tx.services_names.update({
        where: { id: serviceNameId },
        data: {
          name,
          short_name,
          notes,
        },
      });

      /* 2️⃣ Load existing details */
      const existingDetails = await tx.services_details.findMany({
        where: {
          service_name_id: serviceNameId,
          deleted_at: null,
        },
        include: {
          services_durations: true,
        },
      });

      const incomingDurations = duration_prices.map((d) => d.duration);

      /* 3️⃣ Soft-delete removed durations */
      const toDelete = existingDetails.filter(
        (d) =>
          !incomingDurations.includes(Number(d.services_durations.duration)),
      );

      if (toDelete.length) {
        await tx.services_details.updateMany({
          where: {
            id: { in: toDelete.map((d) => d.id) },
          },
          data: { deleted_at: new Date() },
        });
      }

      /* 4️⃣ Upsert durations + details */
      for (const item of duration_prices) {
        // 4.1 Ensure duration exists
        const durationRow = await tx.services_durations.upsert({
          where: {
            duration: item.duration,
          },
          update: {
            deleted_at: null,
          },
          create: {
            duration: item.duration,
          },
        });

        // 4.2 Check if detail exists
        const existingDetail = existingDetails.find(
          (d) => d.service_duration_id === durationRow.id,
        );

        if (existingDetail) {
          // update price / notes
          await tx.services_details.update({
            where: { id: existingDetail.id },
            data: {
              price: item.price,
            },
          });
        } else {
          // create new detail
          await tx.services_details.create({
            data: {
              service_name_id: serviceNameId,
              service_duration_id: durationRow.id,
              price: item.price,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: "Error updating service" },
      { status: 500 },
    );
  }
}
