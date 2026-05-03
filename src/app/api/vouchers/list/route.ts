import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

const SORTABLE_FIELDS = new Set(["created_at", "expiration_date", "code", "balance", "notes"]);

function getMadridDateRange(isoStr: string): { gte: Date; lt: Date } | null {
  const parsed = new Date(isoStr);
  if (isNaN(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear(), m = parsed.getUTCMonth(), d = parsed.getUTCDate();
  const probe = new Date(Date.UTC(y, m, d, 12));
  const localStr = probe.toLocaleString("sv", { timeZone: "Europe/Madrid" });
  const offsetMs = probe.getTime() - new Date(localStr.replace(" ", "T") + "Z").getTime();
  const gte = new Date(Date.UTC(y, m, d, 0, 0, 0) + offsetMs);
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

function getUTCDayRange(isoStr: string): { gte: Date; lt: Date } | null {
  const parsed = new Date(isoStr);
  if (isNaN(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear(), m = parsed.getUTCMonth(), d = parsed.getUTCDate();
  const gte = new Date(Date.UTC(y, m, d));
  return { gte, lt: new Date(Date.UTC(y, m, d + 1)) };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const page: number = body.page ?? 0;
    const limit: number = body.limit ?? 100;
    const sortField: string = SORTABLE_FIELDS.has(body.sort?.field) ? body.sort.field : "created_at";
    const sortDir: "asc" | "desc" = body.sort?.sort === "asc" ? "asc" : "desc";
    const filterItems: { field: string; operator?: string; value?: unknown }[] = body.filterItems ?? [];

    const where: Prisma.vouchersWhereInput = { deleted_at: null };
    const conditions: Prisma.vouchersWhereInput[] = [];

    // buyer_name and recipient_name are computed from related clients — resolve IDs first
    const buyerFilter = filterItems.find(
      (i) => i.field === "buyer_name" && typeof i.value === "string" && i.value
    );
    const recipientFilter = filterItems.find(
      (i) => i.field === "recipient_name" && typeof i.value === "string" && i.value
    );

    if (buyerFilter) {
      const matches = await prisma.clients.findMany({
        where: {
          deleted_at: null,
          OR: [
            { client_name: { contains: buyerFilter.value as string, mode: "insensitive" } },
            { client_surname: { contains: buyerFilter.value as string, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      conditions.push({ buyer_id: { in: matches.map((c) => c.id) } });
    }

    if (recipientFilter) {
      const matches = await prisma.clients.findMany({
        where: {
          deleted_at: null,
          OR: [
            { client_name: { contains: recipientFilter.value as string, mode: "insensitive" } },
            { client_surname: { contains: recipientFilter.value as string, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      conditions.push({ recipient_id: { in: matches.map((c) => c.id) } });
    }

    // Direct-field filters
    for (const item of filterItems) {
      if (!item.field || item.value === undefined || item.value === null || item.value === "") continue;
      if (item.field === "buyer_name" || item.field === "recipient_name") continue; // handled above
      const op = (item.operator ?? "contains") as string;
      let cond: Prisma.vouchersWhereInput | null = null;

      switch (item.field) {
        case "code":
          if (typeof item.value === "string")
            cond = { code: { contains: item.value, mode: "insensitive" } };
          break;
        case "notes":
          if (typeof item.value === "string")
            cond = { notes: { contains: item.value, mode: "insensitive" } };
          break;
        case "balance": {
          const num = typeof item.value === "number" ? item.value : parseFloat(String(item.value));
          if (!isNaN(num)) {
            switch (op) {
              case "!=":  cond = { NOT: { balance: num } }; break;
              case ">":   cond = { balance: { gt: num } }; break;
              case ">=":  cond = { balance: { gte: num } }; break;
              case "<":   cond = { balance: { lt: num } }; break;
              case "<=":  cond = { balance: { lte: num } }; break;
              default:    cond = { balance: num }; break;
            }
          }
          break;
        }
        case "expiration_date": {
          const range = typeof item.value === "string" ? getUTCDayRange(item.value) : null;
          if (range) {
            switch (op) {
              case "not":        cond = { NOT: { expiration_date: { gte: range.gte, lt: range.lt } } }; break;
              case "after":      cond = { expiration_date: { gte: range.lt } }; break;
              case "onOrAfter":  cond = { expiration_date: { gte: range.gte } }; break;
              case "before":     cond = { expiration_date: { lt: range.gte } }; break;
              case "onOrBefore": cond = { expiration_date: { lt: range.lt } }; break;
              default:           cond = { expiration_date: { gte: range.gte, lt: range.lt } }; break;
            }
          }
          break;
        }
        case "created_at": {
          const range = typeof item.value === "string" ? getMadridDateRange(item.value) : null;
          if (range) {
            switch (op) {
              case "not":        cond = { NOT: { created_at: { gte: range.gte, lt: range.lt } } }; break;
              case "after":      cond = { created_at: { gte: range.lt } }; break;
              case "onOrAfter":  cond = { created_at: { gte: range.gte } }; break;
              case "before":     cond = { created_at: { lt: range.gte } }; break;
              case "onOrBefore": cond = { created_at: { lt: range.lt } }; break;
              default:           cond = { created_at: { gte: range.gte, lt: range.lt } }; break;
            }
          }
          break;
        }
      }

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
