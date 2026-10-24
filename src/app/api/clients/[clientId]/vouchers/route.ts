import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const fullName = (c: { client_name: string | null; client_surname: string | null } | undefined) =>
  c ? [c.client_name, c.client_surname].map((s) => s?.trim()).filter(Boolean).join(" ") || null : null;

// The client's vouchers, both bought and received, newest first — for the client's view dialog.
// `role` is "both" for a voucher they bought for themselves; `other` is the other party (who it
// was bought for, or who it came from).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;

    const vouchers = await prisma.vouchers.findMany({
      where: { deleted_at: null, OR: [{ buyer_id: clientId }, { recipient_id: clientId }] },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        code: true,
        buyer_id: true,
        recipient_id: true,
        balance: true,
        created_at: true,
        expiration_date: true,
      },
    });

    // vouchers.buyer_id / recipient_id carry no FK, so the other parties are looked up by id.
    const otherIds = [
      ...new Set(vouchers.flatMap((v) => [v.buyer_id, v.recipient_id]).filter((id) => id && id !== clientId)),
    ] as string[];
    const others = otherIds.length
      ? await prisma.clients.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, client_name: true, client_surname: true },
        })
      : [];
    const nameOf = (id: string | null) => fullName(others.find((o) => o.id === id));

    return NextResponse.json({
      rows: vouchers.map((v) => {
        const bought = v.buyer_id === clientId;
        // A voucher with no separate recipient is the buyer's own.
        const received = v.recipient_id === clientId || (bought && !v.recipient_id);
        const role = bought && received ? "both" : bought ? "buyer" : "recipient";
        return {
          id: v.id,
          code: v.code,
          role,
          other: role === "buyer" ? nameOf(v.recipient_id) : role === "recipient" ? nameOf(v.buyer_id) : null,
          balance: Number(v.balance ?? 0),
          created_at: v.created_at,
          expiration_date: v.expiration_date,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/clients/[clientId]/vouchers error", err);
    return NextResponse.json({ error: "Failed to load client vouchers" }, { status: 500 });
  }
}
