import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { page = 0, limit = 5, searchTerm, sort, archived = false } = await req.json();

    // Build search/filter. Archived view lists soft-deleted therapists (for restore).
    const where = {
      deleted_at: archived ? { not: null } : null,
      ...(searchTerm && {
        OR: [
          { full_name: { contains: searchTerm, mode: "insensitive" } },
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
      full_name: t.full_name,
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
