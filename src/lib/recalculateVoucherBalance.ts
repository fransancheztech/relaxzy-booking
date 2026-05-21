import { Prisma } from "generated/prisma";

export async function recalculateVoucherBalance(
  tx: Prisma.TransactionClient,
  voucherId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<[{ balance: string }]>`
    SELECT (
      COALESCE((
        SELECT SUM(CASE WHEN pe.type = 'CHARGE' THEN pe.amount ELSE -pe.amount END)
        FROM payment_events pe
        JOIN payments p ON pe.payment_id = p.id
        WHERE p.voucher_id = ${voucherId}::uuid
          AND p.deleted_at IS NULL
          AND pe.deleted_at IS NULL
      ), 0)
      - COALESCE((
        SELECT SUM(vu.amount)
        FROM voucher_uses vu
        WHERE vu.voucher_id = ${voucherId}::uuid AND vu.deleted_at IS NULL
      ), 0)
    ) AS balance
  `;

  await tx.vouchers.update({
    where: { id: voucherId },
    data: { balance: Number(rows[0].balance) },
  });
}
