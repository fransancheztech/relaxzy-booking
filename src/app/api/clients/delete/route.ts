import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasUsage, loadClientUsage } from "@/lib/clients/clientUsage";

const MAX_NOTE = 500;

/**
 * Soft-deletes a client. Two rules (agreed 2026-10-25):
 *   - a reason is required; it's appended to the client's notes ("Reason of delete: …", the same
 *     wording as removing a voucher use), so it stays on the record and in clients_history;
 *   - a client with bookings, vouchers or voucher uses can't be deleted: they would keep pointing
 *     at a hidden client. A duplicate is merged into the right client instead.
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

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.clients.findFirst({
        where: { id, deleted_at: null },
        select: { id: true, client_notes: true },
      });
      if (!client) return { error: "CLIENT_NOT_FOUND", status: 404 } as const;

      const usage = await loadClientUsage(tx, id);
      if (hasUsage(usage)) return { error: "CLIENT_HAS_HISTORY", status: 409, usage } as const;

      const reasonNote = `Reason of delete: ${reason}`;
      await tx.clients.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          client_notes: client.client_notes?.trim() ? `${client.client_notes.trim()} ${reasonNote}` : reasonNote,
        },
      });
      return null;
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
