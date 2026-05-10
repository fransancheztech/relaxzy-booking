import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientUpdateSchema } from "@/schemas/client.schema";
import { formatZodError } from "@/utils/zodApiError";

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = ClientUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    // Check if client exists
    const existing = await prisma.clients.findFirst({
      where: {
        OR: [
          { client_email: body.client_email ?? undefined },
          { client_phone: body.client_phone ?? undefined },
        ],
        deleted_at: null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Client already exists", client: existing }, { status: 409 });
    }

    const client = await prisma.clients.create({
      data: {
        client_name: body.client_name,
        client_surname: body.client_surname ?? null,
        client_email: body.client_email ?? null,
        client_phone: body.client_phone ?? null,
      },
    });

    return NextResponse.json({ client });
  } catch (err) {
    console.error("Create client error:", err);
    return NextResponse.json({ error: "Error creating client" }, { status: 500 });
  }
}
