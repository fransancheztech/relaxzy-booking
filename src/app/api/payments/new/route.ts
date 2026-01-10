import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  booking_id: string;
  amount: number;
  method: "cash" | "credit_card";
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    if (!body.booking_id) return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!["cash", "credit_card"].includes(body.method)) return NextResponse.json({ error: "Invalid method" }, { status: 400 });

    const payment = await prisma.payments.create({
      data: {
        booking_id: body.booking_id,
        amount: body.amount,
        method: body.method,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ payment });
  } catch (err) {
    console.error("Create payment error:", err);
    return NextResponse.json({ error: "Error creating payment" }, { status: 500 });
  }
}
