import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { StatsResponse, StatsRevenuePeriodPoint, StatsTipsPeriodPoint } from "@/types/stats";
import { therapistDisplayName } from "@/utils/therapistName";

const toNum = (v: unknown): number => Number(v ?? 0);

type DateBucket = "day" | "week" | "month";

function getBucket(from: Date, to: Date): DateBucket {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 14) return "day";
  if (days <= 90) return "week";
  return "month";
}

// Safe bucket — whitelist only, never user-supplied
function bucketSql(bucket: DateBucket) {
  if (bucket === "day") return Prisma.sql`'day'`;
  if (bucket === "week") return Prisma.sql`'week'`;
  return Prisma.sql`'month'`;
}

export async function GET(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "Missing from or to" }, { status: 400 });
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const bucketParam = searchParams.get("bucket");
  const bucket: DateBucket =
    bucketParam === "day" || bucketParam === "week" || bucketParam === "month"
      ? bucketParam
      : getBucket(from, to);
  const bSql = bucketSql(bucket);

  try {
    // Sequential queries — one connection at a time to avoid exhausting the pool
    //
    // Revenue model: a sale is counted when it happens, not when redeemed.
    //  - Booking-linked payment events are attributed to the booking's service date
    //    (b.start_time), aligning revenue with the rest of this card.
    //  - Voucher-linked payment events (the voucher purchase / top-up) are attributed
    //    to the voucher's sale date (v.created_at). Voucher *redemptions* (voucher_uses)
    //    are NOT revenue — that money was already counted at the time of sale.
    // Both streams are classified purely by payment method (cash / credit_card); there
    // is no separate "voucher" method — a voucher top-up is itself cash or card.
    const revenueRows = await prisma.$queryRaw<{ cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
      WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND b.start_time >= ${from} AND b.start_time < ${to}
    `;
    const voucherRevenueRows = await prisma.$queryRaw<{ cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN vouchers v ON v.id = p.voucher_id
      WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND v.created_at >= ${from} AND v.created_at < ${to}
    `;
    const revenueOverTimeRows = await prisma.$queryRaw<{ period: Date; cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        date_trunc(${bSql}, b.start_time) AS period,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
      WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND b.start_time >= ${from} AND b.start_time < ${to}
      GROUP BY period ORDER BY period
    `;
    const voucherOverTimeRows = await prisma.$queryRaw<{ period: Date; cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        date_trunc(${bSql}, v.created_at) AS period,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN vouchers v ON v.id = p.voucher_id
      WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND v.created_at >= ${from} AND v.created_at < ${to}
      GROUP BY period ORDER BY period
    `;
    // Revenue per therapist — booking payments only (cash + card − refunds), attributed
    // to the booking's therapist by service date. Vouchers and unassigned bookings aren't
    // therapist-keyed, so they're excluded. Active, non-deleted therapists only (matching
    // the Tips-by-therapist and Therapist Hours scoping).
    const revenueByTherapistRows = await prisma.$queryRaw<{
      therapist_id: string; therapist_name: string; revenue: number;
    }[]>`
      SELECT th.id AS therapist_id,
        COALESCE(NULLIF(BTRIM(th.nickname), ''), NULLIF(BTRIM(th.name), ''), NULLIF(BTRIM(th.surname), ''), '—') AS therapist_name,
        (COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0)
          - COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0))::float AS revenue
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
      JOIN therapists th ON th.id = b.therapist_id
      WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND th.deleted_at IS NULL AND th.active = true
        AND b.start_time >= ${from} AND b.start_time < ${to}
      GROUP BY th.id
      ORDER BY revenue DESC
    `;
    const bookingSummaryRows = await prisma.$queryRaw<{
      total: number; completed: number; cancelled: number;
      pending: number; confirmed: number;
      total_booked_hours: number; avg_session_minutes: number;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
        COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))/3600)
          FILTER (WHERE status = 'completed' AND end_time IS NOT NULL), 0)::float AS total_booked_hours,
        COALESCE(AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60)
          FILTER (WHERE status = 'completed' AND end_time IS NOT NULL), 0)::float AS avg_session_minutes
      FROM bookings
      WHERE deleted_at IS NULL AND start_time >= ${from} AND start_time < ${to}
    `;
    const byServiceRows = await prisma.$queryRaw<{ service_name: string; count: number; revenue: number }[]>`
      SELECT sn.name AS service_name, COUNT(b.id)::int AS count,
        COALESCE(SUM(b.price), 0)::float AS revenue
      FROM bookings b
      LEFT JOIN services_names sn ON sn.id = b.service_id
      WHERE b.deleted_at IS NULL
        AND b.start_time >= ${from} AND b.start_time < ${to}
        AND sn.name IS NOT NULL
      GROUP BY sn.name ORDER BY count DESC
    `;
    const byDayOfWeekRows = await prisma.$queryRaw<{ day_of_week: number; count: number }[]>`
      SELECT EXTRACT(DOW FROM start_time)::int AS day_of_week, COUNT(*)::int AS count
      FROM bookings
      WHERE deleted_at IS NULL AND start_time >= ${from} AND start_time < ${to}
      GROUP BY day_of_week ORDER BY day_of_week
    `;
    const byTimeSlotRows = await prisma.$queryRaw<{ hour: number; count: number }[]>`
      SELECT EXTRACT(HOUR FROM start_time AT TIME ZONE 'Europe/Madrid')::int AS hour,
        COUNT(*)::int AS count
      FROM bookings
      WHERE deleted_at IS NULL AND start_time >= ${from} AND start_time < ${to}
      GROUP BY hour ORDER BY hour
    `;
    const byDurationRows = await prisma.$queryRaw<{ duration_minutes: number; count: number }[]>`
      SELECT
        ROUND(EXTRACT(EPOCH FROM (end_time - start_time))/60)::int AS duration_minutes,
        COUNT(*)::int AS count
      FROM bookings
      WHERE deleted_at IS NULL AND start_time >= ${from} AND start_time < ${to}
        AND end_time IS NOT NULL
      GROUP BY duration_minutes ORDER BY duration_minutes
    `;
    const financialRows = await prisma.$queryRaw<{ avg_ticket: number; p25: number; p75: number }[]>`
      SELECT
        ROUND(AVG(price)::numeric, 2)::float AS avg_ticket,
        COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price), 0)::float AS p25,
        COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price), 0)::float AS p75
      FROM bookings
      WHERE deleted_at IS NULL AND status = 'completed' AND price IS NOT NULL
        AND start_time >= ${from} AND start_time < ${to}
    `;
    const allPricesRows = await prisma.$queryRaw<{ price: number }[]>`
      SELECT price::float FROM bookings
      WHERE deleted_at IS NULL AND status = 'completed' AND price IS NOT NULL
        AND start_time >= ${from} AND start_time < ${to}
    `;
    const totalUniqueRows = await prisma.$queryRaw<{ total_unique: number }[]>`
      SELECT COUNT(DISTINCT client_id)::int AS total_unique FROM bookings
      WHERE deleted_at IS NULL AND start_time >= ${from} AND start_time < ${to}
        AND client_id IS NOT NULL
    `;
    const totalAllTimeRows = await prisma.$queryRaw<{ total_all_time: number }[]>`
      SELECT COUNT(*)::int AS total_all_time FROM clients WHERE deleted_at IS NULL
    `;
    const isAllTime = from.getFullYear() < 1990;
    const newClientsRows = isAllTime
      ? await prisma.$queryRaw<{ new_in_period: number }[]>`
          SELECT COUNT(*)::int AS new_in_period FROM (
            SELECT client_id FROM bookings
            WHERE deleted_at IS NULL AND client_id IS NOT NULL
            GROUP BY client_id HAVING COUNT(*) = 1
          ) sub
        `
      : await prisma.$queryRaw<{ new_in_period: number }[]>`
          SELECT COUNT(*)::int AS new_in_period FROM (
            SELECT client_id, MIN(start_time) AS first_booking
            FROM bookings WHERE deleted_at IS NULL AND client_id IS NOT NULL GROUP BY client_id
          ) sub WHERE first_booking >= ${from} AND first_booking < ${to}
        `;
    const avgBookingsRows = await prisma.$queryRaw<{ avg_bookings_per_client: number }[]>`
      SELECT COALESCE(AVG(cnt), 0)::float AS avg_bookings_per_client FROM (
        SELECT client_id, COUNT(*)::int AS cnt
        FROM bookings WHERE deleted_at IS NULL AND status = 'completed'
          AND start_time >= ${from} AND start_time < ${to}
        GROUP BY client_id
      ) sub
    `;
    const repeatFreqRows = await prisma.$queryRaw<{ repeat_frequency_days: number }[]>`
      SELECT COALESCE(AVG(avg_gap), 0)::float AS repeat_frequency_days FROM (
        SELECT client_id, AVG(gap_days) AS avg_gap FROM (
          SELECT client_id,
            EXTRACT(EPOCH FROM (start_time - LAG(start_time) OVER (
              PARTITION BY client_id ORDER BY start_time
            )))/86400 AS gap_days
          FROM bookings
          WHERE deleted_at IS NULL AND status = 'completed' AND client_id IS NOT NULL
        ) inner_sub
        WHERE gap_days IS NOT NULL
        GROUP BY client_id
        HAVING COUNT(*) > 1
      ) sub
    `;
    const newOverTimeRows = await prisma.$queryRaw<{ period: Date; count: number }[]>`
      SELECT date_trunc(${bSql}, first_booking) AS period, COUNT(*)::int AS count
      FROM (
        SELECT client_id, MIN(start_time) AS first_booking
        FROM bookings WHERE deleted_at IS NULL AND client_id IS NOT NULL GROUP BY client_id
      ) sub
      WHERE first_booking >= ${from} AND first_booking < ${to}
      GROUP BY period ORDER BY period
    `;
    const tipsRows = await prisma.$queryRaw<{
      therapist_id: string; therapist_name: string;
      cash_count: number; cash_gross: number; cash_net: number;
      card_count: number; card_gross: number; card_net: number;
    }[]>`
      SELECT th.id AS therapist_id,
        COALESCE(NULLIF(BTRIM(th.nickname), ''), NULLIF(BTRIM(th.name), ''), NULLIF(BTRIM(th.surname), ''), '—') AS therapist_name,
        COUNT(*) FILTER (WHERE t.payment_method = 'cash')::int AS cash_count,
        COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'cash'), 0)::float AS cash_gross,
        COALESCE(SUM(CASE WHEN t.iva_applies THEN t.amount * 0.79 ELSE t.amount END) FILTER (WHERE t.payment_method = 'cash'), 0)::float AS cash_net,
        COUNT(*) FILTER (WHERE t.payment_method = 'credit_card')::int AS card_count,
        COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'credit_card'), 0)::float AS card_gross,
        COALESCE(SUM(CASE WHEN t.iva_applies THEN t.amount * 0.79 ELSE t.amount END) FILTER (WHERE t.payment_method = 'credit_card'), 0)::float AS card_net
      FROM tips t
      JOIN therapists th ON th.id = t.therapist_id
      JOIN bookings b ON b.id = t.booking_id
      -- A tip's date is its booking's appointment date (start_time). Includes
      -- inactive/deleted therapists and tips of cancelled/deleted bookings.
      WHERE t.deleted_at IS NULL
        AND b.start_time >= ${from} AND b.start_time < ${to}
      GROUP BY th.id
      ORDER BY SUM(t.amount) DESC
    `;
    // Tips over time, per therapist and payment method. Unlike the section above,
    // this intentionally includes inactive/deleted therapists (no therapist filter)
    // so their historical tips can be visualised in the over-time card.
    const tipsOverTimeRows = await prisma.$queryRaw<{
      period: Date; therapist_id: string; cash: number; credit_card: number;
    }[]>`
      SELECT date_trunc(${bSql}, b.start_time) AS period,
        t.therapist_id::text AS therapist_id,
        COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method = 'credit_card'), 0)::float AS credit_card
      FROM tips t
      JOIN bookings b ON b.id = t.booking_id
      WHERE t.deleted_at IS NULL
        AND b.start_time >= ${from} AND b.start_time < ${to}
      GROUP BY period, t.therapist_id
      ORDER BY period
    `;

    // --- Vouchers ---
    // Sales: vouchers created in period, valued by their net payment events
    // (CHARGE − REFUND). Redemptions: voucher_uses logged in period (money
    // already counted at sale time — shown for activity, not as revenue).
    const voucherBySourceRows = await prisma.$queryRaw<{ source: string; count: number; value: number }[]>`
      SELECT v.source,
        COUNT(DISTINCT v.id)::int AS count,
        (COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0)
          - COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0))::float AS value
      FROM vouchers v
      LEFT JOIN payments p ON p.voucher_id = v.id AND p.deleted_at IS NULL
      LEFT JOIN payment_events pe ON pe.payment_id = p.id AND pe.deleted_at IS NULL
      WHERE v.deleted_at IS NULL AND v.created_at >= ${from} AND v.created_at < ${to}
      GROUP BY v.source ORDER BY value DESC
    `;
    const voucherRedeemedRows = await prisma.$queryRaw<{ redeemed_count: number; redeemed_value: number }[]>`
      SELECT COUNT(*)::int AS redeemed_count,
        COALESCE(SUM(amount), 0)::float AS redeemed_value
      FROM voucher_uses
      WHERE deleted_at IS NULL AND created_at >= ${from} AND created_at < ${to}
    `;
    // Outstanding balance is a snapshot of all active vouchers, independent of the period.
    const voucherOutstandingRows = await prisma.$queryRaw<{
      outstanding_balance: number; active_count: number;
      expired_balance: number; expired_count: number;
    }[]>`
      SELECT
        COALESCE(SUM(balance) FILTER (WHERE balance > 0 AND expiration_date >= now()), 0)::float AS outstanding_balance,
        COUNT(*) FILTER (WHERE balance > 0 AND expiration_date >= now())::int AS active_count,
        COALESCE(SUM(balance) FILTER (WHERE balance > 0 AND expiration_date < now()), 0)::float AS expired_balance,
        COUNT(*) FILTER (WHERE balance > 0 AND expiration_date < now())::int AS expired_count
      FROM vouchers WHERE deleted_at IS NULL
    `;
    const voucherSoldOverTimeRows = await prisma.$queryRaw<{ period: Date; value: number }[]>`
      SELECT date_trunc(${bSql}, v.created_at) AS period,
        (COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE'), 0)
          - COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0))::float AS value
      FROM vouchers v
      LEFT JOIN payments p ON p.voucher_id = v.id AND p.deleted_at IS NULL
      LEFT JOIN payment_events pe ON pe.payment_id = p.id AND pe.deleted_at IS NULL
      WHERE v.deleted_at IS NULL AND v.created_at >= ${from} AND v.created_at < ${to}
      GROUP BY period ORDER BY period
    `;
    const voucherRedeemedOverTimeRows = await prisma.$queryRaw<{ period: Date; value: number }[]>`
      SELECT date_trunc(${bSql}, created_at) AS period,
        COALESCE(SUM(amount), 0)::float AS value
      FROM voucher_uses
      WHERE deleted_at IS NULL AND created_at >= ${from} AND created_at < ${to}
      GROUP BY period ORDER BY period
    `;

    // --- Assemble revenue ---
    // Booking stream (by service date) + voucher-sale stream (by sale date),
    // both classified by payment method. Totals are the sum of the two streams.
    const rev = revenueRows[0] ?? { cash: 0, credit_card: 0, refunds: 0 };
    const vrev = voucherRevenueRows[0] ?? { cash: 0, credit_card: 0, refunds: 0 };
    const cashTotal = toNum(rev.cash) + toNum(vrev.cash);
    const cardTotal = toNum(rev.credit_card) + toNum(vrev.credit_card);
    const refundsTotal = toNum(rev.refunds) + toNum(vrev.refunds);
    const totalRevenue = cashTotal + cardTotal - refundsTotal;

    // Revenue over time, kept split by stream (bookings / vouchers) so the card can
    // toggle each. Each stream keeps its cash/card/refunds so the bars and tooltip
    // still break down by payment method.
    const overtimeMap = new Map<string, StatsRevenuePeriodPoint>();
    const ensurePoint = (key: string) => {
      let p = overtimeMap.get(key);
      if (!p) {
        p = {
          period: key,
          bookings: { cash: 0, credit_card: 0, refunds: 0 },
          vouchers: { cash: 0, credit_card: 0, refunds: 0 },
        };
        overtimeMap.set(key, p);
      }
      return p;
    };
    for (const row of revenueOverTimeRows) {
      const b = ensurePoint(new Date(row.period).toISOString()).bookings;
      b.cash += toNum(row.cash);
      b.credit_card += toNum(row.credit_card);
      b.refunds += toNum(row.refunds);
    }
    for (const row of voucherOverTimeRows) {
      const v = ensurePoint(new Date(row.period).toISOString()).vouchers;
      v.cash += toNum(row.cash);
      v.credit_card += toNum(row.credit_card);
      v.refunds += toNum(row.refunds);
    }
    const revenueOverTime = Array.from(overtimeMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    // --- Bookings ---
    const bs = bookingSummaryRows[0] ?? {
      total: 0, completed: 0, cancelled: 0, pending: 0, confirmed: 0,
      total_booked_hours: 0, avg_session_minutes: 0,
    };
    const resolvedBookings = toNum(bs.completed) + toNum(bs.cancelled);
    const cancellationRate = resolvedBookings > 0
      ? (toNum(bs.cancelled) / resolvedBookings) * 100
      : 0;
    const rangedays = (to.getTime() - from.getTime()) / 86_400_000;
    const avgPerDay = rangedays > 0 ? toNum(bs.total) / rangedays : 0;

    const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const byDayOfWeek = byDayOfWeekRows.map((r) => ({
      day_of_week: toNum(r.day_of_week),
      day_label: DOW_LABELS[toNum(r.day_of_week)] ?? String(r.day_of_week),
      count: toNum(r.count),
    }));

    // --- Financial ---
    const fin = financialRows[0] ?? { avg_ticket: 0, p25: 0, p75: 0 };
    const totalBookedHours = toNum(bs.total_booked_hours);
    const revenuePerHour = totalBookedHours > 0 ? totalRevenue / totalBookedHours : 0;

    // Ticket distribution: bucket into €10 ranges
    const bucketLabels = ["<€30", "€30–39", "€40–49", "€50–59", "€60–69", "€70–79", "€80–89", "€90+"];
    const bucketCounts = new Array(bucketLabels.length).fill(0);
    for (const { price } of allPricesRows) {
      const p = toNum(price);
      if (p < 30) { bucketCounts[0]++; continue; }
      if (p >= 90) { bucketCounts[7]++; continue; }
      const idx = Math.floor((p - 30) / 10) + 1;
      if (idx >= 1 && idx < 7) bucketCounts[idx]++;
    }
    const ticketDistribution = bucketLabels.map((bucket, i) => ({
      bucket,
      count: bucketCounts[i],
    }));

    // --- Clients ---
    const totalUnique = toNum(totalUniqueRows[0]?.total_unique);
    const newInPeriod = toNum(newClientsRows[0]?.new_in_period);
    const returningInPeriod = Math.max(0, totalUnique - newInPeriod);
    const retentionRate = totalUnique > 0 ? (returningInPeriod / totalUnique) * 100 : 0;

    // --- Tips ---
    const tipsByMethod = {
      cash: {
        count: tipsRows.reduce((s, t) => s + toNum(t.cash_count), 0),
        gross: tipsRows.reduce((s, t) => s + toNum(t.cash_gross), 0),
        net: tipsRows.reduce((s, t) => s + toNum(t.cash_net), 0),
      },
      credit_card: {
        count: tipsRows.reduce((s, t) => s + toNum(t.card_count), 0),
        gross: tipsRows.reduce((s, t) => s + toNum(t.card_gross), 0),
        net: tipsRows.reduce((s, t) => s + toNum(t.card_net), 0),
      },
    };
    const tipCount = tipsByMethod.cash.count + tipsByMethod.credit_card.count;

    // Tips over time: pivot to period → { therapist_id → {cash, card} }, and resolve
    // names for ALL therapists with tips (active, inactive, or deleted).
    const tipsOtMap = new Map<string, StatsTipsPeriodPoint>();
    for (const row of tipsOverTimeRows) {
      const key = new Date(row.period).toISOString();
      let p = tipsOtMap.get(key);
      if (!p) { p = { period: key, by_therapist: {} }; tipsOtMap.set(key, p); }
      p.by_therapist[row.therapist_id] = { cash: toNum(row.cash), credit_card: toNum(row.credit_card) };
    }
    const tipsOverTime = Array.from(tipsOtMap.values()).sort((a, b) => a.period.localeCompare(b.period));

    const tipTherapistIds = [...new Set(tipsOverTimeRows.map((r) => r.therapist_id))];
    const tipTherapistRows = tipTherapistIds.length
      ? await prisma.therapists.findMany({
          where: { id: { in: tipTherapistIds } },
          select: { id: true, nickname: true, name: true, surname: true },
        })
      : [];
    const tipTherapistName = new Map(tipTherapistRows.map((th) => [th.id, therapistDisplayName(th)]));
    const tipsOverTimeTherapists = tipTherapistIds
      .map((id) => ({ therapist_id: id, therapist_name: tipTherapistName.get(id) ?? "—" }))
      .sort((a, b) => a.therapist_name.localeCompare(b.therapist_name));

    // --- Vouchers ---
    const voucherBySource = voucherBySourceRows.map((r) => ({
      source: r.source,
      count: toNum(r.count),
      value: toNum(r.value),
    }));
    const voucherSoldCount = voucherBySource.reduce((s, r) => s + r.count, 0);
    const voucherSoldValue = voucherBySource.reduce((s, r) => s + r.value, 0);
    const vred = voucherRedeemedRows[0] ?? { redeemed_count: 0, redeemed_value: 0 };
    const vout = voucherOutstandingRows[0] ?? {
      outstanding_balance: 0, active_count: 0, expired_balance: 0, expired_count: 0,
    };

    // Merge sold + redeemed over time into one keyed series
    const voucherOtMap = new Map<string, { period: string; sold: number; redeemed: number }>();
    for (const row of voucherSoldOverTimeRows) {
      const key = new Date(row.period).toISOString();
      voucherOtMap.set(key, { period: key, sold: toNum(row.value), redeemed: 0 });
    }
    for (const row of voucherRedeemedOverTimeRows) {
      const key = new Date(row.period).toISOString();
      const existing = voucherOtMap.get(key);
      if (existing) existing.redeemed = toNum(row.value);
      else voucherOtMap.set(key, { period: key, sold: 0, redeemed: toNum(row.value) });
    }
    const voucherOverTime = Array.from(voucherOtMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    const response: StatsResponse = {
      meta: { from: from.toISOString(), to: to.toISOString(), date_bucket: bucket },

      revenue: {
        total: totalRevenue,
        cash: cashTotal,
        credit_card: cardTotal,
        refunds_total: refundsTotal,
        over_time: revenueOverTime,
        by_therapist: revenueByTherapistRows.map((r) => ({
          therapist_id: r.therapist_id,
          therapist_name: r.therapist_name,
          revenue: toNum(r.revenue),
        })),
      },

      bookings: {
        total: toNum(bs.total),
        completed: toNum(bs.completed),
        cancelled: toNum(bs.cancelled),
        pending: toNum(bs.pending),
        confirmed: toNum(bs.confirmed),
        cancellation_rate: cancellationRate,
        avg_per_day: avgPerDay,
        total_booked_hours: totalBookedHours,
        avg_session_minutes: toNum(bs.avg_session_minutes),
        by_service: byServiceRows.map((r) => ({
          service_name: r.service_name,
          count: toNum(r.count),
          revenue: toNum(r.revenue),
        })),
        by_day_of_week: byDayOfWeek,
        by_time_slot: byTimeSlotRows.map((r) => ({ hour: toNum(r.hour), count: toNum(r.count) })),
        by_duration: byDurationRows.map((r) => ({
          duration_minutes: toNum(r.duration_minutes),
          count: toNum(r.count),
        })),
      },

      financial: {
        avg_ticket: toNum(fin.avg_ticket),
        revenue_per_hour: revenuePerHour,
        p25_ticket: toNum(fin.p25),
        p75_ticket: toNum(fin.p75),
        ticket_distribution: ticketDistribution,
      },

      clients: {
        total_unique: totalUnique,
        total_all_time: toNum(totalAllTimeRows[0]?.total_all_time),
        new_in_period: newInPeriod,
        returning_in_period: returningInPeriod,
        retention_rate: retentionRate,
        avg_bookings_per_client: toNum(avgBookingsRows[0]?.avg_bookings_per_client),
        repeat_frequency_days: toNum(repeatFreqRows[0]?.repeat_frequency_days),
        new_over_time: newOverTimeRows.map((r) => ({
          period: new Date(r.period).toISOString(),
          count: toNum(r.count),
        })),
      },

      tips: {
        tip_count: tipCount,
        by_method: tipsByMethod,
        by_therapist: tipsRows.map((t) => ({
          therapist_id: t.therapist_id,
          therapist_name: t.therapist_name,
          cash: { count: toNum(t.cash_count), gross: toNum(t.cash_gross), net: toNum(t.cash_net) },
          credit_card: { count: toNum(t.card_count), gross: toNum(t.card_gross), net: toNum(t.card_net) },
        })),
        over_time: tipsOverTime,
        over_time_therapists: tipsOverTimeTherapists,
      },

      vouchers: {
        sold_count: voucherSoldCount,
        sold_value: voucherSoldValue,
        redeemed_count: toNum(vred.redeemed_count),
        redeemed_value: toNum(vred.redeemed_value),
        outstanding_balance: toNum(vout.outstanding_balance),
        active_count: toNum(vout.active_count),
        expired_count: toNum(vout.expired_count),
        expired_balance: toNum(vout.expired_balance),
        by_source: voucherBySource,
        over_time: voucherOverTime,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/stats error", err);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
