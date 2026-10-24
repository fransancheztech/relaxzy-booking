import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  loadDuplicateGroups,
  loadTypoPairs,
  loadVoucherRecipientPairs,
  memberFullName,
} from "@/lib/clients/duplicates";

// Duplicate groups awaiting review, plus the recent merges (so any of them can be undone).
// Admin-only: merging rewrites which client hundreds of bookings belong to.
export async function GET() {
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [groups, typos, voucherPairs, merges] = await Promise.all([
      loadDuplicateGroups(),
      loadTypoPairs(),
      loadVoucherRecipientPairs(),
      prisma.client_merges.findMany({
        orderBy: { merged_at: "desc" },
        take: 30,
        include: { clients: { select: { client_name: true, client_surname: true } } },
      }),
    ]);

    return NextResponse.json({
      groups,
      typos,
      voucherPairs,
      merges: merges.map((m) => {
        const losers = Array.isArray(m.losers_before) ? (m.losers_before as Record<string, string | null>[]) : [];
        const moved = (m.moved ?? {}) as Record<string, unknown[]>;
        return {
          id: m.id,
          merged_at: m.merged_at.toISOString(),
          undone_at: m.undone_at ? m.undone_at.toISOString() : null,
          survivor_name: memberFullName(m.clients),
          absorbed_names: losers.map((l) =>
            memberFullName({ client_name: l.client_name ?? null, client_surname: l.client_surname ?? null })),
          bookings_moved: Array.isArray(moved.bookings) ? moved.bookings.length : 0,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/clients/duplicates error", err);
    return NextResponse.json({ error: "Failed to load duplicates" }, { status: 500 });
  }
}
