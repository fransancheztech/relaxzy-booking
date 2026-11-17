import { NextResponse } from "next/server";
import type { Prisma } from "generated/prisma";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { REVIEW_CHECKS } from "@/lib/review/checks";
import { toReviewItem } from "@/lib/review/items";
import { isReviewKind, type ReviewAction } from "@/lib/review/types";

const MAX_NOTE = 1000;
const ACTIONS: ReviewAction[] = ["apply", "keep", "later"];

/** Thrown inside the transaction to roll back when someone else decided the item first. */
class AlreadyDecided extends Error {}

/**
 * The reviewer's decision on one item. Admin-only.
 *   apply  makes the change now (the check's apply), then marks the item decided and applied;
 *   keep   the data is right as it is: decided, nothing to change;
 *   later  deferred, to come back to.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as ReviewAction;
  if (!body || !ACTIONS.includes(action)) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;

  try {
    const item = await prisma.review_items.findUnique({ where: { id } });
    if (!item || !isReviewKind(item.kind)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (item.status === "decided") return NextResponse.json({ error: "ALREADY_DECIDED" }, { status: 409 });

    if (action === "later") {
      const saved = await prisma.review_items.update({
        where: { id },
        data: { status: "deferred", note, updated_at: new Date() },
      });
      return NextResponse.json(toReviewItem(saved));
    }

    const actor = await getCurrentUserId();
    const check = REVIEW_CHECKS[item.kind];
    const result = await prisma.$transaction(async (tx) => {
      // Attribute the history rows the change writes (clients_history) to the reviewer.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;

      let decision: Record<string, unknown> = { action: "keep" };
      if (action === "apply") {
        const applied = await check.apply(tx, item, {
          client_name: body.client_name,
          client_surname: body.client_surname,
          values: body.values,
          note,
        });
        if ("error" in applied) return applied;
        decision = applied.decision;
      }

      const now = new Date();
      // A recorded decision that still has to reach the data (a voucher to add) stays unapplied.
      const pending = action === "apply" && check.needsFollowUp?.(decision as Prisma.InputJsonObject) === true;
      const claimed = await tx.review_items.updateMany({
        where: { id, status: { not: "decided" } },
        data: {
          status: "decided",
          decision: decision as object,
          note,
          decided_by: actor,
          decided_at: now,
          applied_at: pending ? null : now,
          updated_at: now,
        },
      });
      if (claimed.count === 0) throw new AlreadyDecided();
      return null;
    });

    if (result) return NextResponse.json({ error: result.error }, { status: result.status });
    const saved = await prisma.review_items.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(toReviewItem(saved));
  } catch (err) {
    if (err instanceof AlreadyDecided) return NextResponse.json({ error: "ALREADY_DECIDED" }, { status: 409 });
    console.error("POST /api/review/items/[id]/decide error", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
