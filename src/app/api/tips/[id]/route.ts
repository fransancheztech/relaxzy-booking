import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ivaAppliesForTipMethod } from "@/utils/tipIva";

const VALID_METHODS = ["cash", "credit_card"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const tip = await prisma.tips.findFirst({ where: { id, deleted_at: null } });
    if (!tip) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }
    if (tip.payout_id !== null) {
      return NextResponse.json({ error: "Cannot edit a released tip" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (body.therapist_id !== undefined) data.therapist_id = body.therapist_id;
    if (body.payment_method !== undefined) {
      if (!VALID_METHODS.includes(body.payment_method)) return NextResponse.json({ error: "Invalid payment_method" }, { status: 400 });
      // A tip may never be switched TO cash. Rows recorded as cash before this rule stay
      // editable — re-sending their own current method is not a change — so their notes
      // and therapist can still be corrected, and they can be moved to card.
      if (body.payment_method === "cash" && tip.payment_method !== "cash") {
        return NextResponse.json(
          { error: "Cash tips must not be recorded. Only card tips are recorded here." },
          { status: 422 },
        );
      }
      data.payment_method = body.payment_method;
      // iva_applies is always derived from the method, never set by the client.
      data.iva_applies = ivaAppliesForTipMethod(body.payment_method);
    }
    if ("notes" in body) data.notes = body.notes?.trim() || null;

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    await prisma.tips.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/tips/[id] error", err);
    return NextResponse.json({ error: "Failed to update tip" }, { status: 500 });
  }
}

// Removing a tip takes money away from a therapist, so it has to say why — same bar as removing a
// payment or a voucher redemption. The reason is appended to the tip's notes ("Reason of delete: …").
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { notes } = await request.json().catch(() => ({ notes: undefined }));
  const reason = typeof notes === "string" ? notes.trim() : "";
  if (!reason || reason.length > 500) {
    return NextResponse.json({ error: "A reason note is required" }, { status: 400 });
  }

  try {
    const tip = await prisma.tips.findUnique({ where: { id } });

    if (!tip || tip.deleted_at) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }

    if (tip.payout_id) {
      return NextResponse.json(
        { error: "Cannot delete a tip that has been included in a payout" },
        { status: 409 }
      );
    }

    const reasonNote = `Reason of delete: ${reason}`;
    await prisma.tips.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        notes: tip.notes?.trim() ? `${tip.notes.trim()} ${reasonNote}` : reasonNote,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tips/[id] error", err);
    return NextResponse.json({ error: "Failed to delete tip" }, { status: 500 });
  }
}
