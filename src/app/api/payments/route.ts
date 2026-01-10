import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const booking_id = url.searchParams.get("booking_id");

    const payments = await prisma.payments.findMany({
      where: booking_id ? { booking_id } : {},
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("Fetch payments error:", err);
    return NextResponse.json({ error: "Error fetching payments" }, { status: 500 });
  }
}
