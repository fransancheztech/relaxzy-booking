import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { toReviewItem } from "@/lib/review/items";
import { REVIEW_KINDS, isReviewKind, type ReviewCounts, type ReviewListResponse } from "@/lib/review/types";

const RECENT_LIMIT = 30;

// The old-data review page: counts for every check, plus the open and deferred items of one check
// and its latest decisions. Admin-only.
export async function GET(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const kind = new URL(request.url).searchParams.get("kind");
  if (!isReviewKind(kind)) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    const [grouped, items, recent] = await Promise.all([
      prisma.review_items.groupBy({ by: ["kind", "status"], _count: { _all: true } }),
      prisma.review_items.findMany({
        where: { kind, status: { in: ["open", "deferred"] } },
        orderBy: [{ business_date: "asc" }, { created_at: "asc" }, { item_key: "asc" }],
      }),
      prisma.review_items.findMany({
        where: { kind, status: "decided" },
        orderBy: { decided_at: "desc" },
        take: RECENT_LIMIT,
      }),
    ]);

    const counts = Object.fromEntries(
      REVIEW_KINDS.map((k) => [k, { open: 0, deferred: 0, decided: 0 }]),
    ) as ReviewCounts;
    for (const g of grouped) {
      if (isReviewKind(g.kind) && (g.status === "open" || g.status === "deferred" || g.status === "decided")) {
        counts[g.kind][g.status] = g._count._all;
      }
    }

    const body: ReviewListResponse = {
      counts,
      items: items.map(toReviewItem),
      recent: recent.map(toReviewItem),
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("GET /api/review error", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
