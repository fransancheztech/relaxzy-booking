import { NextResponse } from "next/server";
import { Prisma } from "generated/prisma";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { isUniqueViolation } from "@/lib/clients/contactCollision";
import { REVIEW_CHECKS } from "@/lib/review/checks";
import { toReviewItem } from "@/lib/review/items";
import { isReviewKind } from "@/lib/review/types";

/**
 * Undo of a decision: the item goes back to open. An applied change is reverted first, and only if
 * the data hasn't been edited again since (CHANGED_SINCE otherwise). Admin-only.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const item = await prisma.review_items.findUnique({ where: { id } });
    if (!item || !isReviewKind(item.kind)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const actor = await getCurrentUserId();
    const applied = item.status === "decided" && (item.decision as { action?: string } | null)?.action === "apply";
    const check = REVIEW_CHECKS[item.kind];

    const failure = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
      if (applied) {
        const reverted = await check.revert(tx, item);
        if (reverted) return reverted;
      }
      await tx.review_items.update({
        where: { id },
        data: {
          status: "open",
          decision: Prisma.DbNull,
          decided_by: null,
          decided_at: null,
          applied_at: null,
          updated_at: new Date(),
        },
      });
      return null;
    });

    if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
    const saved = await prisma.review_items.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(toReviewItem(saved));
  } catch (err) {
    if (isUniqueViolation(err)) return NextResponse.json({ error: "CONTACT_TAKEN" }, { status: 409 });
    console.error("POST /api/review/items/[id]/reopen error", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
