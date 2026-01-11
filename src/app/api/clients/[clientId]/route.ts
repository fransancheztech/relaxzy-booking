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
  _: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const body = await _.json();
    const { clientId } = await params;

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
