import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TIMEZONE } from "@/constants";
import { therapistDisplayName } from "@/utils/therapistName";
import type { StatsTherapistRow, StatsTherapists } from "@/types/stats";

// The booking rules guideline (BOOKINGS RULES › SCHEDULING CONSTRAINTS), in minutes.
const DAY_LIMIT = 7 * 60; // maximum booked hours a day…
const DAY_EXTENDED_LIMIT = 7.5 * 60; // …or up to 7 h 30…
const EXTENDED_DAYS_ALLOWED = 2; // …on at most 2 days in any 7.
const CHAIN_LIMIT = 3 * 60; // maximum booked hours in a row,
const BREAK_MIN = 15; // then a 15-minute break.
const LATEST_START = 19 * 60 + 30; // the last massage starts at 19:30 at the latest.
const SIX_HOURS = 6 * 60; // 7 days in a row with every therapist over 6 h: tell Chalida or Fran.
const BIG_GAP = 2 * 60; // a day whose busiest and least busy therapist are 2 h or more apart.
const COLOR_SLOTS = 8; // the chart palette's categorical slots

type DateBucket = "day" | "week" | "month";

type BookingRow = {
  therapist_id: string | null;
  start_time: Date;
  end_time: Date;
  therapist_requested: boolean;
  client_id: string | null;
  service_name: string | null;
};

type Interval = { start: number; end: number };

/** Booked minutes of a day, with overlapping bookings counted once. */
function unionMinutes(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let cur: Interval | null = null;
  for (const iv of sorted) {
    if (cur && iv.start <= cur.end) cur.end = Math.max(cur.end, iv.end);
    else {
      if (cur) total += cur.end - cur.start;
      cur = { ...iv };
    }
  }
  return cur ? total + cur.end - cur.start : total;
}

/** Runs of massages longer than 3 h with no gap of at least 15 minutes between them. */
function longChains(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const chains: Interval[] = [];
  let chain: Interval | null = null;
  const close = () => { if (chain && chain.end - chain.start > CHAIN_LIMIT) chains.push(chain); };
  for (const iv of sorted) {
    if (chain && iv.start - chain.end < BREAK_MIN) chain.end = Math.max(chain.end, iv.end);
    else {
      close();
      chain = { ...iv };
    }
  }
  close();
  return chains;
}

/** Minutes after midnight as HH:mm. */
const clock = (min: number) => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Workload, client requests, revenue and booking-rule checks per therapist for the Stats page.
 * Counts every booking that isn't cancelled (upcoming ones too: the rules are about booked
 * time), dated by its appointment in business time. Bookings without a therapist are only
 * counted, as they can't be attributed.
 */
export async function computeTherapistStats(from: Date, to: Date, bucket: DateBucket): Promise<StatsTherapists> {
  // The 7-day allowance looks back 6 days before each day, so read 6 more days before `from`.
  const lookback = DateTime.fromJSDate(from, { zone: BUSINESS_TIMEZONE }).minus({ days: 6 }).toJSDate();
  const fromDay = DateTime.fromJSDate(from, { zone: BUSINESS_TIMEZONE }).toISODate()!;

  // Sequential queries, one connection at a time, like the rest of the Stats route.
  const bookings = await prisma.$queryRaw<BookingRow[]>`
    SELECT b.therapist_id::text AS therapist_id, b.start_time, b.end_time, b.therapist_requested,
           b.client_id::text AS client_id, sn.name AS service_name
      FROM bookings b
      LEFT JOIN services_names sn ON sn.id = b.service_id
     WHERE b.deleted_at IS NULL AND b.status <> 'cancelled'
       AND b.start_time >= ${lookback} AND b.start_time < ${to}
       AND b.end_time > b.start_time
  `;
  const revenueRows = await prisma.$queryRaw<{ therapist_id: string; revenue: number }[]>`
    SELECT b.therapist_id::text AS therapist_id,
           (COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0)
             - COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0))::float AS revenue
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
     WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
       AND b.therapist_id IS NOT NULL
       AND b.start_time >= ${from} AND b.start_time < ${to}
     GROUP BY b.therapist_id
  `;
  // Every therapist, oldest first: the order fixes each one's chart color.
  const therapists = await prisma.therapists.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { id: true, nickname: true, name: true, surname: true, active: true, deleted_at: true },
  });

  // Per therapist, per business day: the day's bookings as minutes after midnight.
  type Day = { intervals: Interval[]; inPeriod: boolean };
  const days = new Map<string, Map<string, Day>>(); // therapist → day → bookings
  const rows = new Map<string, StatsTherapistRow>();
  let unassigned = 0;
  const serviceHours = new Map<string, number>();

  const rowFor = (id: string): StatsTherapistRow => {
    let row = rows.get(id);
    if (!row) {
      const th = therapists.find((t) => t.id === id);
      row = {
        therapist_id: id,
        therapist_name: th ? therapistDisplayName(th) : "—",
        active: !!th?.active && !th?.deleted_at,
        color_slot: 0,
        days_worked: 0,
        bookings: 0,
        booked_hours: 0,
        avg_hours_per_day: 0,
        requested: 0,
        distinct_clients: 0,
        revenue: 0,
        hours_by_service: {},
        rules: { days_over_limit: [], extended_over_allowance: [], long_chains: [], late_starts: [] },
      };
      rows.set(id, row);
    }
    return row;
  };

  const clients = new Map<string, Set<string>>();
  for (const b of bookings) {
    const start = DateTime.fromJSDate(b.start_time, { zone: BUSINESS_TIMEZONE });
    const end = DateTime.fromJSDate(b.end_time, { zone: BUSINESS_TIMEZONE });
    const inPeriod = b.start_time >= from;
    if (!b.therapist_id) {
      if (inPeriod) unassigned++;
      continue;
    }
    const dayKey = start.toISODate()!;
    const startMin = start.hour * 60 + start.minute + start.second / 60;
    const endMin = startMin + end.diff(start, "minutes").minutes;

    let byDay = days.get(b.therapist_id);
    if (!byDay) days.set(b.therapist_id, (byDay = new Map()));
    let day = byDay.get(dayKey);
    if (!day) byDay.set(dayKey, (day = { intervals: [], inPeriod }));
    day.intervals.push({ start: startMin, end: endMin });

    if (!inPeriod) continue;
    const row = rowFor(b.therapist_id);
    row.bookings++;
    if (b.therapist_requested) row.requested++;
    if (startMin > LATEST_START) {
      row.rules.late_starts.push({ day: dayKey, hours: (endMin - startMin) / 60, start: clock(startMin), end: clock(endMin) });
    }
    if (b.client_id) {
      let set = clients.get(b.therapist_id);
      if (!set) clients.set(b.therapist_id, (set = new Set()));
      set.add(b.client_id);
    }
    const service = b.service_name ?? "—";
    const hours = (endMin - startMin) / 60;
    row.hours_by_service[service] = (row.hours_by_service[service] ?? 0) + hours;
    serviceHours.set(service, (serviceHours.get(service) ?? 0) + hours);
  }

  // Day totals: per therapist for the rules, per date across the team for balance and staffing.
  const teamDays = new Map<string, number[]>(); // date → booked minutes of each therapist working
  const bucketMinutes = new Map<string, Map<string, { minutes: number; days: number }>>();
  for (const [therapistId, byDay] of days) {
    const sortedDays = [...byDay.keys()].sort();
    const extendedDays: string[] = [];
    for (const dayKey of sortedDays) {
      const day = byDay.get(dayKey)!;
      const minutes = unionMinutes(day.intervals);
      const isExtended = minutes > DAY_LIMIT && minutes <= DAY_EXTENDED_LIMIT;
      if (isExtended) extendedDays.push(dayKey);
      if (!day.inPeriod) continue;

      const row = rowFor(therapistId);
      row.days_worked++;
      row.booked_hours += minutes / 60;
      if (minutes > DAY_EXTENDED_LIMIT) row.rules.days_over_limit.push({ day: dayKey, hours: minutes / 60 });
      if (isExtended) {
        // This day and the 6 before it: more than 2 extended days is over the allowance.
        const weekStart = DateTime.fromISO(dayKey, { zone: BUSINESS_TIMEZONE }).minus({ days: 6 }).toISODate()!;
        const inWindow = extendedDays.filter((d) => d >= weekStart && d <= dayKey);
        if (inWindow.length > EXTENDED_DAYS_ALLOWED) {
          row.rules.extended_over_allowance.push({
            day: dayKey,
            hours: minutes / 60,
            other_days: inWindow.filter((d) => d !== dayKey),
          });
        }
      }
      for (const chain of longChains(day.intervals)) {
        row.rules.long_chains.push({
          day: dayKey,
          hours: (chain.end - chain.start) / 60,
          start: clock(chain.start),
          end: clock(chain.end),
        });
      }

      const team = teamDays.get(dayKey) ?? [];
      team.push(minutes);
      teamDays.set(dayKey, team);

      const period = DateTime.fromISO(dayKey, { zone: BUSINESS_TIMEZONE }).startOf(bucket).toUTC().toISO()!;
      let perTherapist = bucketMinutes.get(period);
      if (!perTherapist) bucketMinutes.set(period, (perTherapist = new Map()));
      const cell = perTherapist.get(therapistId) ?? { minutes: 0, days: 0 };
      cell.minutes += minutes;
      cell.days++;
      perTherapist.set(therapistId, cell);
    }
  }

  for (const r of revenueRows) if (rows.has(r.therapist_id)) rowFor(r.therapist_id).revenue = Number(r.revenue);
  // Hours stay unrounded: the page shows them as hours and minutes.
  for (const row of rows.values()) {
    row.distinct_clients = clients.get(row.therapist_id)?.size ?? 0;
    row.avg_hours_per_day = row.days_worked ? row.booked_hours / row.days_worked : 0;
  }

  // Balance and staffing, over the days in the period.
  let balanceDays = 0;
  let gapSum = 0;
  let bigGapDays = 0;
  let streak = 0;
  let best = 0;
  let bestEnd: string | null = null;
  let prevDay: string | null = null;
  for (const dayKey of [...teamDays.keys()].filter((d) => d >= fromDay).sort()) {
    const team = teamDays.get(dayKey)!;
    if (team.length >= 2) {
      const gap = Math.max(...team) - Math.min(...team);
      balanceDays++;
      gapSum += gap;
      if (gap >= BIG_GAP) bigGapDays++;
    }
    const consecutive =
      prevDay !== null && DateTime.fromISO(prevDay).plus({ days: 1 }).toISODate() === dayKey;
    if (team.every((m) => m > SIX_HOURS)) {
      streak = consecutive ? streak + 1 : 1;
      if (streak > best) {
        best = streak;
        bestEnd = dayKey;
      }
    } else streak = 0;
    prevDay = dayKey;
  }

  // Each therapist's own slot (her place among all therapists); if two in this period share
  // one, the newer takes the next free slot.
  const taken = new Set<number>();
  for (const [rank, th] of therapists.entries()) {
    const row = rows.get(th.id);
    if (!row) continue;
    let slot = rank % COLOR_SLOTS;
    for (let i = 0; i < COLOR_SLOTS && taken.has(slot); i++) slot = (slot + 1) % COLOR_SLOTS;
    row.color_slot = slot;
    taken.add(slot);
  }

  const list = [...rows.values()].sort((a, b) => b.booked_hours - a.booked_hours);
  const teamHours = list.reduce((s, r) => s + r.booked_hours, 0);
  const therapistDays = list.reduce((s, r) => s + r.days_worked, 0);

  return {
    therapists: list,
    over_time: [...bucketMinutes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, perTherapist]) => ({
        period,
        by_therapist: Object.fromEntries(
          [...perTherapist].map(([id, c]) => [id, c.minutes / 60 / c.days]),
        ),
      })),
    services: [...serviceHours.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    team: {
      booked_hours: teamHours,
      therapist_days: therapistDays,
      avg_hours_per_day: therapistDays ? teamHours / therapistDays : 0,
      requested: list.reduce((s, r) => s + r.requested, 0),
      assigned_bookings: list.reduce((s, r) => s + r.bookings, 0),
      unassigned_bookings: unassigned,
      balance_days: balanceDays,
      avg_balance_gap: balanceDays ? gapSum / balanceDays / 60 : 0,
      big_gap_days: bigGapDays,
      all_over_six_streak: best,
      all_over_six_streak_end: bestEnd,
    },
  };
}
