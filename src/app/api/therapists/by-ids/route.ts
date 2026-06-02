import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { therapistDisplayName } from "@/utils/therapistName";

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ therapists: [] });
    }
    const rows = await prisma.therapists.findMany({
      where: { id: { in: ids } },
      select: { id: true, nickname: true, name: true, surname: true, active: true, deleted_at: true },
    });
    const therapists = rows.map((t) => ({
      id: t.id,
      full_name: therapistDisplayName(t),
      active: t.active,
      deleted_at: t.deleted_at,
    }));
    return NextResponse.json({ therapists });
  } catch (err) {
    console.error("POST /api/therapists/by-ids error:", err);
    return NextResponse.json({ error: "Failed to fetch therapists" }, { status: 500 });
  }
}
