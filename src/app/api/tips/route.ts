import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tip_payment_method } from "generated/prisma";
import { ivaAppliesForTipMethod } from "@/utils/tipIva";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  try {
    const tips = await prisma.tips.findMany({
      where: { booking_id: bookingId, deleted_at: null },
      include: { therapists: { select: { id: true, nickname: true, name: true, surname: true } } },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json({ tips });
  } catch (err) {
    console.error("GET /api/tips error", err);
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // iva_applies is derived from payment_method; received_at is no longer used
    // (a tip's date is its booking's start_time), so it's left to the DB default.
    const { booking_id, therapist_id, amount, payment_method, notes } = body;

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }
    if (!therapist_id) {
      return NextResponse.json({ error: "Missing therapist_id" }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const validMethods: tip_payment_method[] = ["cash", "credit_card"];
    if (!validMethods.includes(payment_method)) {
      return NextResponse.json({ error: "Invalid payment_method" }, { status: 400 });
    }

    const tip = await prisma.tips.create({
      data: {
        booking_id,
        therapist_id,
        amount: parsedAmount,
        payment_method: payment_method as tip_payment_method,
        iva_applies: ivaAppliesForTipMethod(payment_method),
        notes: notes?.trim() || null,
      },
      include: { therapists: { select: { id: true, nickname: true, name: true, surname: true } } },
    });

    return NextResponse.json({ tip });
  } catch (err) {
    console.error("POST /api/tips error", err);
    return NextResponse.json({ error: "Failed to create tip" }, { status: 500 });
  }
}
