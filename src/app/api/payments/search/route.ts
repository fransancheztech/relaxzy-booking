import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

const SORTABLE_FIELDS = new Set(["booking_id", "voucher_id", "amount", "created_at"]);

function getMadridDateRange(dateStr: string): { gte: Date; lt: Date } | null {
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  const localStr = probe.toLocaleString("sv", { timeZone: "Europe/Madrid" });
  const offsetMs = probe.getTime() - new Date(localStr.replace(" ", "T") + "Z").getTime();

  const gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs);
  const lt  = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

function buildFilterCondition(
  field: string,
  operator: string,
  value: string,
): Prisma.paymentsWhereInput | null {
  switch (field) {
    case "amount": {
      const num = parseFloat(value);
      if (isNaN(num)) return null;
      switch (operator) {
        case "!=":  return { NOT: { amount: num } };
        case ">":   return { amount: { gt: num } };
        case ">=":  return { amount: { gte: num } };
        case "<":   return { amount: { lt: num } };
        case "<=":  return { amount: { lte: num } };
        default:    return { amount: num };
      }
    }
    case "created_at": {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) return null;
      const dateStr = parsed.toLocaleDateString("es-ES");
      const range = getMadridDateRange(dateStr);
      if (!range) return null;
      switch (operator) {
        case "not":        return { NOT: { created_at: { gte: range.gte, lt: range.lt } } };
        case "after":      return { created_at: { gte: range.lt } };
        case "onOrAfter":  return { created_at: { gte: range.gte } };
        case "before":     return { created_at: { lt: range.gte } };
        case "onOrBefore": return { created_at: { lt: range.lt } };
        default:           return { created_at: { gte: range.gte, lt: range.lt } };
      }
    }
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { page, limit, sort, filterItems } = await req.json();

    const where: Prisma.paymentsWhereInput = { deleted_at: null };

    if (Array.isArray(filterItems)) {
      const conditions: Prisma.paymentsWhereInput[] = [];
      for (const item of filterItems) {
        if (item.field && typeof item.value === "string" && item.value !== "") {
          const cond = buildFilterCondition(item.field, item.operator ?? "contains", item.value);
          if (cond) conditions.push(cond);
        }
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
