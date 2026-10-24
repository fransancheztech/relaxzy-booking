import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Whether a user id belongs to an active therapist. Reads through Prisma like every other route:
// the Supabase public (anon) and logged-in (authenticated) roles have no table access at all
// (see prisma/manual-migrations/2026-10-24-lock-down-public-api.sql).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "Falta el parámetro user_id" }, { status: 400 });
  }
  if (!UUID.test(user_id)) return NextResponse.json({ exists: false });

  try {
    const therapist = await prisma.therapists.findFirst({
      where: { id: user_id, deleted_at: null },
      select: { id: true },
    });
    return NextResponse.json({ exists: !!therapist });
  } catch (err) {
    console.error("GET /api/therapists/list error", err);
    return NextResponse.json({ error: "Error checking therapist" }, { status: 500 });
  }
}
