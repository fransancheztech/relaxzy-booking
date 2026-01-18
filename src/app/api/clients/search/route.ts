import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { searchTerm } = await req.json();

  const baseWhere = { deleted_at: null }; // soft-delete filter

  if (!searchTerm) {
    const clients = await prisma.clients.findMany({
      where: baseWhere,
    });
    return NextResponse.json(clients);
  }

  const clients = await prisma.clients.findMany({
    where: {
      AND: [
        baseWhere,
        {
          OR: [
            { client_name: { contains: searchTerm, mode: "insensitive" } },
            { client_surname: { contains: searchTerm, mode: "insensitive" } },
            { client_email: { contains: searchTerm, mode: "insensitive" } },
            { client_phone: { contains: searchTerm, mode: "insensitive" } },
          ]
        }
      ]
    },
  });

  return NextResponse.json(clients);
}
