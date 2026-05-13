import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    type PaymentRow = { payment_method: string; net: unknown };
    type TipRow = { therapist_id: string; full_name: string; payment_method: string; total: unknown };

    const [paymentRows, tipRows] = await Promise.all([
      prisma.$queryRaw<PaymentRow[]>`
        SELECT
          pe.method AS payment_method,
          SUM(CASE WHEN pe.type = 'CHARGE' THEN pe.amount ELSE -pe.amount END) AS net
        FROM payment_events pe
        JOIN payments p ON p.id = pe.payment_id
        JOIN bookings b ON b.id = p.booking_id
        WHERE
          pe.created_at >= ${startDate}
          AND pe.created_at < ${endDate}
          AND b.deleted_at IS NULL
          AND pe.deleted_at IS NULL
        GROUP BY pe.method
      `,
      prisma.$queryRaw<TipRow[]>`
        SELECT
          t.therapist_id,
          th.full_name,
          t.payment_method,
          SUM(t.amount) AS total
        FROM tips t
        JOIN therapists th ON th.id = t.therapist_id
        WHERE
          t.received_at >= ${startDate}
          AND t.received_at < ${endDate}
          AND t.deleted_at IS NULL
        GROUP BY t.therapist_id, th.full_name, t.payment_method
        ORDER BY th.full_name, t.payment_method
      `,
    ]);

    const toNum = (v: unknown) =>
      v != null ? Math.round(Number(v) * 100) / 100 : 0;

    // Payment totals
    const payments = { cash: 0, card: 0, voucher: 0, total: 0 };
    for (const row of paymentRows) {
      const net = toNum(row.net);
      if (row.payment_method === "cash") payments.cash += net;
      else if (row.payment_method === "credit_card") payments.card += net;
      else if (row.payment_method === "voucher") payments.voucher += net;
    }
    payments.total = Math.round((payments.cash + payments.card + payments.voucher) * 100) / 100;

    // Tips grouped by therapist
    type TherapistTips = { therapist_id: string; therapist_name: string; cash: number; card: number; voucher: number; total: number };
    const therapistMap = new Map<string, TherapistTips>();
    for (const row of tipRows) {
      let entry = therapistMap.get(row.therapist_id);
      if (!entry) {
        entry = { therapist_id: row.therapist_id, therapist_name: row.full_name, cash: 0, card: 0, voucher: 0, total: 0 };
        therapistMap.set(row.therapist_id, entry);
      }
      const amt = toNum(row.total);
      if (row.payment_method === "cash") entry.cash += amt;
      else if (row.payment_method === "credit_card") entry.card += amt;
      else if (row.payment_method === "voucher") entry.voucher += amt;
      entry.total = Math.round((entry.cash + entry.card + entry.voucher) * 100) / 100;
    }

    const byTherapist = Array.from(therapistMap.values()).map((e) => ({
      ...e,
      cash: Math.round(e.cash * 100) / 100,
      card: Math.round(e.card * 100) / 100,
      voucher: Math.round(e.voucher * 100) / 100,
    }));

    const tipsCash = byTherapist.reduce((s, e) => s + e.cash, 0);
    const tipsCard = byTherapist.reduce((s, e) => s + e.card, 0);
    const tipsVoucher = byTherapist.reduce((s, e) => s + e.voucher, 0);
    const tipsTotal = Math.round((tipsCash + tipsCard + tipsVoucher) * 100) / 100;

    return NextResponse.json({
      payments,
      tips: {
        cash: Math.round(tipsCash * 100) / 100,
        card: Math.round(tipsCard * 100) / 100,
        voucher: Math.round(tipsVoucher * 100) / 100,
        total: tipsTotal,
        by_therapist: byTherapist,
      },
      combined: {
        cash: Math.round((payments.cash + tipsCash) * 100) / 100,
        card: Math.round((payments.card + tipsCard) * 100) / 100,
      },
    });
  } catch (err) {
    console.error("GET /api/calendar/daily-totals error", err);
    return NextResponse.json({ error: "Failed to fetch daily totals" }, { status: 500 });
  }
}
