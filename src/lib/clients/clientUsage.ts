import { Prisma } from "generated/prisma";

/** What still points at a client: a client with any of it can't be deleted (merge it instead). */
export type ClientUsage = { bookings: number; vouchers: number; voucherUses: number };

export async function loadClientUsage(db: Prisma.TransactionClient, clientId: string): Promise<ClientUsage> {
  const [bookings, vouchers, voucherUses] = await Promise.all([
    db.bookings.count({ where: { client_id: clientId, deleted_at: null } }),
    // vouchers.buyer_id / recipient_id and voucher_uses.recipient_id carry no FK, so nothing in
    // the database stops a deleted client from being left behind on them — this check does.
    db.vouchers.count({
      where: { deleted_at: null, OR: [{ buyer_id: clientId }, { recipient_id: clientId }] },
    }),
    db.voucher_uses.count({ where: { recipient_id: clientId, deleted_at: null } }),
  ]);
  return { bookings, vouchers, voucherUses };
}

export const hasUsage = (u: ClientUsage) => u.bookings + u.vouchers + u.voucherUses > 0;
