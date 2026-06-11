import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientContactSchema } from "@/schemas/clientContact.schema";
import { formatZodError } from "@/utils/zodApiError";
import {
  applyClientSlot,
  ClientConflictError,
  PlaceholderNameError,
  detectClientConflict,
} from "@/lib/clients/resolveBookingClients";
import { CLIENT_CONTACT_TAKEN, CLIENT_NAME_CONFLICT } from "@/types/clientConflict";
import type { ClientConflict, ClientResolution } from "@/types/clientConflict";

type CompanionInput = {
  service_name?: string;
  therapist_id?: string;
  duration?: string | number;
  price?: string | number;
  notes?: string;
  same_as_primary?: boolean;
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
};

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
  companions?: CompanionInput[];
  // Per-slot decisions for name conflicts: "primary", "companion-0", …
  clientResolutions?: Record<string, ClientResolution>;
};

const normalize = (v?: string) =>
  v && v.trim() !== "" ? v.trim() : null;

// A companion resolves to its own client only when it isn't sharing the primary
// and actually carries a name; otherwise it falls back to the primary client.
const companionResolvesOwnClient = (c: CompanionInput) =>
  !c.same_as_primary && !!c.client_name?.trim();


export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    // ------------------------------------------------------
    // 0) VALIDATE CONTACT FIELD FORMAT
    // ------------------------------------------------------
    const contactCheck = ClientContactSchema.safeParse(body);
    if (!contactCheck.success) {
      return NextResponse.json(
        { error: formatZodError(contactCheck.error) },
        { status: 400 }
      );
    }

    // ------------------------------------------------------
    // 1) VALIDATE REQUIRED FIELDS
    // ------------------------------------------------------
    if (!body.start_time)
      return NextResponse.json(
        { error: "Missing start_time" },
        { status: 400 }
      );
    if (body.duration == null)
      return NextResponse.json({ error: "Missing duration" }, { status: 400 });

    // ------------------------------------------------------
    // 2) PARSE & VALIDATE START TIME
    // ------------------------------------------------------
    const start = new Date(body.start_time);
    if (Number.isNaN(start.getTime()))
      return NextResponse.json(
        { error: "Invalid start_time" },
        { status: 400 }
      );

    // ------------------------------------------------------
    // 3) VALIDATE DURATION (fully flexible)
    // ------------------------------------------------------
    const durationMinutes = Number(body.duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 4) VALIDATE PRICE (nullable)
    // ------------------------------------------------------
    let price: number | null = null;

    if (body.price !== undefined && body.price !== null && body.price !== "") {
      const parsedPrice = Number(body.price);

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }

      price = parsedPrice;
    }

    // ------------------------------------------------------
    // 5) CLIENT RESOLUTION HAPPENS INSIDE THE TRANSACTION (step 10)
    //    so that conflict checks and the booking write are atomic.
    // ------------------------------------------------------
    const resolutions = body.clientResolutions ?? {};

    // ------------------------------------------------------
    // 6) SERVICE (nullable)
    // ------------------------------------------------------
    let serviceId: string | null = null;

    if (body.service_name && body.service_name.trim() !== "") {
      const service = await prisma.services_names.findFirst({
        where: { name: body.service_name, deleted_at: null },
      });

      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 400 }
        );
      }

      serviceId = service.id;
    }

    // ------------------------------------------------------
    // 7) COMPUTE END TIME
    // ------------------------------------------------------
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // ------------------------------------------------------
    // 8) RESOLVE COMPANION SERVICES
    // ------------------------------------------------------
    const companions = body.companions ?? [];

    const companionServiceIds = await Promise.all(
      companions.map(async (c) => {
        if (!c.service_name || c.service_name.trim() === "") return null;
        const svc = await prisma.services_names.findFirst({
          where: { name: c.service_name, deleted_at: null },
        });
        return svc?.id ?? null;
      }),
    );

    // ------------------------------------------------------
    // 9) RESOLVE CLIENTS + CREATE BOOKINGS IN ONE TRANSACTION
    //    Phase 1 detects every name conflict before any write, so an
    //    unresolved conflict (409) leaves nothing partially created.
    // ------------------------------------------------------
    const isGroup = companions.length > 0;
    const groupId = isGroup ? crypto.randomUUID() : null;

    const { booking, companionBookings } = await prisma.$transaction(async (tx) => {
      // Phase 1 — detect conflicts (primary + companions with their own client)
      const conflicts: ClientConflict[] = [];
      const primaryConflict = await detectClientConflict(tx, "primary", body, resolutions["primary"]);
      if (primaryConflict) conflicts.push(primaryConflict);
      for (let i = 0; i < companions.length; i++) {
        if (!companionResolvesOwnClient(companions[i])) continue;
        const slot = `companion-${i}`;
        const conflict = await detectClientConflict(tx, slot, companions[i], resolutions[slot]);
        if (conflict) conflicts.push(conflict);
      }
      if (conflicts.length > 0) throw new ClientConflictError(conflicts);

      // Phase 2 — resolve the primary client (requires phone/email)
      const clientId = await applyClientSlot(tx, body, resolutions["primary"]);

      // Soft duplicate check (warn, don't block)
      if (clientId) {
        const existing = await tx.bookings.findFirst({
          where: { client_id: clientId, start_time: start, deleted_at: null },
        });
        if (existing) {
          console.warn(
            `Duplicate booking: client ${clientId} already has a booking at ${start.toISOString()}`,
          );
        }
      }

      const primary = await tx.bookings.create({
        data: {
          client_id: clientId,
          service_id: serviceId,
          therapist_id: body.therapist_id?.trim() || null,
          therapist_requested: !!body.therapist_requested,
          start_time: start,
          end_time: end,
          notes: normalize(body.notes),
          price,
          status: "confirmed",
          booking_group_id: groupId,
        },
      });

      // Companions share the primary's client unless they carry their own name
      // (which then needs only a name — contact info is optional).
      const resolveCompanionClientId = async (c: CompanionInput, i: number): Promise<string | null> => {
        if (!companionResolvesOwnClient(c)) return clientId;
        return applyClientSlot(tx, c, resolutions[`companion-${i}`], { requireContact: false });
      };

      const created = await Promise.all(
        companions.map(async (c, i) => {
          const dur = Number(c.duration);
          const companionEnd = new Date(start.getTime() + dur * 60 * 1000);
          const companionPrice =
            c.price !== undefined && c.price !== null && c.price !== ""
              ? Number(c.price)
              : null;

          const companionClientId = await resolveCompanionClientId(c, i);

          return tx.bookings.create({
            data: {
              client_id: companionClientId,
              service_id: companionServiceIds[i],
              therapist_id: c.therapist_id?.trim() || null,
              start_time: start,
              end_time: companionEnd,
              notes: normalize(c.notes),
              price: companionPrice,
              status: "confirmed",
              booking_group_id: groupId,
            },
          });
        }),
      );

      return { booking: primary, companionBookings: created };
    });

    return NextResponse.json({ booking, companionBookings });
  } catch (err) {
    if (err instanceof ClientConflictError) {
      return NextResponse.json(
        { error: CLIENT_NAME_CONFLICT, conflicts: err.conflicts },
        { status: 409 },
      );
    }
    if (err instanceof PlaceholderNameError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: CLIENT_CONTACT_TAKEN }, { status: 409 });
    }
    console.error("Create booking error", err);
    return NextResponse.json(
      { error: "Error creating booking" },
      { status: 500 }
    );
  }
}
