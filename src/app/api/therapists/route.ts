import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export async function POST(req: NextRequest) {
  try {
    const role = await getCurrentUserRole();
    if (!role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      page = 0,
      limit = 5,
      searchTerm,
      sort,
      archived = false,
      includeInactive = false,
    } = await req.json();

    // Archived therapists are admin-only. Enforced here, not just by hiding the toggle,
    // so the list cannot be obtained by posting `archived: true` directly.
    if (archived && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build search/filter. Archived view lists soft-deleted therapists (for restore).
    //
    // Two independent "not working here" states: `active = false` is former staff still on
    // the roster, `deleted_at` is archived. Inactive rows are hidden unless asked for, so
    // the default list answers "who works here now".
    //
    // The archived branch deliberately ignores includeInactive: an archived therapist is
    // out of service whatever its `active` flag says, and filtering further would hide
    // rows whose only available action is Restore — making them unrecoverable from the UI.
    const where = {
      deleted_at: archived ? { not: null } : null,
      ...(!archived && !includeInactive ? { active: true } : {}),
      ...(searchTerm && {
        OR: [
          { nickname: { contains: searchTerm, mode: "insensitive" } },
          { name: { contains: searchTerm, mode: "insensitive" } },
          { surname: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm, mode: "insensitive" } },
          { notes: { contains: searchTerm, mode: "insensitive" } },
        ],
      }),
    };

    const [therapists, total] = await Promise.all([
      prisma.therapists.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: [
          { active: "desc" },
          { [sort?.field ?? "created_at"]: sort?.sort ?? "desc" },
        ],
      }),
      prisma.therapists.count({ where }),
    ]);

    const rows = therapists.map((t) => ({
      id: t.id,
      nickname: t.nickname,
      name: t.name,
      surname: t.surname,
      email: t.email,
      phone: t.phone,
      notes: t.notes,
      active: t.active,
      off_days: t.off_days,
      created_at: t.created_at,
      deleted_at: t.deleted_at,
    }));

    return NextResponse.json({ rows, total });
  } catch (err) {
    console.error("Error fetching therapists:", err);
    return NextResponse.json(
      { error: "Failed to fetch therapists" },
      { status: 500 }
    );
  }
}
