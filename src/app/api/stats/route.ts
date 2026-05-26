import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { StatsResponse, StatsRevenuePeriodPoint } from "@/types/stats";

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
    const revenueRows = await prisma.$queryRaw<{ cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
      WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND pe.created_at >= ${from} AND pe.created_at < ${to}
    `;
    const voucherRevenueRows = await prisma.$queryRaw<{ voucher: number }[]>`
      SELECT COALESCE(SUM(vu.amount), 0)::float AS voucher
      FROM voucher_uses vu
      JOIN bookings b ON b.id = vu.booking_id
      WHERE b.deleted_at IS NULL AND vu.deleted_at IS NULL
        AND vu.created_at >= ${from} AND vu.created_at < ${to}
    `;
    const revenueOverTimeRows = await prisma.$queryRaw<{ period: Date; cash: number; credit_card: number; refunds: number }[]>`
      SELECT
        date_trunc(${bSql}, pe.created_at) AS period,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'cash'), 0)::float AS cash,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'CHARGE' AND pe.method = 'credit_card'), 0)::float AS credit_card,
        COALESCE(SUM(pe.amount) FILTER (WHERE pe.type = 'REFUND'), 0)::float AS refunds
      FROM payment_events pe
      JOIN payments p ON p.id = pe.payment_id
      JOIN bookings b ON b.id = p.booking_id
      WHERE b.deleted_at IS NULL AND p.deleted_at IS NULL AND pe.deleted_at IS NULL
        AND pe.created_at >= ${from} AND pe.created_at < ${to}
      GROUP BY period ORDER BY period
    `;
    const voucherOverTimeRows = await prisma.$queryRaw<{ period: Date; voucher: number }[]>`
      SELECT
        date_trunc(${bSql}, vu.created_at) AS period,
        COALESCE(SUM(vu.amount), 0)::float AS voucher
      FROM voucher_uses vu
      JOIN bookings b ON b.id = vu.booking_id
      WHERE b.deleted_at IS NULL AND vu.deleted_at IS NULL
        AND vu.created_at >= ${from} AND vu.created_at < ${to}
      GROUP BY period ORDER BY period
    `;
    const bookingSummaryRows = await prisma.$queryRaw<{
      total: number; completed: number; cancelled: number;
      pending: number; confirmed: number;
      total_booked_hours: number; avg_session_minutes: number;
    }[]>`
      SELECT
        COUNT(*)::int AS total,
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
      tip_count: number; gross_amount: number; net_amount: number;
    }[]>`
      SELECT t.therapist_id, th.full_name AS therapist_name,
        COUNT(*)::int AS tip_count,
        SUM(t.amount)::float AS gross_amount,
        SUM(CASE WHEN t.iva_applies THEN t.amount * 0.79 ELSE t.amount END)::float AS net_amount
      FROM tips t
      JOIN therapists th ON th.id = t.therapist_id
      WHERE t.deleted_at IS NULL AND th.deleted_at IS NULL
        AND t.created_at >= ${from} AND t.created_at < ${to}
      GROUP BY t.therapist_id, th.full_name ORDER BY gross_amount DESC
    `;

    // --- Assemble revenue ---
    const rev = revenueRows[0] ?? { cash: 0, credit_card: 0, refunds: 0 };
    const voucherRev = toNum(voucherRevenueRows[0]?.voucher);
    const totalRevenue = toNum(rev.cash) + toNum(rev.credit_card) + voucherRev - toNum(rev.refunds);

    // Merge revenue over time
    const overtimeMap = new Map<string, StatsRevenuePeriodPoint>();
    for (const row of revenueOverTimeRows) {
      const key = new Date(row.period).toISOString();
      overtimeMap.set(key, {
        period: key,
        total: toNum(row.cash) + toNum(row.credit_card) - toNum(row.refunds),
        cash: toNum(row.cash),
        credit_card: toNum(row.credit_card),
        voucher: 0,
      });
    }
    for (const row of voucherOverTimeRows) {
      const key = new Date(row.period).toISOString();
      const existing = overtimeMap.get(key);
      if (existing) {
        existing.voucher = toNum(row.voucher);
        existing.total += toNum(row.voucher);
      } else {
        overtimeMap.set(key, {
          period: key,
          total: toNum(row.voucher),
          cash: 0,
          credit_card: 0,
          voucher: toNum(row.voucher),
        });
      }
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
    const tipCount = tipsRows.reduce((s, t) => s + toNum(t.tip_count), 0);
    const totalGross = tipsRows.reduce((s, t) => s + toNum(t.gross_amount), 0);
    const totalNet = tipsRows.reduce((s, t) => s + toNum(t.net_amount), 0);

    const response: StatsResponse = {
      meta: { from: from.toISOString(), to: to.toISOString(), date_bucket: bucket },

      revenue: {
        total: totalRevenue,
        cash: toNum(rev.cash),
        credit_card: toNum(rev.credit_card),
        voucher: voucherRev,
        refunds_total: toNum(rev.refunds),
        over_time: revenueOverTime,
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
        total_gross: totalGross,
        total_net: totalNet,
        tip_count: tipCount,
        by_therapist: tipsRows.map((t) => ({
          therapist_id: t.therapist_id,
          therapist_name: t.therapist_name,
          tip_count: toNum(t.tip_count),
          gross_amount: toNum(t.gross_amount),
          net_amount: toNum(t.net_amount),
        })),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/stats error", err);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
