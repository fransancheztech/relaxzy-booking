import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { isRawUniqueViolation, mergeErrorCode } from "@/lib/clients/duplicates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reverses one merge exactly (unmerge_clients): the absorbed clients come back and every booking
// or voucher reference that moved returns to the client it came from. Admin-only.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });

  try {
    const actor = await getCurrentUserId();
    // unmerge_clients returns void; wrapping it keeps the void column out of what Prisma reads.
    await prisma.$queryRaw`SELECT 1 AS ok FROM (SELECT unmerge_clients(${id}::uuid, ${actor}::uuid)) AS run`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = mergeErrorCode(err);
    if (code) return NextResponse.json({ error: code }, { status: 409 });
    // A number or email a returning client needs is held by someone created since the merge.
    if (isRawUniqueViolation(err)) return NextResponse.json({ error: "CONTACT_TAKEN" }, { status: 409 });
    console.error("POST /api/clients/merges/[id]/undo error", err);
    return NextResponse.json({ error: "UNDO_FAILED" }, { status: 500 });
  }
}
