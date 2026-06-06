import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

const IVA_RATE = 0.21;

export async function POST(request: Request) {
  try {
    // Releasing tips (creating payouts) is an admin-only action.
    const role = await getCurrentUserRole();
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // One payout record per therapist in the selection
    const groupMap = new Map<string, typeof tips>();
    for (const tip of tips) {
      const bucket = groupMap.get(tip.therapist_id) ?? [];
      bucket.push(tip);
      groupMap.set(tip.therapist_id, bucket);
    }

    let tipsReleased = 0;
    await prisma.$transaction(async (tx) => {
      for (const [therapist_id, bucket] of groupMap) {
        let gross = 0;
        let ivaTotal = 0;
        for (const tip of bucket) {
          const amount = Number(tip.amount);
          gross += amount;
          if (tip.iva_applies) ivaTotal += amount * IVA_RATE;
        }

        const payout = await tx.tip_payouts.create({
          data: {
            therapist_id,
            gross_amount: Math.round(gross * 100) / 100,
            iva_amount: Math.round(ivaTotal * 100) / 100,
            net_amount: Math.round((gross - ivaTotal) * 100) / 100,
            paid_at: new Date(),
          },
        });

        await tx.tips.updateMany({
          where: { id: { in: bucket.map((t) => t.id) } },
          data: { payout_id: payout.id },
        });

        tipsReleased += bucket.length;
      }
    });

    return NextResponse.json({ payouts_created: groupMap.size, tips_released: tipsReleased });
  } catch (err) {
    console.error("POST /api/tip-payouts/batch error", err);
    return NextResponse.json({ error: "Failed to release tips" }, { status: 500 });
  }
}
