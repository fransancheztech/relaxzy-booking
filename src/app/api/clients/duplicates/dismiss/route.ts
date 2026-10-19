import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The pair in the table's fixed order (client_a < client_b), or null if the input is invalid. */
async function readPair(request: Request): Promise<[string, string] | null> {
  try {
    const { aId, bId } = await request.json();
    if (typeof aId !== "string" || typeof bId !== "string") return null;
    if (!UUID.test(aId) || !UUID.test(bId) || aId === bId) return null;
    const [a, b] = [aId.toLowerCase(), bId.toLowerCase()];
    return a < b ? [a, b] : [b, a];
  } catch {
    return null;
  }
}

// "These two clients are different people": a reviewed "possible phone typo" pair that must not be
// suggested again. Nothing in either client's data changes. Admin-only.
export async function POST(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pair = await readPair(request);
  if (!pair) return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });

  try {
    const actor = await getCurrentUserId();
    await prisma.client_duplicate_dismissals.upsert({
      where: { client_a_client_b: { client_a: pair[0], client_b: pair[1] } },
      create: { client_a: pair[0], client_b: pair[1], dismissed_by: actor },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/clients/duplicates/dismiss error", err);
    return NextResponse.json({ error: "DISMISS_FAILED" }, { status: 500 });
  }
}

// Undo of the above: the pair becomes a suggestion again.
export async function DELETE(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pair = await readPair(request);
  if (!pair) return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });

  try {
    await prisma.client_duplicate_dismissals.deleteMany({ where: { client_a: pair[0], client_b: pair[1] } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clients/duplicates/dismiss error", err);
    return NextResponse.json({ error: "DISMISS_FAILED" }, { status: 500 });
  }
}
