import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateVoucherBalance } from "@/lib/recalculateVoucherBalance";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const use = await tx.voucher_uses.findFirst({
        where: { id, deleted_at: null },
      });

      if (!use) throw new Error("Voucher use not found");

      await tx.voucher_uses.update({
        where: { id },
        data: { deleted_at: new Date() },
      });

      await recalculateVoucherBalance(tx, use.voucher_id);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting voucher use", err);
    const message =
      err instanceof Error ? err.message : "Error deleting voucher use";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
