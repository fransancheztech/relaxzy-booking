import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientUpdateSchema } from "@/schemas/client.schema";
import { formatZodError } from "@/utils/zodApiError";
import { CLIENT_CONTACT_TAKEN } from "@/types/clientConflict";
import {
  ContactTakenError,
  assertContactFree,
  contactTakenBody,
  describeContactCollision,
  isUniqueViolation,
} from "@/lib/clients/contactCollision";
import { resolvePhoneUpdate } from "@/utils/phone";
import { canonicalEmail } from "@/utils/email";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const client = await prisma.clients.findFirst({
      where: {
        id: clientId,
        deleted_at: null,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (err) {
    console.error("Fetch client error:", err);
    return NextResponse.json(
      { error: "Error fetching client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  // Hoisted so the P2002 backstop can still name the colliding value; the body can't be re-read.
  let clientId = "";
  let normalizedEmail: string | null = null;
  let checkedPhone: string | null = null;

  try {
    ({ clientId } = await params);
    const raw = await request.json();
    const parsed = ClientUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const current = await prisma.clients.findFirst({
      where: { id: clientId, deleted_at: null },
      select: { client_phone: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    normalizedEmail = canonicalEmail(body.client_email);

    // Same number in another spelling keeps the stored value and skips the collision check;
    // a genuinely new number is stored as E.164 and checked in any format.
    const phoneWrite = resolvePhoneUpdate(body.client_phone, current.client_phone);
    checkedPhone = phoneWrite.changed ? body.client_phone?.trim() || null : null;

    const normalizedNotes =
      body.client_notes === undefined
        ? undefined
        : body.client_notes.trim() === ""
          ? null
          : body.client_notes.trim();

    // Contact collision: the new email/phone already belongs to a *different* active client.
    // Uses the shared check, so this surface no longer keeps its own copy of the lookup.
    await assertContactFree(prisma, {
      email: normalizedEmail,
      phone: checkedPhone,
      excludeClientId: clientId,
    });

    const updatedClient = await prisma.clients.update({
      where: { id: clientId },
      data: {
        client_name: normalizeClientName(body.client_name),
        client_surname: normalizeClientSurname(body.client_surname),
        client_email: normalizedEmail,
        client_phone: phoneWrite.value,
        client_notes: normalizedNotes,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedClient);
  } catch (err: any) {
    if (err instanceof ContactTakenError) {
      return NextResponse.json(contactTakenBody(err), { status: 409 });
    }
    // Backstop for the race the pre-check can't cover: the colliding row exists now, so the
    // owner can still be named.
    if (isUniqueViolation(err)) {
      const described = await describeContactCollision(prisma, {
        email: normalizedEmail,
        phone: checkedPhone,
        excludeClientId: clientId || undefined,
      });
      return NextResponse.json(
        described ? contactTakenBody(described) : { error: CLIENT_CONTACT_TAKEN },
        { status: 409 },
      );
    }

    console.error("Update client error:", err);
    return NextResponse.json(
      { error: "Error updating client" },
      { status: 500 }
    );
  }
}

