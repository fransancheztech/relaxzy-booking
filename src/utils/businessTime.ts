import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

// Central timezone helpers. Every instant is displayed/derived in the BUSINESS_TIMEZONE
// (Europe/Madrid) so the operator's device timezone never affects business times.
// Storage stays UTC; these convert at the edges. Always uses the named IANA zone, so DST
// is handled correctly.

type DateInput = Date | string | number | null | undefined;

function toBusiness(value: DateInput): DateTime | null {
  if (value === null || value === undefined || value === "") return null;
  let dt: DateTime;
  if (value instanceof Date) dt = DateTime.fromJSDate(value);
  else if (typeof value === "number") dt = DateTime.fromMillis(value);
  else dt = DateTime.fromISO(value);
  return dt.isValid ? dt.setZone(BUSINESS_TIMEZONE) : null;
}

/** dd/MM/yyyy in business time. */
export function formatBusinessDate(value: DateInput, fallback = "—"): string {
  const dt = toBusiness(value);
  return dt ? dt.toFormat("dd/MM/yyyy") : fallback;
}

/** dd/MM/yyyy HH:mm in business time. */
export function formatBusinessDateTime(value: DateInput, fallback = "—"): string {
  const dt = toBusiness(value);
  return dt ? dt.toFormat("dd/MM/yyyy HH:mm") : fallback;
}

/** HH:mm (24h) in business time. */
export function formatBusinessTime(value: DateInput, fallback = "—"): string {
  const dt = toBusiness(value);
  return dt ? dt.toFormat("HH:mm") : fallback;
}

/** Now, expressed in business time. */
export function nowBusiness(): DateTime {
  return DateTime.now().setZone(BUSINESS_TIMEZONE);
}

/** UTC instant for the START of the business day that `value` falls on (inclusive range start). */
export function businessDayStartUtc(value: DateInput): Date | null {
  const dt = toBusiness(value);
  return dt ? dt.startOf("day").toUTC().toJSDate() : null;
}

/** UTC instant for the start of the NEXT business day (exclusive range end). */
export function businessDayEndExclusiveUtc(value: DateInput): Date | null {
  const dt = toBusiness(value);
  return dt ? dt.startOf("day").plus({ days: 1 }).toUTC().toJSDate() : null;
}

/** DDMMYY in business time (e.g. voucher codes like V-150626-1). */
export function businessDdMmYy(value: DateInput): string {
  const dt = toBusiness(value) ?? nowBusiness();
  return dt.toFormat("ddMMyy");
}

// Axis label for a stats time bucket. Numeric layout stays Spanish-style; month names
// follow the app language (pass the session locale).
export function formatBusinessBucketLabel(
  value: DateInput,
  bucket: "day" | "week" | "month",
  locale = "es",
): string {
  const dt = (toBusiness(value) ?? nowBusiness()).setLocale(locale);
  if (bucket === "day") return dt.toFormat("dd/MM");
  if (bucket === "week") return `W${Math.ceil(dt.day / 7)} ${dt.toFormat("LLL")}`;
  return dt.toFormat("LLL yy");
}
