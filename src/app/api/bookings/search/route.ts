import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingListItem } from "@/types/bookings";
import { Prisma, booking_status } from "generated/prisma";
import { therapistDisplayName } from "@/utils/therapistName";
import { phoneSearchTerms } from "@/utils/phone";
import { foldText } from "@/utils/text";
import {
  dateFilter,
  numberFilter,
  phoneFilter,
  selectFilter,
  textFilter,
  textFilterAny,
  viaRelation,
  type FilterItem,
} from "@/lib/gridFilters";

const VALID_STATUSES: booking_status[] = ["pending", "confirmed", "completed", "cancelled"];

function buildOrderBy(field: string, direction: "asc" | "desc"): Prisma.bookingsOrderByWithRelationInput {
  switch (field) {
    case "customer_name":  return { clients: { client_name: direction } };
    case "customer_phone": return { clients: { client_phone: direction } };
    case "service":        return { services_names: { name: direction } };
    case "therapist":      return { therapists: { nickname: direction } };
    case "status":         return { status: direction };
    case "notes":          return { notes: direction };
    case "price":          return { price: direction };
    case "created_at":     return { created_at: direction };
    case "time":
    case "start_time":
    default:               return { start_time: direction };
  }
}

// Each column with every operator the grid offers for it (see lib/gridFilters). Columns shown from
// a related record go through viaRelation, so "customer is empty" also finds anonymous bookings.
function buildFilterCondition(item: FilterItem): Prisma.bookingsWhereInput | null {
  const op = item.operator ?? "contains";
  const v = item.value;
  switch (item.field) {
    case "start_time":
      return dateFilter("start_time", op, v);
    case "customer_name":
      // Full name, accent-insensitive: "rocio soto" finds Rocío (name) Sotomayor (surname).
      return viaRelation("clients", "client_id", op,
        textFilter("client_full_name_folded", op, v, { normalize: foldText }));
    case "customer_phone":
      return viaRelation("clients", "client_id", op, phoneFilter("client_phone", op, v));
    case "service":
      return viaRelation("services_names", "service_id", op,
        textFilterAny(["short_name", "name"], op, v, { insensitive: true, requiredColumns: ["name"] }));
    case "therapist":
      return viaRelation("therapists", "therapist_id", op,
        textFilterAny(["nickname", "name", "surname"], op, v, { insensitive: true }));
    case "status":
      return selectFilter("status", op, v, VALID_STATUSES);
    case "price":
      return numberFilter("price", op, v);
    case "notes":
      return textFilter("notes", op, v, { insensitive: true });
    case "created_at":
      return dateFilter("created_at", op, v, { required: true });
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
      for (const item of filterItems as FilterItem[]) {
        const cond = buildFilterCondition(item);
        if (cond) conditions.push(cond);
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
              { client_full_name_folded: { contains: foldText(searchTerm) } },
              { client_email: { contains: searchTerm, mode: "insensitive" } },
              // Free text, so digits only count from three onwards ("Room 2" must not match
              // every number containing a 2).
              ...phoneSearchTerms(searchTerm, 3).map((term) => ({
                client_phone: { contains: term, mode: "insensitive" as const },
              })),
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
      booking_group_id: b.booking_group_id,
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
        ? { id: b.therapists.id, full_name: therapistDisplayName(b.therapists) }
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
