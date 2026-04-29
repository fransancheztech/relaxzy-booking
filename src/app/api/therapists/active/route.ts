import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const therapists = await prisma.therapists.findMany({
      where: { active: true, deleted_at: null },
      select: { id: true, full_name: true },
      orderBy: { full_name: "asc" },
    });
    return NextResponse.json({ therapists });
  } catch (err) {
    console.error("GET /api/therapists/active error:", err);
    return NextResponse.json({ error: "Failed to fetch therapists" }, { status: 500 });
  }
}
