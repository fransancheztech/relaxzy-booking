import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IVA_RATE = 0.21;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const therapist_id = searchParams.get("therapist_id");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  try {
    const tips = await prisma.tips.findMany({
      where: {
        deleted_at: null,
        ...(status === "pending" ? { payout_id: null } : {}),
        ...(status === "released" ? { payout_id: { not: null } } : {}),
        ...(therapist_id ? { therapist_id } : {}),
        ...(start_date || end_date
          ? {
              received_at: {
                ...(start_date ? { gte: new Date(start_date) } : {}),
                ...(end_date ? { lte: new Date(end_date) } : {}),
              },
            }
          : {}),
      },
      include: { therapists: { select: { id: true, full_name: true } } },
      orderBy: { received_at: "desc" },
      take: 500,
    });

    return NextResponse.json({
      tips: tips.map((tip) => {
        const gross = Number(tip.amount);
        const iva = tip.iva_applies ? Math.round(gross * IVA_RATE * 100) / 100 : 0;
        return {
          id: tip.id,
          therapist_id: tip.therapist_id,
          therapist_name: tip.therapists.full_name,
          iva_applies: tip.iva_applies,
          payment_method: tip.payment_method,
          notes: tip.notes,
          received_at: tip.received_at,
          payout_id: tip.payout_id,
          gross,
          iva,
          net: Math.round((gross - iva) * 100) / 100,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/tips/list error", err);
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
  }
}
