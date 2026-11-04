import { isVoucherExpired } from "./expiry";
import { isVoucherTooEarly, voucherFirstUsableDay } from "./firstUsableDay";

export type VoucherUseWarning =
  | { kind: "early"; code: string; soldAt: string; usableFrom: Date; appointment: Date }
  | { kind: "expired"; code: string; expiredOn: string; appointment: Date };

/**
 * Of the vouchers about to be applied, those used before their first permitted day or after their
 * expiry. Neither is enforced: the app warns the receptionist and asks for confirmation. Looks each
 * code up with the same search the voucher picker uses. Used right before saving.
 */
export async function findVoucherUseWarnings(
  entries: { code: string | null | undefined; appointment: Date | null | undefined }[],
): Promise<VoucherUseWarning[]> {
  const warnings: VoucherUseWarning[] = [];
  for (const { code, appointment } of entries) {
    const c = code?.trim();
    if (!c || !appointment) continue;
    try {
      const res = await fetch(`/api/vouchers/search?q=${encodeURIComponent(c)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const v = (data.vouchers ?? []).find((x: { code: string }) => x.code.toLowerCase() === c.toLowerCase());
      if (v?.created_at && isVoucherTooEarly(v.created_at, appointment)) {
        warnings.push({ kind: "early", code: v.code, soldAt: v.created_at, usableFrom: voucherFirstUsableDay(v.created_at)!, appointment });
      }
      if (v?.expiration_date && isVoucherExpired(v.expiration_date, appointment)) {
        warnings.push({ kind: "expired", code: v.code, expiredOn: v.expiration_date, appointment });
      }
    } catch {
      // A failed lookup must not block saving; the server applies the voucher as usual.
    }
  }
  return warnings;
}
