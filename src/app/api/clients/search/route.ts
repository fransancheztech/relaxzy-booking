import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { page, limit, searchTerm, sort } = await req.json();

  const where = {
    deleted_at: null,
    ...(searchTerm && {
      id: { contains: searchTerm, mode: "insensitive" },
    }),
    OR: [
            { client_name: { contains: searchTerm, mode: "insensitive" } },
            { client_surname: { contains: searchTerm, mode: "insensitive" } },
            { client_email: { contains: searchTerm, mode: "insensitive" } },
            { client_phone: { contains: searchTerm, mode: "insensitive" } },
          ],
  };

  const [rows, total] = await Promise.all([
    prisma.clients.findMany({
    where,
    skip: page * limit,
    take: limit,
    orderBy: {
      [sort?.field ?? "created_at"]: sort?.sort ?? "desc",
    },
  }),
  prisma.clients.count({ where }),
])

  return NextResponse.json({rows, total});
}
