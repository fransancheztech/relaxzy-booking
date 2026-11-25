import { DateTime } from "luxon";
import { roundToNearestMinutes } from "date-fns";
import { BUSINESS_TIMEZONE } from "@/constants";
import { nowBusiness } from "@/utils/businessTime";

// Default start time for a new booking, depending on where the form is opened from.
// Every day boundary and the 11:00 opening use the business clock (Madrid), never the
// device's own timezone.

const OPENING_HOUR = 11;

const nowRounded = (): Date => roundToNearestMinutes(new Date(), { nearestTo: 5 });

const atOpening = (day: DateTime): Date =>
  day.set({ hour: OPENING_HOUR, minute: 0, second: 0, millisecond: 0 }).toJSDate();

/** Bookings page: 11:00 today while it is still before 11:00, otherwise now rounded to 5 minutes. */
export function defaultStartFromBookingsPage(): Date {
  const now = nowBusiness();
  return now.hour < OPENING_HOUR ? atOpening(now) : nowRounded();
}

/**
 * Calendar "New booking" button, given the range on screen ([start, end) instants).
 * A range wholly in the future opens on its first day at 11:00; a range that contains
 * today, or lies in the past, opens at now rounded to 5 minutes.
 */
export function defaultStartFromCalendarRange(range: { start: Date; end: Date } | null): Date {
  if (!range) return nowRounded();
  const firstDay = DateTime.fromJSDate(range.start).setZone(BUSINESS_TIMEZONE).startOf("day");
  const today = nowBusiness().startOf("day");
  return firstDay > today ? atOpening(firstDay) : nowRounded();
}
