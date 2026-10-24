import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { foldText } from "@/utils/text";
import { dateFilter, phoneFilter, textFilter, type FilterItem } from "@/lib/gridFilters";

const SORTABLE_FIELDS = new Set([
  "client_name", "client_surname", "client_email", "client_phone", "client_notes", "created_at",
]);

// Each column with every operator the grid offers for it (see lib/gridFilters).
function buildFilterCondition(item: FilterItem): Prisma.clientsWhereInput | null {
  const op = item.operator ?? "contains";
  const v = item.value;
  switch (item.field) {
    // Names through the folded columns: accent- and case-insensitive ("Rocio" finds "Rocío").
    case "client_name":    return textFilter("client_name_folded", op, v, { normalize: foldText });
    case "client_surname": return textFilter("client_surname_folded", op, v, { normalize: foldText });
    case "client_email":   return textFilter("client_email", op, v, { insensitive: true });
    case "client_phone":   return phoneFilter("client_phone", op, v);
    case "client_notes":   return textFilter("client_notes", op, v, { insensitive: true });
    case "created_at":     return dateFilter("created_at", op, v, { required: true });
    default:               return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { page, limit, sort, filterItems } = await req.json();

    const where: Prisma.clientsWhereInput = { deleted_at: null };

    if (Array.isArray(filterItems)) {
      const conditions: Prisma.clientsWhereInput[] = [];
      for (const item of filterItems as FilterItem[]) {
        const cond = buildFilterCondition(item);
        if (cond) conditions.push(cond);
      }
      if (conditions.length > 0) where.AND = conditions;
    }

    const sortField = SORTABLE_FIELDS.has(sort?.field) ? sort.field : "created_at";
    const sortDir: "asc" | "desc" = sort?.sort === "asc" ? "asc" : "desc";

    const [rows, total] = await Promise.all([
      prisma.clients.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { [sortField]: sortDir },
      }),
      prisma.clients.count({ where }),
    ]);

    return NextResponse.json({ rows, total });
  } catch (err) {
    console.error("Error fetching clients:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
