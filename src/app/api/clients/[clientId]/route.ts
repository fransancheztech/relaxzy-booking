import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientUpdateSchema } from "@/schemas/client.schema";
import { formatZodError } from "@/utils/zodApiError";

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
    const raw = await request.json();
    const parsed = ClientUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const normalizedEmail =
      body.client_email?.trim() === ""
        ? null
        : body.client_email?.trim().toLowerCase() ?? null;

    const normalizedPhone =
      body.client_phone?.trim() === ""
        ? null
        : body.client_phone?.trim() ?? null;

    const updatedClient = await prisma.clients.update({
      where: { id: clientId },
      data: {
        client_name: body.client_name,
        client_surname: body.client_surname,
        client_email: normalizedEmail,
        client_phone: normalizedPhone,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedClient);
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Email or phone already exists." },
        { status: 409 }
      );
    }

    console.error("Update client error:", err);
    return NextResponse.json(
      { error: "Error updating client" },
      { status: 500 }
    );
  }
}

