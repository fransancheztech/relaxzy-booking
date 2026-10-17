// Stable error codes for the booking-payment surface, shared by BookingPaymentSchema
// (client-side validation) and POST /api/bookings/[id]/payment (server-side).
//
// Both used to emit hardcoded English sentences that the UI rendered verbatim, so a
// Spanish- or Thai-speaking receptionist read English error text — which is how the
// 2026-10 duplicated-tip incident happened: she hit "Total payment exceeds booking
// price", could not read it, and worked around it by raising the booking price.
//
// Three codes are emitted by BOTH the schema and the route (NO_PAYMENT_ENTERED,
// EXCEEDS_PRICE, VOUCHER_CODE_REQUIRED), so one translation covers the client-side
// check and its server-side counterpart.

export const PAYMENT_ERROR_CODES = [
  // Emitted by the route only
  "INVALID_BOOKING_ID",
  "INVALID_PAYMENT_DATE",
  "BOOKING_NOT_FOUND",
  "BOOKING_CANCELLED",
  "VOUCHER_ON_ANONYMOUS_BOOKING",
  "VOUCHER_NOT_FOUND",
  "VOUCHER_EXPIRED",
  "VOUCHER_INSUFFICIENT_BALANCE",
  "PAYMENT_FAILED",
  // Emitted by both the schema and the route
  "NO_PAYMENT_ENTERED",
  "EXCEEDS_PRICE",
  "VOUCHER_CODE_REQUIRED",
  // Emitted by the schema only (field-level)
  "PAYMENT_NOT_A_NUMBER",
  "PAYMENT_NEGATIVE",
  "PAYMENT_MAX_2_DECIMALS",
  "VOUCHER_CODE_FORMAT",
] as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

const CODES: ReadonlySet<string> = new Set(PAYMENT_ERROR_CODES);

export const isPaymentErrorCode = (value: unknown): value is PaymentErrorCode =>
  typeof value === "string" && CODES.has(value);

/**
 * Translate a code with `t` from the `BookingPayment.errors` namespace.
 *
 * Anything unrecognised is returned unchanged rather than swallowed or replaced by a
 * generic message: a route that grows a new error still shows the receptionist
 * something, instead of silently rendering a blank helper text.
 */
export function paymentErrorText(
  value: string | undefined | null,
  t: (key: string) => string,
): string | undefined {
  if (!value) return undefined;
  return isPaymentErrorCode(value) ? t(value) : value;
}
