import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { therapistDisplayName } from "@/utils/therapistName";

export async function GET() {
  try {
    const rows = await prisma.therapists.findMany({
      where: { active: true, deleted_at: null },
      select: { id: true, nickname: true, name: true, surname: true, off_days: true },
    });
    const therapists = rows
      .map((t) => ({ id: t.id, full_name: therapistDisplayName(t), off_days: t.off_days }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    return NextResponse.json({ therapists });
  } catch (err) {
    console.error("GET /api/therapists/active error:", err);
    return NextResponse.json({ error: "Failed to fetch therapists" }, { status: 500 });
  }
}
