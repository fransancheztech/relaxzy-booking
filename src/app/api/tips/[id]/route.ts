import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_METHODS = ["cash", "credit_card", "voucher"] as const;

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
    if (body.received_at !== undefined) {
      const d = new Date(body.received_at);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid received_at" }, { status: 400 });
      data.received_at = d;
    }
    if (body.payment_method !== undefined) {
      if (!VALID_METHODS.includes(body.payment_method)) return NextResponse.json({ error: "Invalid payment_method" }, { status: 400 });
      data.payment_method = body.payment_method;
    }
    if (body.iva_applies !== undefined) data.iva_applies = Boolean(body.iva_applies);
    if ("notes" in body) data.notes = body.notes?.trim() || null;

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    await prisma.tips.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/tips/[id] error", err);
    return NextResponse.json({ error: "Failed to update tip" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

    await prisma.tips.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tips/[id] error", err);
    return NextResponse.json({ error: "Failed to delete tip" }, { status: 500 });
  }
}
