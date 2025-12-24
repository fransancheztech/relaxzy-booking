import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PROTECTED_FIELDS } from "@/constants";
import { PROTECTED_FIELDS_FOR_EDIT_BOOKING } from "@/constants";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const body = await req.json();

    let service_id: string | null = null;

    // ---------------------------------------------------
    // 1. RESOLVE service_id from service_name or short_service_name
    // ---------------------------------------------------
    if (body.service_name || body.short_service_name) {
      const service = await prisma.services.findFirst({
        where: {
          OR: [
            { name: body.service_name ?? undefined },
            { short_name: body.short_service_name ?? undefined }
          ]
        }
      });

      if (!service) {
        return NextResponse.json(
          { error: `No service found matching name "${body.service_name}" or short "${body.short_service_name}"` },
          { status: 400 }
        );
      }

      service_id = service.id;
    }

    // ---------------------------------------------------
    // 2. BUILD safedata only with allowed fields
    // ---------------------------------------------------
    const allowedFields = new Set([
      "client_id",
      "service_id",
      "start_time",
      "end_time",
      "price",
      "notes",
      "status",
    ]);

    const safeData: any = {};

    for (const key of Object.keys(body)) {
      if (
        allowedFields.has(key) &&
        !PROTECTED_FIELDS.has(key) &&
        !PROTECTED_FIELDS_FOR_EDIT_BOOKING.has(key)
      ) {
        safeData[key] = body[key];
      }
    }

    if (service_id) {
      safeData.service_id = service_id;
    }

    console.log("SAFEDATA SENT TO DB:", safeData);

    // ---------------------------------------------------
    // 3. UPDATE only if booking is NOT deleted
    // ---------------------------------------------------
    const updated = await prisma.bookings.update({
      where: { 
        id,
        deleted_at: null,   // <----- IMPORTANT
      },
      data: {
        ...safeData,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error: any) {
    console.error("PUT /bookings/[id] error:", error);

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Booking not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update booking", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    // ---------------------------------------------------
    // SOFT DELETE: update deleted_at instead of delete()
    // ---------------------------------------------------
    const deleted = await prisma.bookings.update({
      where: {
        id,
        deleted_at: null,  // only delete if not already deleted
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return NextResponse.json(deleted, { status: 200 });

  } catch (error: any) {
    console.error("DELETE /bookings/[id] error:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete booking", details: error.message },
      { status: 500 }
    );
  }
}
