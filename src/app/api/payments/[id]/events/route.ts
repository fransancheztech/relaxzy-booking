import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/* ======================================================
   GET /api/payments/[id]/events
   ====================================================== */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 }
      );
    }

    // 🔥 AQUÍ VA EL CÓDIGO
    const events = await prisma.$queryRaw<
      Array<{
        id: string;
        type: string | null;
        method: string | null;
        amount: any;
        created_at: Date;
        performed_by: string | null;
        email: string | null;
      }>
    >`
      SELECT 
        pe.*,
        u.email
      FROM payment_events pe
      LEFT JOIN auth.users u ON u.id = pe.performed_by
      WHERE pe.payment_id = ${id}
        AND pe.deleted_at IS NULL
      ORDER BY pe.created_at DESC
    `;

    if (!events) {
      return NextResponse.json({ error: "Payment events not found" }, { status: 404 });
    }

    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /payments/[id]/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment events" },
      { status: 500 }
    );
  }
}
