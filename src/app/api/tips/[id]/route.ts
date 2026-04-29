import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
