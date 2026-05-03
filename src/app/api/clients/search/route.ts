import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

const SORTABLE_FIELDS = new Set([
  "client_name", "client_surname", "client_email", "client_phone", "client_notes", "created_at",
]);

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
): Prisma.clientsWhereInput | null {
  switch (field) {
    case "client_name":
      return { client_name: { contains: value, mode: "insensitive" } };
    case "client_surname":
      return { client_surname: { contains: value, mode: "insensitive" } };
    case "client_email":
      return { client_email: { contains: value, mode: "insensitive" } };
    case "client_phone":
      return { client_phone: { contains: value, mode: "insensitive" } };
    case "client_notes":
      return { client_notes: { contains: value, mode: "insensitive" } };
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

    const where: Prisma.clientsWhereInput = { deleted_at: null };

    if (Array.isArray(filterItems)) {
      const conditions: Prisma.clientsWhereInput[] = [];
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
