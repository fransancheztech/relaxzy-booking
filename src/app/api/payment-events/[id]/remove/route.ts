import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await req.json();
    const { notes } = body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return NextResponse.json(
        { error: "A reason note is required" },
        { status: 400 }
      );
    }

    const event = await prisma.payment_events.findFirst({
      where: { id: eventId, deleted_at: null },
      select: { id: true, payment_id: true, type: true, amount: true, notes: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Payment event not found" }, { status: 404 });
    }

    // Refunds are removable too — a refund registered on the wrong booking, or entered when the
    // charge itself should have been removed, has to be undoable. What's enforced instead is the
    // real invariant: a payment must never end up with more refunded than charged (a phantom
    // negative payment). That also forces the correct order — a mistaken refund must be removed
    // before the charge it was taken against.
    if (event.payment_id) {
      const [remaining] = await prisma.$queryRaw<{ net: number }[]>`
        SELECT COALESCE(
          SUM(CASE WHEN pe.type = 'CHARGE' THEN pe.amount ELSE -pe.amount END), 0
        )::float AS net
        FROM payment_events pe
        WHERE pe.payment_id = ${event.payment_id}::uuid
          AND pe.deleted_at IS NULL
          AND pe.id <> ${eventId}::uuid
      `;
      // Tolerance absorbs float drift on values the DB stores as numeric(10,2).
      if (Number(remaining?.net ?? 0) < -0.005) {
        return NextResponse.json(
          { error: "REMOVE_WOULD_GO_NEGATIVE" },
          { status: 409 }
        );
      }
    }

    const performed_by = await getCurrentUserId();

    // "Who removed it" is now captured by the audit log (see below); the notes keep just
    // the human-readable reason.
    const reasonNote = `Reason of delete: ${notes.trim()}`;
    const updatedNotes = event.notes ? `${event.notes} ${reasonNote}` : reasonNote;

    await prisma.$transaction(async (tx) => {
      // Attribute this write to the acting user so the payment-events/payments audit-log
      // triggers record who removed the event. Prisma writes don't populate auth.uid(),
      // so we pass the id via a transaction-local GUC the triggers read (falling back to
      // auth.uid() when unset). Must run before the writes, in the same transaction.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by ?? ""}, true)`;

      await tx.payment_events.update({
        where: { id: eventId },
        data: { deleted_at: new Date(), notes: updatedNotes },
      });

      if (event.payment_id) {
        // Recomputed from the surviving events rather than applying a delta: the direction
        // depends on the event type (removing a CHARGE lowers the net, removing a REFUND raises
        // it), and a full recompute is self-healing if the stored total ever drifted. Runs after
        // the soft-delete above, so the removed event is already excluded.
        await tx.$queryRaw`
          UPDATE payments p
          SET amount = COALESCE((
            SELECT SUM(CASE WHEN pe.type = 'CHARGE' THEN pe.amount ELSE -pe.amount END)
            FROM payment_events pe
            WHERE pe.payment_id = p.id AND pe.deleted_at IS NULL
          ), 0)
          WHERE p.id = ${event.payment_id}::uuid
        `;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /payment-events/[id]/remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove payment event" },
      { status: 500 }
    );
  }
}
