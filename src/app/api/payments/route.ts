import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

// Every payment in the system (no screen calls it today): admin-only, like the Payments page.
export async function GET(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
