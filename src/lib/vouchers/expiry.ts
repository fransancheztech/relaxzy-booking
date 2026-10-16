import { businessDayEndExclusiveUtc } from "@/utils/businessTime";

/**
 * Whether a voucher is past its expiry. THE EXPIRY DAY COUNTS IN FULL: a voucher stays
 * usable until the end of the business (Madrid) day printed on it.
 *
 * `vouchers.expiration_date` is a timestamptz whose TIME component is not significant. It
 * inherited the time of day of the sale (created_at + 180 days), so a voucher sold at
 * 13:21 stopped working at 13:21 on its final day while every screen still showed that
 * date as valid — a client was turned away on a date their voucher said was good.
 *
 * Always compare through this helper, never `expiration_date < now()` directly. The SQL
 * counterpart, for raw queries, is `voucherNotExpiredSql` in ./expirySql.
 *
 * Deliberately free of server-only imports: client components use it too.
 */
export function isVoucherExpired(
  expirationDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  // No expiry recorded — nothing to enforce.
  if (!expirationDate) return false;
  const cutoff = businessDayEndExclusiveUtc(expirationDate);
  return cutoff ? now >= cutoff : false;
}
