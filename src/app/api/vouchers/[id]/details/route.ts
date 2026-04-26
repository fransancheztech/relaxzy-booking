import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [voucher, paymentEvents, voucherUses] = await Promise.all([
      prisma.vouchers.findFirst({ where: { id, deleted_at: null } }),
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

    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    return NextResponse.json({ voucher, paymentEvents, voucherUses });
  } catch (err) {
    console.error("Error fetching voucher details", err);
    return NextResponse.json(
      { error: "Error fetching voucher details" },
      { status: 500 },
    );
  }
}
