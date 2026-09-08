import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { recalculateVoucherBalance } from "@/lib/recalculateVoucherBalance";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const performed_by = await getCurrentUserId();

    await prisma.$transaction(async (tx) => {
      // Attributes both the voucher_uses_history row and the vouchers_history row that
      // recalculateVoucherBalance's update triggers.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by ?? ""}, true)`;

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
