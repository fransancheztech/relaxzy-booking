import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SORTABLE_FIELDS = new Set(["created_at", "expiration_date", "code", "balance"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const page: number = body.page ?? 0;
    const limit: number = body.limit ?? 100;
    const sortField: string = SORTABLE_FIELDS.has(body.sort?.field) ? body.sort.field : "created_at";
    const sortDir: "asc" | "desc" = body.sort?.sort === "asc" ? "asc" : "desc";

    const where = { deleted_at: null };

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
