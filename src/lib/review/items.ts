import type { review_items } from "generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { REVIEW_CHECKS } from "@/lib/review/checks";
import type { ReviewItem, ReviewKind, ReviewStatus } from "@/lib/review/types";

/** JSON with object keys sorted: jsonb stores keys in its own order, so plain stringify can't compare. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export function toReviewItem(row: review_items): ReviewItem {
  return {
    id: row.id,
    kind: row.kind as ReviewKind,
    client_id: row.client_id,
    booking_id: row.booking_id,
    voucher_id: row.voucher_id,
    business_date: row.business_date ? row.business_date.toISOString().slice(0, 10) : null,
    details: row.details,
    proposal: row.proposal,
    status: row.status as ReviewStatus,
    decision: (row.decision as Record<string, unknown> | null) ?? null,
    note: row.note,
    decided_at: row.decided_at ? row.decided_at.toISOString() : null,
    applied_at: row.applied_at ? row.applied_at.toISOString() : null,
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Runs one check against the current data and brings its review items up to date:
 *   - a new problem becomes an open item;
 *   - an open or deferred item gets the latest details and proposal, when they changed;
 *   - an open or deferred item whose problem is gone is removed (nothing was decided on it);
 *   - decided items are never touched, so "keep as is" sticks even though the problem is still there.
 */
export async function runReviewCheck(kind: ReviewKind) {
  const check = REVIEW_CHECKS[kind];
  const candidates = await check.find(prisma);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.review_items.findMany({
        where: { kind },
        select: { id: true, item_key: true, status: true, details: true, proposal: true },
      });
      const byKey = new Map(existing.map((e) => [e.item_key, e]));
      const found = new Set(candidates.map((c) => c.item_key));
      const now = new Date();

      const fresh = candidates.filter((c) => !byKey.has(c.item_key));
      if (fresh.length) {
        await tx.review_items.createMany({
          data: fresh.map((c) => ({
            kind,
            item_key: c.item_key,
            source: check.source,
            business_date: c.business_date ?? null,
            client_id: c.client_id ?? null,
            booking_id: c.booking_id ?? null,
            voucher_id: c.voucher_id ?? null,
            details: c.details,
            proposal: c.proposal ?? undefined,
          })),
          // Two searches at once (a double click, two tabs) must not fail on the unique key.
          skipDuplicates: true,
        });
      }

      let updated = 0;
      for (const c of candidates) {
        const e = byKey.get(c.item_key);
        if (!e || e.status === "decided") continue;
        // Unchanged rows keep their updated_at, so a card being edited on the page isn't reset.
        if (sameJson(e.details, c.details) && sameJson(e.proposal ?? null, c.proposal ?? null)) continue;
        await tx.review_items.update({
          where: { id: e.id },
          data: { details: c.details, proposal: c.proposal ?? undefined, updated_at: now },
        });
        updated++;
      }

      const gone = existing.filter((e) => e.status !== "decided" && !found.has(e.item_key)).map((e) => e.id);
      if (gone.length) await tx.review_items.deleteMany({ where: { id: { in: gone } } });

      return { added: fresh.length, updated, removed: gone.length };
    },
    { timeout: 30_000 },
  );
}
