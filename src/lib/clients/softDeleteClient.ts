import { Prisma } from "generated/prisma";
import { hasUsage, loadClientUsage, type ClientUsage } from "@/lib/clients/clientUsage";

export const DELETE_REASON_PREFIX = "Reason of delete: ";

export type SoftDeleteFailure =
  | { error: "CLIENT_NOT_FOUND"; status: 404 }
  | { error: "CLIENT_HAS_HISTORY"; status: 409; usage: ClientUsage };

/**
 * Soft-deletes a client inside the caller's transaction. Two rules (agreed 2026-10-25):
 *   - the reason is appended to the client's notes ("Reason of delete: …", the same wording as
 *     removing a voucher use), so it stays on the record and in clients_history;
 *   - a client with bookings, vouchers or voucher uses can't be deleted: they would keep pointing
 *     at a hidden client. A duplicate is merged into the right client instead.
 * Returns null on success. The caller sets app.user_id first, so the history row has an author.
 */
export async function softDeleteClient(
  tx: Prisma.TransactionClient,
  id: string,
  reason: string,
): Promise<SoftDeleteFailure | null> {
  const client = await tx.clients.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, client_notes: true },
  });
  if (!client) return { error: "CLIENT_NOT_FOUND", status: 404 };

  const usage = await loadClientUsage(tx, id);
  if (hasUsage(usage)) return { error: "CLIENT_HAS_HISTORY", status: 409, usage };

  const reasonNote = `${DELETE_REASON_PREFIX}${reason}`;
  await tx.clients.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      client_notes: client.client_notes?.trim() ? `${client.client_notes.trim()} ${reasonNote}` : reasonNote,
    },
  });
  return null;
}
