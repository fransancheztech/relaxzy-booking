import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PROTECTED_FIELDS } from "@/constants";
import { PROTECTED_FIELDS_FOR_EDIT_BOOKING } from "@/constants";

/* ======================================================
   GET /api/bookings/[id]
   ====================================================== */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    const booking = await prisma.bookings.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
            payment_events: {
              where: {
                deleted_at: null,
              },
            },
          },
        },
        clients: true,
        services_names: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    /* -----------------------------
       Aggregate payments safely
       ----------------------------- */

    const paidCash = booking.payments
      .flatMap((p) => p.payment_events)
      .filter((e) => e.method === "cash")
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    const paidCard = booking.payments
      .flatMap((p) => p.payment_events)
      .filter((e) => e.method === "credit_card")
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    /* -----------------------------
       Normalize nullable client
       ----------------------------- */
    const client = booking.clients
      ? {
          id: booking.clients.id,
          name: booking.clients.client_name,
          email: booking.clients.client_email,
          phone: booking.clients.client_phone,
          notes: booking.clients.client_notes,
        }
      : null;

    const services_names = booking.services_names
      ? {
          id: booking.services_names.id,
          name: booking.services_names.name,
          notes: booking.services_names.notes,
        }
      : null;

    return NextResponse.json({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      notes: booking.notes,
      status: booking.status,
      price: booking.price,
      client,
      services_names,
      paidCash,
      paidCard,
    });
  } catch (error) {
    console.error("GET /bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

/* ======================================================
   PUT /api/bookings/[id]
   ====================================================== */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // console.log(JSON.stringify(body, null, 2))

    let service_id: string | null = null;

    /* -----------------------------
       Resolve service_id
       ----------------------------- */
    if (body.service_name || body.short_service_name) {
      const service = await prisma.services_names.findFirst({
        where: {
          OR: [
            { name: body.service_name ?? undefined },
            { short_name: body.short_service_name ?? undefined },
          ],
        },
      });

      if (!service) {
        return NextResponse.json(
          {
            error: `No service found matching name "${body.service_name}" or short "${body.short_service_name}"`,
          },
          { status: 400 }
        );
      }

      service_id = service.id;
    }

    /* -----------------------------
       Whitelisted update fields
       ----------------------------- */
    const allowedFields = new Set([
      "client_id",
      "service_id",
      // "client_name",
      // "client_surname",
      // "client_phone",
      // "client_email", TO-DO this need to be enabled to allow client finding or creation on booking updating
      "start_time",
      "end_time",
      "price",
      "notes",
      "status",
    ]);

    const safeData: Record<string, any> = {};

    for (const key of Object.keys(body)) {
      if (
        allowedFields.has(key) &&
        !PROTECTED_FIELDS.has(key)
      ) {
        safeData[key] = body[key];
      }
    }

    if (service_id) {
      safeData.service_id = service_id;
    }

    /* -----------------------------
       Update (soft-delete aware)
       ----------------------------- */
    const updated = await prisma.bookings.update({
      where: {
        id,
        deleted_at: null,
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
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update booking", details: error.message },
      { status: 500 }
    );
  }
}

/* ======================================================
   DELETE /api/bookings/[id]
   ====================================================== */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 }
      );
    }

    const deleted = await prisma.bookings.update({
      where: {
        id,
        deleted_at: null,
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
