import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

// Hours data is visible to admins and therapists only. Admins see it from the beginning;
// therapists are capped to a rolling recent window so the page answers "how much have I
// worked lately?" without turning into a historical record of the whole team.

export const THERAPIST_LOOKBACK_MONTHS = 3;

/**
 * Earliest instant a therapist may query: the 1st of the month `THERAPIST_LOOKBACK_MONTHS`
 * before the current one, at business-day start (Madrid midnight). On 2026-10-12 that is
 * 2026-07-01T00:00 Madrid — so the window is always between 3 and 4 calendar months,
 * never a ragged mid-month boundary.
 */
export function therapistHoursFloor(now: Date = new Date()): Date {
  return DateTime.fromJSDate(now)
    .setZone(BUSINESS_TIMEZONE)
    .minus({ months: THERAPIST_LOOKBACK_MONTHS })
    .startOf("month")
    .toJSDate();
}

/** Whether this role's lookback is capped by therapistHoursFloor(). Admins are not. */
export function isHoursLookbackLimited(role: string): boolean {
  return role === "therapist";
}

/** Roles allowed on the Hours page and its endpoint. Receptionists are not among them. */
export function canViewHours(role: string): boolean {
  return role === "admin" || role === "therapist";
}
