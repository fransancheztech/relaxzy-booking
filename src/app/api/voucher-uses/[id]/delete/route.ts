import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { recalculateVoucherBalance } from "@/lib/recalculateVoucherBalance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { notes } = await request.json().catch(() => ({ notes: undefined }));

    // Removing a redemption puts spendable balance back on the voucher, so it has to say why —
    // same bar as removing a payment event.
    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return NextResponse.json(
        { error: "A reason note is required" },
        { status: 400 },
      );
    }

    const performed_by = await getCurrentUserId();

    await prisma.$transaction(async (tx) => {
      // Attributes both the voucher_uses_history row and the vouchers_history row that
      // recalculateVoucherBalance's update triggers.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by ?? ""}, true)`;

      const use = await tx.voucher_uses.findFirst({
        where: { id, deleted_at: null },
      });

      if (!use) throw new Error("Voucher use not found");

      // Appended, not replaced — the row may already carry a note from when it was redeemed.
      // Same prefix convention as the payment-event removal, so both read alike in the DB.
      const reasonNote = `Reason of delete: ${notes.trim()}`;
      const updatedNotes = use.notes ? `${use.notes} ${reasonNote}` : reasonNote;

      await tx.voucher_uses.update({
        where: { id },
        data: { deleted_at: new Date(), notes: updatedNotes },
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
