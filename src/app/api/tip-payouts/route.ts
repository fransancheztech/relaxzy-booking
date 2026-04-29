import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IVA_RATE = 0.21;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { therapist_id, period_year, period_month, tip_ids, notes } = body;

    if (!therapist_id || !period_year || !period_month || !Array.isArray(tip_ids) || tip_ids.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify all tips exist, belong to this therapist/period, and are not yet paid out
    const tips = await prisma.tips.findMany({
      where: {
        id: { in: tip_ids },
        therapist_id,
        deleted_at: null,
        payout_id: null,
      },
    });

    if (tips.length !== tip_ids.length) {
      return NextResponse.json(
        { error: "Some tips are invalid, already paid out, or deleted" },
        { status: 409 }
      );
    }

    // Compute totals
    let gross = 0;
    let ivaTotal = 0;
    for (const tip of tips) {
      const amount = Number(tip.amount);
      const iva = tip.iva_applies ? amount * IVA_RATE : 0;
      gross += amount;
      ivaTotal += iva;
    }

    const grossRounded = Math.round(gross * 100) / 100;
    const ivaRounded = Math.round(ivaTotal * 100) / 100;
    const netRounded = Math.round((gross - ivaTotal) * 100) / 100;

    const payout = await prisma.$transaction(async (tx) => {
      const created = await tx.tip_payouts.create({
        data: {
          therapist_id,
          period_year,
          period_month,
          gross_amount: grossRounded,
          iva_amount: ivaRounded,
          net_amount: netRounded,
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
