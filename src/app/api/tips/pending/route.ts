import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IVA_RATE = 0.21;

export async function GET() {
  try {
    const tips = await prisma.tips.findMany({
      where: { deleted_at: null, payout_id: null },
      include: { therapists: { select: { id: true, full_name: true } } },
      orderBy: { created_at: "asc" },
    });

    // Group by therapist + year + month
    type Group = {
      therapist_id: string;
      therapist_name: string;
      period_year: number;
      period_month: number;
      tips: typeof tips;
      gross_amount: number;
      iva_amount: number;
      net_amount: number;
    };

    const map = new Map<string, Group>();

    for (const tip of tips) {
      const date = tip.created_at;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${tip.therapist_id}_${year}_${month}`;

      if (!map.has(key)) {
        map.set(key, {
          therapist_id: tip.therapist_id,
          therapist_name: tip.therapists.full_name,
          period_year: year,
          period_month: month,
          tips: [],
          gross_amount: 0,
          iva_amount: 0,
          net_amount: 0,
        });
      }

      const group = map.get(key)!;
      const amount = Number(tip.amount);
      const iva = tip.iva_applies ? amount * IVA_RATE : 0;
      group.tips.push(tip);
      group.gross_amount += amount;
      group.iva_amount += iva;
      group.net_amount += amount - iva;
    }

    const groups = Array.from(map.values()).map((g) => ({
      therapist_id: g.therapist_id,
      therapist_name: g.therapist_name,
      period_year: g.period_year,
      period_month: g.period_month,
      tip_count: g.tips.length,
      gross_amount: Math.round(g.gross_amount * 100) / 100,
      iva_amount: Math.round(g.iva_amount * 100) / 100,
      net_amount: Math.round(g.net_amount * 100) / 100,
      tip_ids: g.tips.map((t) => t.id),
    }));

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("GET /api/tips/pending error", err);
    return NextResponse.json({ error: "Failed to fetch pending tips" }, { status: 500 });
  }
}
