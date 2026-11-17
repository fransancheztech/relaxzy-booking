import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { softDeleteClient } from "@/lib/clients/softDeleteClient";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

const MAX_NOTE = 500;

/**
 * Soft-deletes a client. A reason is required, and a client with bookings, vouchers or voucher
 * uses can't be deleted; see softDeleteClient for both rules.
 */
export async function POST(req: NextRequest) {
  try {
    const { id, notes } = await req.json().catch(() => ({}));

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const reason = typeof notes === "string" ? notes.trim() : "";
    if (!reason || reason.length > MAX_NOTE) {
      return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });
    }

    const performed_by = await getCurrentUserId();
    const result = await prisma.$transaction(async (tx) => {
      // Attribute the clients_history row the trigger writes for the deletion.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by}, true)`;
      return softDeleteClient(tx, id, reason);
    });

    if (result) {
      return NextResponse.json(
        { error: result.error, ...("usage" in result ? { usage: result.usage } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to soft-delete client:", error);
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
