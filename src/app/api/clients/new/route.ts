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
import { canonicalPhone } from "@/utils/phone";
import { canonicalEmail } from "@/utils/email";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";

const norm = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

export async function POST(request: Request) {
  // Hoisted so the catch can still name the colliding value. The request body is consumed by the
  // first read, so it cannot be re-read from the error path.
  let email: string | null = null;
  let phone: string | null = null;

  try {
    const raw = await request.json();
    const parsed = ClientUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    email = canonicalEmail(body.client_email);
    phone = norm(body.client_phone);

    // Pre-check so the 409 can name the field and the owner. Previously this returned a
    // hardcoded English "Client already exists", which bypassed i18n entirely and told the
    // receptionist nothing about which value clashed or whose it was. The phone is matched in
    // any format, so the same number typed with spaces still collides.
    await assertContactFree(prisma, { email, phone });

    const client = await prisma.clients.create({
      data: {
        client_name: normalizeClientName(body.client_name),
        client_surname: normalizeClientSurname(body.client_surname),
        client_email: email,
        client_phone: canonicalPhone(phone),
      },
    });

    return NextResponse.json({ client });
  } catch (err) {
    if (err instanceof ContactTakenError) {
      return NextResponse.json(contactTakenBody(err), { status: 409 });
    }
    // Backstop for the race the pre-check can't cover: someone claimed the contact between the
    // check and the insert. The colliding row exists now, so the owner can still be named.
    if (isUniqueViolation(err)) {
      const described = await describeContactCollision(prisma, { email, phone });
      return NextResponse.json(
        described ? contactTakenBody(described) : { error: CLIENT_CONTACT_TAKEN },
        { status: 409 },
      );
    }
    console.error("Create client error:", err);
    return NextResponse.json({ error: "Error creating client" }, { status: 500 });
  }
}
