import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { page, limit, searchTerm, sort } = await req.json();

  const where = {
    deleted_at: null,
    ...(searchTerm && {
      booking_id: { contains: searchTerm, mode: "insensitive" },
    }),
  };

  const [rows, total] = await Promise.all([
    prisma.payments.findMany({
      where,
      skip: page * limit,
      take: limit,
      orderBy: {
        [sort?.field ?? "created_at"]: sort?.sort ?? "desc",
      },
    }),
    prisma.payments.count({ where }),
  ]);

  return NextResponse.json({ rows, total });
}
