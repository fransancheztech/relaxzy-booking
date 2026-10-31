import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

/**
 * Business rule (from 01/11/2026): a voucher can't be used until 7 days after the day it was sold.
 * Sold at any time on Sunday 01/11 → usable from Sunday 08/11 at 00:00 (Madrid). The rule is NOT
 * enforced — the app warns the receptionist and asks for confirmation, but lets her go ahead.
 *
 * "Used" means the appointment the voucher pays for, not the day the payment is entered.
 * Free of server-only imports: the booking forms use it.
 */
export const VOUCHER_WAIT_DAYS = 7;

/** The first business day a voucher sold at `soldAt` may be used, as that day's start (Madrid). */
export function voucherFirstUsableDay(soldAt: Date | string | null | undefined): Date | null {
  if (!soldAt) return null;
  const sold = soldAt instanceof Date ? DateTime.fromJSDate(soldAt) : DateTime.fromISO(soldAt);
  if (!sold.isValid) return null;
  return sold.setZone(BUSINESS_TIMEZONE).startOf("day").plus({ days: VOUCHER_WAIT_DAYS }).toJSDate();
}

/** True when an appointment falls before the voucher's first usable day. */
export function isVoucherTooEarly(
  soldAt: Date | string | null | undefined,
  appointment: Date | string | null | undefined,
): boolean {
  const firstDay = voucherFirstUsableDay(soldAt);
  if (!firstDay || !appointment) return false;
  const when = appointment instanceof Date ? appointment : new Date(appointment);
  return !Number.isNaN(when.getTime()) && when < firstDay;
}

export type EarlyVoucherUse = { code: string; soldAt: string; usableFrom: Date; appointment: Date };

/**
 * Of the vouchers about to be applied, those used before their first permitted day. Looks each
 * code up with the same search the voucher picker uses (vouchers with balance, not expired).
 * Used right before saving, to ask for confirmation.
 */
export async function findEarlyVoucherUses(
  entries: { code: string | null | undefined; appointment: Date | null | undefined }[],
): Promise<EarlyVoucherUse[]> {
  const early: EarlyVoucherUse[] = [];
  for (const { code, appointment } of entries) {
    const c = code?.trim();
    if (!c || !appointment) continue;
    try {
      const res = await fetch(`/api/vouchers/search?q=${encodeURIComponent(c)}`);
      if (!res.ok) continue;
      const data = await res.json();
      const v = (data.vouchers ?? []).find((x: { code: string }) => x.code.toLowerCase() === c.toLowerCase());
      if (v?.created_at && isVoucherTooEarly(v.created_at, appointment)) {
        early.push({ code: v.code, soldAt: v.created_at, usableFrom: voucherFirstUsableDay(v.created_at)!, appointment });
      }
    } catch {
      // A failed lookup must not block saving; the server applies the voucher as usual.
    }
  }
  return early;
}
