import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IVA_RATE = 0.21;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tip_ids } = body;

    if (!Array.isArray(tip_ids) || tip_ids.length === 0) {
      return NextResponse.json({ error: "tip_ids must be a non-empty array" }, { status: 400 });
    }

    const tips = await prisma.tips.findMany({
      where: { id: { in: tip_ids }, deleted_at: null, payout_id: null },
    });

    if (tips.length === 0) {
      return NextResponse.json({ error: "No eligible tips found" }, { status: 409 });
    }

    // Group by therapist_id + received_at year+month
    type Group = {
      therapist_id: string;
      period_year: number;
      period_month: number;
      tips: typeof tips;
    };
    const groupMap = new Map<string, Group>();

    for (const tip of tips) {
      const year = tip.received_at.getFullYear();
      const month = tip.received_at.getMonth() + 1;
      const key = `${tip.therapist_id}|${year}|${month}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { therapist_id: tip.therapist_id, period_year: year, period_month: month, tips: [] });
      }
      groupMap.get(key)!.tips.push(tip);
    }

    let tipsReleased = 0;
    await prisma.$transaction(async (tx) => {
      for (const group of groupMap.values()) {
        let gross = 0;
        let ivaTotal = 0;
        for (const tip of group.tips) {
          const amount = Number(tip.amount);
          gross += amount;
          if (tip.iva_applies) ivaTotal += amount * IVA_RATE;
        }

        const payout = await tx.tip_payouts.create({
          data: {
            therapist_id: group.therapist_id,
            period_year: group.period_year,
            period_month: group.period_month,
            gross_amount: Math.round(gross * 100) / 100,
            iva_amount: Math.round(ivaTotal * 100) / 100,
            net_amount: Math.round((gross - ivaTotal) * 100) / 100,
            paid_at: new Date(),
          },
        });

        await tx.tips.updateMany({
          where: { id: { in: group.tips.map((t) => t.id) } },
          data: { payout_id: payout.id },
        });

        tipsReleased += group.tips.length;
      }
    });

    return NextResponse.json({ payouts_created: groupMap.size, tips_released: tipsReleased });
  } catch (err) {
    console.error("POST /api/tip-payouts/batch error", err);
    return NextResponse.json({ error: "Failed to release tips" }, { status: 500 });
  }
}
