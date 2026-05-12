import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ therapists: [] });
    }
    const therapists = await prisma.therapists.findMany({
      where: { id: { in: ids } },
      select: { id: true, full_name: true, active: true, deleted_at: true },
    });
    return NextResponse.json({ therapists });
  } catch (err) {
    console.error("POST /api/therapists/by-ids error:", err);
    return NextResponse.json({ error: "Failed to fetch therapists" }, { status: 500 });
  }
}
