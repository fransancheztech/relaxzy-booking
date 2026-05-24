import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { client_name, client_surname, client_email, client_phone } = body;

  if (!client_name && !client_surname && !client_email && !client_phone) {
    return NextResponse.json([], { status: 200 });
  }

  const filters: Prisma.clientsWhereInput[] = [];

  if (client_name) filters.push({ client_name: { contains: client_name, mode: "insensitive" } });
  if (client_surname) filters.push({ client_surname: { contains: client_surname, mode: "insensitive" } });
  if (client_email) filters.push({ client_email: { contains: client_email, mode: "insensitive" } });
  if (client_phone) filters.push({ client_phone: { contains: client_phone, mode: "insensitive" } });

  try {
    const clients = await prisma.clients.findMany({
      where: {
        AND: [
          { deleted_at: null }, // <-- soft-delete filter
          { OR: filters }
        ]
      },
      select: {
        id: true,
        client_name: true,
        client_surname: true,
        client_email: true,
        client_phone: true,
        client_notes: true,
        created_at: true,
        updated_at: true,
      },
      take: 15,
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error finding clients" }, { status: 500 });
  }
}
