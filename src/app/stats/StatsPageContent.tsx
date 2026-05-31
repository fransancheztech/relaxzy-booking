"use client";

import { Alert, Box, CircularProgress, Divider, Grid } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import LoopIcon from "@mui/icons-material/Loop";
import TimerIcon from "@mui/icons-material/Timer";
import EuroIcon from "@mui/icons-material/Euro";
import { useCallback, useEffect, useMemo, useState } from "react";
import { startOfDay, addDays } from "date-fns";
import { useTranslations } from "next-intl";
import { useLayout } from "@/app/context/LayoutContext";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";
import DateRangeFilter, { Preset, resolvePreset } from "./components/DateRangeFilter";
import KpiCard from "./components/KpiCard";
import RevenueSection from "./components/RevenueSection";
import BookingsSection from "./components/BookingsSection";
import ClientSection from "./components/ClientSection";
import VoucherSection from "./components/VoucherSection";
import TipsSection from "./components/TipsSection";
import TherapistHoursSection from "./components/TherapistHoursSection";

interface Props {
  role: string;
}

const StatsPageContent = ({ role }: Props) => {
  const t = useTranslations("Stats");
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const isAdmin = role === "admin";

  const [preset, setPreset] = useState<Preset>("month");
  // pickFrom/pickTo are the inclusive, date-only values shown in the pickers.
  const [pickFrom, setPickFrom] = useState<Date>(() => resolvePreset("month").from);
  const [pickTo, setPickTo] = useState<Date>(() => resolvePreset("month").to);

  // Effective half-open query window; `to` is the start of the day after pickTo so the
  // selected end day is fully included. Single source of truth for both data sources.
  const from = useMemo(() => startOfDay(pickFrom), [pickFrom]);
  const to = useMemo(() => addDays(startOfDay(pickTo), 1), [pickTo]);


  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);

  const fetchStats = useCallback(async (f: Date, t: Date, bucket?: "day" | "week" | "month") => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/stats?from=${f.toISOString()}&to=${t.toISOString()}${bucket ? `&bucket=${bucket}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Unknown error");
      }
      setData(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Only admins hit /api/stats (it 403s for other roles). Therapists get just the
  // Therapist Hours section, which fetches separately.
  useEffect(() => {
    if (!isAdmin) return;
    fetchStats(from, to);
  }, [from, to, fetchStats, isAdmin]);

  const handlePresetChange = (newPreset: Preset) => {
    const { from: f, to: t2 } = resolvePreset(newPreset);
    setPreset(newPreset);
    setPickFrom(f);
    setPickTo(t2);
  };

  // Editing a date is a manual range — no preset stays highlighted.
  const handleFromChange = (d: Date) => { setPreset("custom"); setPickFrom(d); };
  const handleToChange = (d: Date) => { setPreset("custom"); setPickTo(d); };

  const handleBucketChange = (newBucket: "day" | "week" | "month") => {
    fetchStats(from, to, newBucket);
  };

  return (
    <Box sx={{ px: 3, py: 3, position: "relative" }}>
      {/* Date range filter — visible to all roles; drives every section below */}
      <Box sx={{ mb: 3 }}>
        <DateRangeFilter
          preset={preset}
          from={pickFrom}
          to={pickTo}
          onPresetChange={handlePresetChange}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
        />
      </Box>

      {/* Loading overlay — admin only */}
      {isAdmin && loading && (
        <Box
          sx={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: "rgba(255,255,255,0.6)", borderRadius: 2,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {isAdmin && error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {isAdmin && data && (
        <Box sx={{ opacity: loading ? 0.4 : 1, transition: "opacity 0.2s" }}>
          {/* KPI Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("totalRevenue")}
                value={formatMoney(data.revenue.total)}
                secondary={`${t("refunds")} −${formatMoney(data.revenue.refunds_total)}`}
                icon={<TrendingUpIcon fontSize="small" />}
                tooltip={t("tooltipRevenue")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("bookings")}
                value={String(data.bookings.total)}
                secondary={`${t("completed")} ${data.bookings.completed} · ${t("cancelled")} ${data.bookings.cancelled}`}
                icon={<CalendarMonthIcon fontSize="small" />}
                tooltip={t("tooltipBookings")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("avgPrice")}
                value={formatMoney(data.financial.avg_ticket)}
                secondary={`P25: ${formatMoney(data.financial.p25_ticket)} · P75: ${formatMoney(data.financial.p75_ticket)}`}
                icon={<EuroIcon fontSize="small" />}
                tooltip={t("tooltipAvgPrice")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("revenuePerHour")}
                value={formatMoney(data.financial.revenue_per_hour)}
                secondary={`${data.bookings.total_booked_hours.toFixed(1)} ${t("hoursBooked")}`}
                icon={<TimerIcon fontSize="small" />}
                tooltip={t("tooltipRevenuePerHour")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("uniqueClients")}
                value={String(data.clients.total_unique)}
                secondary={`${t("new")} ${data.clients.new_in_period} · ${t("returning")} ${data.clients.returning_in_period}`}
                icon={<PeopleIcon fontSize="small" />}
                tooltip={t("tooltipUniqueClients")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label={t("retentionRate")}
                value={`${data.clients.retention_rate.toFixed(0)}%`}
                secondary={data.clients.repeat_frequency_days > 0
                  ? t("returnEvery", { days: Math.round(data.clients.repeat_frequency_days) })
                  : undefined}
                icon={<LoopIcon fontSize="small" />}
                tooltip={t("tooltipRetention")}
              />
            </Grid>
          </Grid>

          <Divider sx={{ mb: 4 }} />

          {/* Revenue section */}
          <Box sx={{ mb: 4 }}>
            <RevenueSection revenue={data.revenue} bucket={data.meta.date_bucket} onBucketChange={handleBucketChange} />
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Bookings section */}
          <Box sx={{ mb: 4 }}>
            <BookingsSection bookings={data.bookings} financial={data.financial} />
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Client section */}
          <Box sx={{ mb: 4 }}>
            <ClientSection clients={data.clients} bucket={data.meta.date_bucket} />
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Voucher section */}
          <Box sx={{ mb: 4 }}>
            <VoucherSection vouchers={data.vouchers} bucket={data.meta.date_bucket} />
          </Box>

          {/* Tips section (hidden when no tips in period) */}
          {data.tips.tip_count > 0 && (
            <>
              <Divider sx={{ mb: 4 }} />
              <Box sx={{ mb: 4 }}>
                <TipsSection tips={data.tips} />
              </Box>
            </>
          )}

          <Divider sx={{ mb: 4 }} />
        </Box>
      )}

      {/* Therapist hours — visible to all roles, driven by the shared date range */}
      <Box sx={{ opacity: 1 }}>
        <TherapistHoursSection isTherapist={role === "therapist"} from={from} to={to} />
      </Box>
    </Box>
  );
};

export default StatsPageContent;
