import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IVA_RATE = 0.21;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { therapist_id, tip_ids, notes } = body;

    if (!therapist_id || !Array.isArray(tip_ids) || tip_ids.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tips = await prisma.tips.findMany({
      where: { id: { in: tip_ids }, therapist_id, deleted_at: null, payout_id: null },
    });

    if (tips.length !== tip_ids.length) {
      return NextResponse.json(
        { error: "Some tips are invalid, already paid out, or deleted" },
        { status: 409 },
      );
    }

    let gross = 0;
    let ivaTotal = 0;
    for (const tip of tips) {
      const amount = Number(tip.amount);
      gross += amount;
      if (tip.iva_applies) ivaTotal += amount * IVA_RATE;
    }

    const payout = await prisma.$transaction(async (tx) => {
      const created = await tx.tip_payouts.create({
        data: {
          therapist_id,
          gross_amount: Math.round(gross * 100) / 100,
          iva_amount: Math.round(ivaTotal * 100) / 100,
          net_amount: Math.round((gross - ivaTotal) * 100) / 100,
          paid_at: new Date(),
          notes: notes?.trim() || null,
        },
      });

      await tx.tips.updateMany({
        where: { id: { in: tip_ids } },
        data: { payout_id: created.id },
      });

      return created;
    });

    return NextResponse.json({ payout });
  } catch (err) {
    console.error("POST /api/tip-payouts error", err);
    return NextResponse.json({ error: "Failed to create payout" }, { status: 500 });
  }
}
