import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: { clientId: string };
};

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
  try {
    const { clientId } = await params;
    const body = await request.json();

    const { client_email, client_phone } = body;

    // -------------------------------
    // Check for duplicates
    // -------------------------------
    if (client_email || client_phone) {
      const existingClient = await prisma.clients.findFirst({
        where: {
          deleted_at: null,
          NOT: { id: clientId },
          OR: [
            client_email ? { client_email: client_email } : undefined,
            client_phone ? { client_phone: client_phone } : undefined,
          ].filter(Boolean) as any,
        },
      });

      if (existingClient) {
        return NextResponse.json(
          {
            error:
              "Another client already exists with the same email or phone.",
          },
          { status: 409 } // Conflict
        );
      }
    }

    // -------------------------------
    // Update client
    // -------------------------------
    const updatedClient = await prisma.clients.update({
      where: { id: clientId },
      data: {
        client_name: body.client_name,
        client_surname: body.client_surname,
        client_email: body.client_email ?? null,
        client_phone: body.client_phone ?? null,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedClient);
  } catch (err) {
    console.error("Update client error:", err);
    return NextResponse.json(
      { error: "Error updating client" },
      { status: 500 }
    );
  }
}
