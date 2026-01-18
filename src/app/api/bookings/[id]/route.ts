import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PROTECTED_FIELDS } from "@/constants";
import { PROTECTED_FIELDS_FOR_EDIT_BOOKING } from "@/constants";

type Body = {
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
  start_time: string; // ISO
  duration?: string | number; // minutes
  service_name: string;
  notes?: string;
  price?: string | number;
  totalPaid?: string | number;
};

const normalize = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

/* ======================================================
   GET /api/bookings/[id]
   ====================================================== */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 },
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
          surname: booking.clients.client_surname,
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
      { status: 500 },
    );
  }
}

/* ======================================================
   PUT /api/bookings/[id]
   ====================================================== */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 },
      );
    }

    const body: Body = await req.json();

    // ------------------------------------------------------
    // 5) FIND OR CREATE CLIENT (allows anonymous walk-ins)
    // ------------------------------------------------------
    let clientId: string | null = null;

    const hasClientInfo =
      body.client_name ||
      body.client_email ||
      body.client_phone ||
      body.client_surname;

    let clientWasCreated = false;

    /* -----------------------------
       Whitelisted update fields
       ----------------------------- */
    const allowedBookingFields = new Set([
      "start_time",
      "end_time",
      "price",
      "notes",
      "status",
    ]);

    const bookingData: Record<string, any> = {};

    for (const [key, value] of Object.entries(body) as [
      keyof Body,
      Body[keyof Body],
    ][]) {
      if (allowedBookingFields.has(key) && !PROTECTED_FIELDS.has(key)) {
        bookingData[key] = value;
      }
    }

    // Check if client fields are explicitly being cleared (empty strings or null/undefined)
    const wantsToRemoveClient =
      (body.client_name === "" || body.client_name == null) &&
      (body.client_surname === "" || body.client_surname == null) &&
      (body.client_email === "" || body.client_email == null) &&
      (body.client_phone === "" || body.client_phone == null);

    /* -----------------------------
       Update (soft-delete aware)
       ----------------------------- */
    const updated = await prisma.$transaction(async (tx) => {
      /* -----------------------------
       Resolve service_id
       ----------------------------- */
      let resolvedServiceId: string | null = null;

      if (body.service_name && body.service_name.trim() !== "") {
        const service = await tx.services_names.findFirst({
          where: { name: body.service_name ?? undefined, deleted_at: null },
        });

        if (!service) {
          throw new Error(
            `No service found matching name "${body.service_name}"`,
          );
        }

        resolvedServiceId = service.id;
      }
      // CLIENT UPDATE (if needed)
      if (wantsToRemoveClient) {
        bookingData.client_id = null;
      } else if (hasClientInfo) {
        if (!body.client_name) throw new Error("Client name is required");

        if (!body.client_email && !body.client_phone)
          throw new Error("Provide at least a phone or email for the client");

        // find by email
        if (body.client_email) {
          const client = await tx.clients.findFirst({
            where: { client_email: body.client_email, deleted_at: null },
          });
          clientId = client?.id ?? null;
        }

        // find by phone
        if (!clientId && body.client_phone) {
          const client = await tx.clients.findFirst({
            where: { client_phone: body.client_phone, deleted_at: null },
          });
          clientId = client?.id ?? null;
        }

        // create if needed
        if (!clientId) {
          const client = await tx.clients.create({
            data: {
              client_name: body.client_name,
              client_surname: normalize(body.client_surname),
              client_email: normalize(body.client_email),
              client_phone: normalize(body.client_phone),
            },
          });

          clientId = client.id;
          clientWasCreated = true;
        }

        // update only if existing
        if (clientId && hasClientInfo && !clientWasCreated) {
          await tx.clients.update({
            where: { id: clientId },
            data: {
              client_name: body.client_name,
              client_surname: normalize(body.client_surname),
              client_email: normalize(body.client_email),
              client_phone: normalize(body.client_phone),
            },
          });
        }
      }

      // BOOKING UPDATE
      if (resolvedServiceId) bookingData.service_id = resolvedServiceId;
      if (clientId) bookingData.client_id = clientId;

      return tx.bookings.update({
        where: {
          id,
          deleted_at: null,
        },
        data: {
          ...bookingData,
          updated_at: new Date(),
        },
      });
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("PUT /bookings/[id] error:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update booking", details: error.message },
      { status: 400 },
    );
  }
}

/* ======================================================
   DELETE /api/bookings/[id]
   ====================================================== */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid booking ID" },
        { status: 400 },
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
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete booking", details: error.message },
      { status: 500 },
    );
  }
}
