import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { foldText } from "@/utils/text";
import {
  POSITIVE_OF,
  dateFilter,
  numberFilter,
  selectFilter,
  textFilter,
  type FilterItem,
} from "@/lib/gridFilters";

const SORTABLE_FIELDS = new Set([
  "created_at",
  "expiration_date",
  "code",
  "balance",
  "notes",
  "source",
  "external_reference",
]);

/**
 * Buyer / recipient are shown from related clients, and vouchers.buyer_id / recipient_id carry no
 * FK, so a name filter first finds the matching clients, then filters vouchers by their ids. For a
 * negative operator ("does not contain") the clients that DO match are excluded instead — and a
 * voucher with no separate recipient ("Same as buyer") counts as not matching any name.
 */
async function clientNameCondition(
  fk: "buyer_id" | "recipient_id",
  op: string,
  value: unknown,
): Promise<Prisma.vouchersWhereInput | null> {
  const negative = op in POSITIVE_OF;
  const nameCond = textFilter("client_full_name_folded", POSITIVE_OF[op] ?? op, value, { normalize: foldText });
  if (!nameCond) return null;
  const ids = (
    await prisma.clients.findMany({ where: { AND: [{ deleted_at: null }, nameCond] }, select: { id: true } })
  ).map((c) => c.id);
  if (!negative) return { [fk]: { in: ids } };
  return fk === "recipient_id"
    ? { OR: [{ recipient_id: null }, { NOT: { recipient_id: { in: ids } } }] }
    : { NOT: { buyer_id: { in: ids } } };
}

// Each column with every operator the grid offers for it (see lib/gridFilters).
async function buildFilterCondition(item: FilterItem): Promise<Prisma.vouchersWhereInput | null> {
  const op = item.operator ?? "contains";
  const v = item.value;
  switch (item.field) {
    // Full name, accent-insensitive: "rocio soto" finds Rocío Sotomayor.
    case "buyer_name":         return clientNameCondition("buyer_id", op, v);
    case "recipient_name":     return clientNameCondition("recipient_id", op, v);
    case "code":               return textFilter("code", op, v, { insensitive: true, required: true });
    case "notes":              return textFilter("notes", op, v, { insensitive: true });
    case "external_reference": return textFilter("external_reference", op, v, { insensitive: true });
    case "source":             return selectFilter("source", op, v, ["physical", "online"]);
    case "balance":            return numberFilter("balance", op, v);
    case "expiration_date":    return dateFilter("expiration_date", op, v, { required: true });
    case "created_at":         return dateFilter("created_at", op, v);
    default:                   return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const page: number = body.page ?? 0;
    const limit: number = body.limit ?? 100;
    const sortField: string = SORTABLE_FIELDS.has(body.sort?.field) ? body.sort.field : "created_at";
    const sortDir: "asc" | "desc" = body.sort?.sort === "asc" ? "asc" : "desc";
    const filterItems: FilterItem[] = Array.isArray(body.filterItems) ? body.filterItems : [];

    const where: Prisma.vouchersWhereInput = { deleted_at: null };
    const conditions: Prisma.vouchersWhereInput[] = [];
    for (const item of filterItems) {
      const cond = await buildFilterCondition(item);
      if (cond) conditions.push(cond);
    }

    if (conditions.length > 0) where.AND = conditions;

    const [vouchers, total] = await Promise.all([
      prisma.vouchers.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { [sortField]: sortDir },
      }),
      prisma.vouchers.count({ where }),
    ]);

    const clientIds = [
      ...new Set([
        ...vouchers.map((v) => v.buyer_id),
        ...vouchers.filter((v) => v.recipient_id).map((v) => v.recipient_id!),
      ]),
    ];

    const clients =
      clientIds.length > 0
        ? await prisma.clients.findMany({
            where: { id: { in: clientIds } },
            select: {
              id: true,
              client_name: true,
              client_surname: true,
              client_email: true,
              client_phone: true,
            },
          })
        : [];

    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const rows = vouchers.map((v) => {
      const buyer = clientMap.get(v.buyer_id) ?? null;
      const recipient = v.recipient_id ? (clientMap.get(v.recipient_id) ?? null) : null;
      return {
        id: v.id,
        code: v.code,
        balance: v.balance?.toString() ?? null,
        expiration_date: v.expiration_date,
        created_at: v.created_at,
        notes: v.notes,
        source: v.source,
        external_reference: v.external_reference,
        buyer_id: v.buyer_id,
        recipient_id: v.recipient_id,
        buyer_name: buyer?.client_name ?? null,
        buyer_surname: buyer?.client_surname ?? null,
        buyer_email: buyer?.client_email ?? null,
        buyer_phone: buyer?.client_phone ?? null,
        recipient_name: recipient?.client_name ?? null,
        recipient_surname: recipient?.client_surname ?? null,
      };
    });

    return NextResponse.json({ rows, total });
  } catch (err) {
    console.error("Error listing vouchers", err);
    return NextResponse.json({ error: "Error loading vouchers" }, { status: 500 });
  }
}
