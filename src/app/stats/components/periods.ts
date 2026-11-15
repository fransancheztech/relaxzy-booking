import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

/**
 * The Stats "top" tables rank days, or weeks, months and years added up from those days, in
 * business time (weeks run Monday to Sunday). Shared so every table groups and names them alike.
 */
export type PeriodUnit = "day" | "week" | "month" | "year";

export const PERIOD_UNITS: PeriodUnit[] = ["day", "week", "month", "year"];

/** Stats translation keys: the switch's button, and the table's first column. */
export const PERIOD_KEYS: Record<PeriodUnit, { toggle: string; column: string }> = {
  day: { toggle: "periodDays", column: "topDaysColDay" },
  week: { toggle: "periodWeeks", column: "topColWeek" },
  month: { toggle: "periodMonths", column: "topColMonth" },
  year: { toggle: "periodYears", column: "topColYear" },
};

/** The start of the week, month or year a day (an ISO instant from the API) falls in. */
export function periodStart(dayIso: string, unit: PeriodUnit): string {
  return unit === "day" ? dayIso : DateTime.fromISO(dayIso, { zone: BUSINESS_TIMEZONE }).startOf(unit).toISO()!;
}

/** "Lun 09/11 – Dom 15/11/2026", "noviembre 2026", "2026" or "vie 16/10/2026", in the app's language. */
export function periodLabel(startIso: string, unit: PeriodUnit, locale: string): string {
  const dt = DateTime.fromISO(startIso, { zone: BUSINESS_TIMEZONE }).setLocale(locale);
  if (unit === "week") {
    const end = dt.endOf("week");
    // A week across New Year names both years.
    return `${dt.toFormat(dt.year === end.year ? "ccc dd/MM" : "ccc dd/MM/yyyy")} – ${end.toFormat("ccc dd/MM/yyyy")}`;
  }
  if (unit === "month") return dt.toFormat("LLLL yyyy");
  if (unit === "year") return dt.toFormat("yyyy");
  return dt.toFormat("ccc dd/MM/yyyy");
}

/** Capitalises a label's first letter in the table ("noviembre" → "Noviembre"). */
export const periodCellSx = { whiteSpace: "nowrap", "&::first-letter": { textTransform: "uppercase" } } as const;
