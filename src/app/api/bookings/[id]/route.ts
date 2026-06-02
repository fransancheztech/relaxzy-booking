import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PROTECTED_FIELDS } from "@/constants";
import { ClientContactSchema } from "@/schemas/clientContact.schema";
import { formatZodError } from "@/utils/zodApiError";
import {
  applyClientSlot,
  ClientConflictError,
  detectClientConflict,
} from "@/lib/clients/resolveBookingClients";
import { CLIENT_CONTACT_TAKEN, CLIENT_NAME_CONFLICT } from "@/types/clientConflict";
import type { ClientResolution } from "@/types/clientConflict";
import { therapistDisplayName } from "@/utils/therapistName";

type Body = {
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
  start_time: string; // ISO
  duration?: string | number; // minutes
  service_name: string;
  therapist_id?: string;
  therapist_requested?: boolean;
  notes?: string;
  price?: string | number;
  totalPaid?: string | number;
  clientResolution?: ClientResolution;
};

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
        therapists: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    /* -----------------------------
       Aggregate payments safely
       ----------------------------- */

    // payment_events.amount is a positive magnitude; REFUND events subtract
    const signedAmount = (e: { type: string | null; amount: unknown }) =>
      (e.type === "REFUND" ? -1 : 1) * Number(e.amount ?? 0);

    const paidCash = booking.payments
      .flatMap((p) => p.payment_events)
      .filter((e) => e.method === "cash")
      .reduce((sum, e) => sum + signedAmount(e), 0);

    const paidCard = booking.payments
      .flatMap((p) => p.payment_events)
      .filter((e) => e.method === "credit_card")
      .reduce((sum, e) => sum + signedAmount(e), 0);

    const voucherUses = await prisma.voucher_uses.findMany({
      where: { booking_id: id, deleted_at: null },
      select: { amount: true },
    });
    const paidVoucher = voucherUses.reduce(
      (sum, v) => sum + Number(v.amount ?? 0),
      0,
    );

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

    const therapist = booking.therapists
      ? { id: booking.therapists.id, full_name: therapistDisplayName(booking.therapists) }
      : null;

    return NextResponse.json({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      notes: booking.notes,
      status: booking.status,
      price: booking.price,
      therapist_requested: booking.therapist_requested,
      booking_group_id: booking.booking_group_id,
      client,
      services_names,
      therapist,
      paidCash,
      paidCard,
      paidVoucher,
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
    // VALIDATE CONTACT FIELD FORMAT
    // ------------------------------------------------------
    const contactCheck = ClientContactSchema.safeParse(body);
    if (!contactCheck.success) {
      return NextResponse.json(
        { error: formatZodError(contactCheck.error) },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // 5) CLIENT RESOLUTION HAPPENS INSIDE THE TRANSACTION below,
    //    using the same shared logic as the create route.
    // ------------------------------------------------------
    const hasClientInfo =
      body.client_name ||
      body.client_email ||
      body.client_phone ||
      body.client_surname;

    /* -----------------------------
       Whitelisted update fields
       ----------------------------- */
    const allowedBookingFields = new Set([
      "start_time",
      "end_time",
      "price",
      "notes",
      "status",
      "therapist_id",
      "therapist_requested",
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

    // Normalize therapist_id: empty string → null
    if ("therapist_id" in bookingData) {
      bookingData.therapist_id = bookingData.therapist_id?.trim() || null;
    }

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
      // CLIENT RESOLUTION (same conflict-aware logic as the create route)
      let clientId: string | null = null;
      if (wantsToRemoveClient) {
        bookingData.client_id = null;
      } else if (hasClientInfo) {
        const conflict = await detectClientConflict(tx, "primary", body, body.clientResolution);
        if (conflict) throw new ClientConflictError([conflict]);
        clientId = await applyClientSlot(tx, body, body.clientResolution);
      }

      // Reject therapist assignment on cancelled bookings
      if ("therapist_id" in bookingData && bookingData.therapist_id !== null) {
        const current = await tx.bookings.findUnique({
          where: { id, deleted_at: null },
          select: { status: true },
        });
        const effectiveStatus = bookingData.status ?? current?.status;
        if (effectiveStatus === "cancelled") {
          throw Object.assign(
            new Error("Cannot assign a therapist to a cancelled booking"),
            { httpStatus: 409 },
          );
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
    if (error instanceof ClientConflictError) {
      return NextResponse.json(
        { error: CLIENT_NAME_CONFLICT, conflicts: error.conflicts },
        { status: 409 },
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json({ error: CLIENT_CONTACT_TAKEN }, { status: 409 });
    }

    console.error("PUT /bookings/[id] error:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Booking not found or already deleted" },
        { status: 404 },
      );
    }

    if (error.httpStatus) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
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

    // Pre-flight: fetch status + payments before allowing deletion
    const existing = await prisma.bookings.findUnique({
      where: { id, deleted_at: null },
      select: {
        status: true,
        payments: {
          where: { deleted_at: null },
          select: {
            payment_events: {
              where: { deleted_at: null },
              select: { type: true, amount: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (existing.status === "completed") {
      return NextResponse.json(
        { error: "This booking is completed and cannot be deleted. Change its status first if needed." },
        { status: 409 },
      );
    }

    const totalPaid = existing.payments
      .flatMap((p) => p.payment_events)
      .reduce(
        (sum, pe) => sum + (pe.type === "CHARGE" ? Number(pe.amount) : -Number(pe.amount)),
        0,
      );

    if (totalPaid > 0) {
      return NextResponse.json(
        { error: `This booking has recorded payments (€${totalPaid.toFixed(2)}). Delete or refund them before deleting the booking.` },
        { status: 409 },
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Read group membership before soft-deleting so we can dissolve a
      // group-of-1 left behind by this deletion.
      const before = await tx.bookings.findUnique({
        where: { id, deleted_at: null },
        select: { booking_group_id: true },
      });

      // 1️⃣ Soft delete booking
      const booking = await tx.bookings.update({
        where: {
          id,
          deleted_at: null,
        },
        data: {
          deleted_at: now,
        },
      });

      // 2️⃣ Soft delete related payments
      const payments = await tx.payments.updateMany({
        where: {
          booking_id: id,
          deleted_at: null,
        },
        data: {
          deleted_at: now,
        },
      });

      // 3️⃣ Soft delete related payment events
      await tx.payment_events.updateMany({
        where: {
          payments: {
            booking_id: id,
          },
          deleted_at: null,
        },
        data: {
          deleted_at: now,
        },
      });

      // 4️⃣ If the deleted booking was in a group, dissolve any group-of-1
      // left behind (a single-member group is meaningless).
      if (before?.booking_group_id) {
        const remaining = await tx.bookings.findMany({
          where: { booking_group_id: before.booking_group_id, deleted_at: null },
          select: { id: true },
        });
        if (remaining.length === 1) {
          await tx.bookings.update({
            where: { id: remaining[0].id },
            data: { booking_group_id: null, updated_at: now },
          });
        }
      }

      return booking;
    });

    return NextResponse.json(result, { status: 200 });
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

