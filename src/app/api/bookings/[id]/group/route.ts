import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { therapistDisplayName } from "@/utils/therapistName";

/* ======================================================
   GET /api/bookings/[id]/group
   Returns the sibling bookings sharing this booking's group.
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
      where: { id, deleted_at: null },
      select: { booking_group_id: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!booking.booking_group_id) {
      return NextResponse.json({ groupId: null, members: [] });
    }

    const members = await prisma.bookings.findMany({
      where: {
        booking_group_id: booking.booking_group_id,
        deleted_at: null,
      },
      orderBy: { start_time: "asc" },
      include: {
        clients: { select: { id: true, client_name: true, client_surname: true } },
        services_names: { select: { id: true, name: true } },
        therapists: { select: { id: true, nickname: true, name: true, surname: true } },
      },
    });

    return NextResponse.json({
      groupId: booking.booking_group_id,
      members: members.map((m) => ({
        id: m.id,
        start_time: m.start_time,
        end_time: m.end_time,
        status: m.status,
        client: m.clients
          ? {
              id: m.clients.id,
              name: m.clients.client_name,
              surname: m.clients.client_surname,
            }
          : null,
        service: m.services_names
          ? { id: m.services_names.id, name: m.services_names.name }
          : null,
        therapist: m.therapists
          ? { id: m.therapists.id, full_name: therapistDisplayName(m.therapists) }
          : null,
      })),
    });
  } catch (error) {
    console.error("GET /bookings/[id]/group error:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking group" },
      { status: 500 },
    );
  }
}

/* ======================================================
   PATCH /api/bookings/[id]/group
   Body: { action: "remove" } | { action: "add", targetId }
   - remove: drops this booking from its group (dissolving a leftover group of 1).
   - add: links targetId into this booking's group, creating a new group if this
     booking isn't grouped yet.
   ====================================================== */
export async function PATCH(
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

    const body = (await req.json()) as { action?: string; targetId?: string };

    if (body.action === "add") {
      const targetId = body.targetId;
      if (!targetId || typeof targetId !== "string" || targetId === id) {
        return NextResponse.json({ error: "Invalid target booking" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.bookings.findUnique({
          where: { id, deleted_at: null },
          select: { booking_group_id: true },
        });
        if (!current) {
          throw Object.assign(new Error("Booking not found"), { httpStatus: 404 });
        }

        const target = await tx.bookings.findUnique({
          where: { id: targetId, deleted_at: null },
          select: { booking_group_id: true },
        });
        if (!target) {
          throw Object.assign(new Error("Target booking not found"), { httpStatus: 404 });
        }

        // Reuse this booking's group, or start a new one if it isn't grouped yet.
        const groupId = current.booking_group_id ?? crypto.randomUUID();

        if (target.booking_group_id && target.booking_group_id !== groupId) {
          throw Object.assign(
            new Error("That booking already belongs to another group"),
            { httpStatus: 409 },
          );
        }

        if (!current.booking_group_id) {
          await tx.bookings.update({
            where: { id },
            data: { booking_group_id: groupId, updated_at: new Date() },
          });
        }
        if (target.booking_group_id !== groupId) {
          await tx.bookings.update({
            where: { id: targetId },
            data: { booking_group_id: groupId, updated_at: new Date() },
          });
        }

        return { groupId };
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (body.action !== "remove") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.bookings.findUnique({
        where: { id, deleted_at: null },
        select: { booking_group_id: true },
      });

      if (!current) {
        throw Object.assign(new Error("Booking not found"), { httpStatus: 404 });
      }

      if (!current.booking_group_id) {
        throw Object.assign(new Error("Booking is not part of a group"), {
          httpStatus: 409,
        });
      }

      const groupId = current.booking_group_id;

      await tx.bookings.update({
        where: { id },
        data: { booking_group_id: null, updated_at: new Date() },
      });

      const remaining = await tx.bookings.findMany({
        where: { booking_group_id: groupId, deleted_at: null },
        select: { id: true },
      });

      if (remaining.length === 1) {
        await tx.bookings.update({
          where: { id: remaining[0].id },
          data: { booking_group_id: null, updated_at: new Date() },
        });
      }

      return { removedFrom: groupId, dissolved: remaining.length === 1 };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /bookings/[id]/group error:", error);

    if (error.httpStatus) {
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus },
      );
    }

    return NextResponse.json(
      { error: "Failed to update booking group" },
      { status: 500 },
    );
  }
}
