import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, start_time, end_time, service_name, notes, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    }

    // ------------------------------------------------------
    // Build update payload
    // ------------------------------------------------------
    const data: any = {};

    if (start_time) data.start_time = new Date(start_time);
    if (end_time) data.end_time = new Date(end_time);
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) data.status = status;

    // ------------------------------------------------------
    // Update service (services_names)
    // ------------------------------------------------------
    if (service_name) {
      const serviceName = await prisma.services_names.findFirst({
        where: {
          name: service_name,
          deleted_at: null,
        },
      });

      if (!serviceName) {
        return NextResponse.json(
          { error: `Service "${service_name}" not found` },
          { status: 400 }
        );
      }

      data.service_id = serviceName.id;
    }

    // ------------------------------------------------------
    // Update booking (only if not soft-deleted)
    // ------------------------------------------------------
    const updated = await prisma.bookings.updateMany({
      where: {
        id,
        deleted_at: null,
      },
      data,
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Booking not found or deleted" },
        { status: 404 }
      );
    }

    // ------------------------------------------------------
    // Fetch updated booking
    // ------------------------------------------------------
    const booking = await prisma.bookings.findFirst({
      where: { id },
      include: {
        clients: true,
        services_names: true,
      },
    });

    return NextResponse.json({ booking });
  } catch (err: any) {
    console.error("Error updating booking:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
