import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const voucher = await prisma.vouchers.findFirst({ where: { id, deleted_at: null } });

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    const [buyer, recipient, paymentEvents, voucherUses] = await Promise.all([
      prisma.clients.findFirst({
        where: { id: voucher.buyer_id, deleted_at: null },
        select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
      }),
      voucher.recipient_id && voucher.recipient_id !== voucher.buyer_id
        ? prisma.clients.findFirst({
            where: { id: voucher.recipient_id, deleted_at: null },
            select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
          })
        : Promise.resolve(null),
      prisma.payment_events.findMany({
        where: {
          deleted_at: null,
          payments: { voucher_id: id, deleted_at: null },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.voucher_uses.findMany({
        where: { voucher_id: id, deleted_at: null },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return NextResponse.json({ voucher, buyer, recipient, paymentEvents, voucherUses });
  } catch (err) {
    console.error("Error fetching voucher details", err);
    return NextResponse.json(
      { error: "Error fetching voucher details" },
      { status: 500 },
    );
  }
}
