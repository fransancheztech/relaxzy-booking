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
