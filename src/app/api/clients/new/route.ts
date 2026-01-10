import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  client_name: string;
  client_surname?: string;
  client_email?: string;
  client_phone?: string;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    // Basic validation
    if (!body.client_name) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

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
