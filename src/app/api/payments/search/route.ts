import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { dateFilter, numberFilter, type FilterItem } from "@/lib/gridFilters";

const SORTABLE_FIELDS = new Set(["booking_id", "voucher_id", "amount", "created_at"]);

// Each column with every operator the grid offers for it (see lib/gridFilters).
function buildFilterCondition(item: FilterItem): Prisma.paymentsWhereInput | null {
  const op = item.operator ?? "=";
  switch (item.field) {
    case "amount":     return numberFilter("amount", op, item.value);
    case "created_at": return dateFilter("created_at", op, item.value, { required: true });
    default:           return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { page, limit, sort, filterItems } = await req.json();

    const where: Prisma.paymentsWhereInput = { deleted_at: null };

    if (Array.isArray(filterItems)) {
      const conditions: Prisma.paymentsWhereInput[] = [];
      for (const item of filterItems as FilterItem[]) {
        const cond = buildFilterCondition(item);
        if (cond) conditions.push(cond);
      }
      if (conditions.length > 0) where.AND = conditions;
    }

    const sortField = SORTABLE_FIELDS.has(sort?.field) ? sort.field : "created_at";
    const sortDir: "asc" | "desc" = sort?.sort === "asc" ? "asc" : "desc";

    const [rows, total] = await Promise.all([
      prisma.payments.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { [sortField]: sortDir },
      }),
      prisma.payments.count({ where }),
    ]);

    return NextResponse.json({ rows, total });
  } catch (err) {
    console.error("Error fetching payments:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
