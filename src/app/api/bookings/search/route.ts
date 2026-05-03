import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingListItem } from "@/types/bookings";
import { Prisma, booking_status } from "generated/prisma";

const VALID_STATUSES: booking_status[] = ["pending", "confirmed", "completed", "cancelled"];

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

function buildOrderBy(field: string, direction: "asc" | "desc"): Prisma.bookingsOrderByWithRelationInput {
  switch (field) {
    case "customer_name":  return { clients: { client_name: direction } };
    case "customer_phone": return { clients: { client_phone: direction } };
    case "service":        return { services_names: { name: direction } };
    case "therapist":      return { therapists: { full_name: direction } };
    case "status":         return { status: direction };
    case "notes":          return { notes: direction };
    case "price":          return { price: direction };
    case "created_at":     return { created_at: direction };
    case "time":
    case "start_time":
    default:               return { start_time: direction };
  }
}

function buildFilterCondition(
  field: string,
  operator: string,
  value: string | number,
): Prisma.bookingsWhereInput | null {
  switch (field) {
    case "start_time": {
      if (typeof value !== "string") return null;
      const range = getMadridDateRange(value);
      return range ? { start_time: { gte: range.gte, lt: range.lt } } : null;
    }
    case "customer_name": {
      if (typeof value !== "string") return null;
      return {
        clients: {
          OR: [
            { client_name: { contains: value, mode: "insensitive" } },
            { client_surname: { contains: value, mode: "insensitive" } },
          ],
        },
      };
    }
    case "customer_phone":
      if (typeof value !== "string") return null;
      return { clients: { client_phone: { contains: value, mode: "insensitive" } } };
    case "service":
      if (typeof value !== "string") return null;
      return { services_names: { short_name: { contains: value, mode: "insensitive" } } };
    case "therapist":
      if (typeof value !== "string") return null;
      return { therapists: { full_name: { contains: value, mode: "insensitive" } } };
    case "status":
      if (typeof value !== "string") return null;
      return VALID_STATUSES.includes(value as booking_status)
        ? { status: value as booking_status }
        : null;
    case "price": {
      const num = typeof value === "number" ? value : parseFloat(value);
      if (isNaN(num)) return null;
      switch (operator) {
        case "!=":  return { NOT: { price: num } };
        case ">":   return { price: { gt: num } };
        case ">=":  return { price: { gte: num } };
        case "<":   return { price: { lt: num } };
        case "<=":  return { price: { lte: num } };
        default:    return { price: num };
      }
    }
    case "notes":
      if (typeof value !== "string") return null;
      return { notes: { contains: value, mode: "insensitive" } };
    case "created_at": {
      if (typeof value !== "string") return null;
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
    const { page, limit, searchTerm, sort, filterItems } = await req.json();

    if (typeof searchTerm !== "string") {
      return NextResponse.json({ error: "Invalid searchTerm" }, { status: 400 });
    }

    const where: Prisma.bookingsWhereInput = { deleted_at: null };

    if (Array.isArray(filterItems)) {
      const conditions: Prisma.bookingsWhereInput[] = [];
      for (const item of filterItems) {
        if (item.field && item.value !== undefined && item.value !== null && item.value !== "") {
          const cond = buildFilterCondition(item.field, item.operator ?? "contains", item.value as string | number);
          if (cond) conditions.push(cond);
        }
      }
      if (conditions.length > 0) {
        where.AND = conditions;
      }
    }

    if (searchTerm) {
      where.OR = [
        { notes: { contains: searchTerm, mode: "insensitive" } },
        {
          clients: {
            OR: [
              { client_name: { contains: searchTerm, mode: "insensitive" } },
              { client_surname: { contains: searchTerm, mode: "insensitive" } },
              { client_email: { contains: searchTerm, mode: "insensitive" } },
              { client_phone: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
        {
          services_names: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { short_name: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.bookings.findMany({
        where,
        include: {
          clients: true,
          services_names: true,
          therapists: true,
          payments: { include: { payment_events: true } },
        },
        skip: page * limit,
        take: limit,
        orderBy: buildOrderBy(sort?.field ?? "start_time", sort?.sort ?? "desc"),
      }),
      prisma.bookings.count({ where }),
    ]);

    const data: BookingListItem[] = rows.map((b) => ({
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      price: b.price?.toString() ?? null,
      notes: b.notes,
      created_at: b.created_at,
      updated_at: b.updated_at,
      client: b.clients
        ? {
            id: b.clients.id,
            name: b.clients.client_name,
            surname: b.clients.client_surname,
            email: b.clients.client_email,
            phone: b.clients.client_phone,
          }
        : null,
      service: b.services_names
        ? {
            id: b.services_names.id,
            name: b.services_names.name,
            short_name: b.services_names.short_name,
          }
        : null,
      therapist: b.therapists
        ? { id: b.therapists.id, full_name: b.therapists.full_name }
        : null,
      payments: b.payments.map((p) => {
        const refunded = Math.abs(
          p.payment_events
            .filter((e) => e.type === "REFUND")
            .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
        );
        return {
          id: p.id,
          amount: p.amount?.toString() ?? "0",
          refunded: refunded > 0 ? refunded.toString() : null,
          created_at: p.created_at,
        };
      }),
    }));

    return NextResponse.json({ rows: data, total });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
