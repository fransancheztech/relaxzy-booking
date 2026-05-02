"use client";

import { Alert, Box, CircularProgress, Divider, Grid } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import LoopIcon from "@mui/icons-material/Loop";
import TimerIcon from "@mui/icons-material/Timer";
import EuroIcon from "@mui/icons-material/Euro";
import { useCallback, useEffect, useState } from "react";
import { useLayout } from "@/app/context/LayoutContext";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";
import DateRangeFilter, { Preset, resolvePreset } from "./components/DateRangeFilter";
import KpiCard from "./components/KpiCard";
import RevenueSection from "./components/RevenueSection";
import BookingsSection from "./components/BookingsSection";
import ClientSection from "./components/ClientSection";
import TipsSection from "./components/TipsSection";

const StatsPageContent = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [from, setFrom] = useState<Date>(() => resolvePreset("month").from);
  const [to, setTo] = useState<Date>(() => resolvePreset("month").to);

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

  const fetchStats = useCallback(async (f: Date, t: Date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?from=${f.toISOString()}&to=${t.toISOString()}`);
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

  useEffect(() => {
    fetchStats(from, to);
  }, [from, to, fetchStats]);

  const handleRangeChange = (newPreset: Preset, newFrom: Date, newTo: Date) => {
    setPreset(newPreset);
    if (newPreset === "custom") {
      setCustomFrom(newFrom);
      setCustomTo(newTo);
    }
    setFrom(newFrom);
    setTo(newTo);
  };

  return (
    <Box sx={{ px: 3, py: 3, position: "relative" }}>
      {/* Date range filter */}
      <Box sx={{ mb: 3 }}>
        <DateRangeFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onChange={handleRangeChange}
        />
      </Box>

      {/* Loading overlay */}
      {loading && (
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {data && (
        <Box sx={{ opacity: loading ? 0.4 : 1, transition: "opacity 0.2s" }}>
          {/* KPI Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Total revenue"
                value={formatMoney(data.revenue.total)}
                secondary={`Refunds: −${formatMoney(data.revenue.refunds_total)}`}
                icon={<TrendingUpIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Bookings"
                value={String(data.bookings.total)}
                secondary={`Completed: ${data.bookings.completed} · Cancelled: ${data.bookings.cancelled}`}
                icon={<CalendarMonthIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Avg. price"
                value={formatMoney(data.financial.avg_ticket)}
                secondary={`P25: ${formatMoney(data.financial.p25_ticket)} · P75: ${formatMoney(data.financial.p75_ticket)}`}
                icon={<EuroIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Revenue / hour"
                value={formatMoney(data.financial.revenue_per_hour)}
                secondary={`${data.bookings.total_booked_hours.toFixed(1)} h booked`}
                icon={<TimerIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Unique clients"
                value={String(data.clients.total_unique)}
                secondary={`New: ${data.clients.new_in_period} · Returning: ${data.clients.returning_in_period}`}
                icon={<PeopleIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Retention rate"
                value={`${data.clients.retention_rate.toFixed(0)}%`}
                secondary={data.clients.repeat_frequency_days > 0
                  ? `Return every ${Math.round(data.clients.repeat_frequency_days)} days`
                  : undefined}
                icon={<LoopIcon fontSize="small" />}
              />
            </Grid>
          </Grid>

          <Divider sx={{ mb: 4 }} />

          {/* Revenue section */}
          <Box sx={{ mb: 4 }}>
            <RevenueSection revenue={data.revenue} bucket={data.meta.date_bucket} />
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

          {/* Tips section (hidden when no tips in period) */}
          {data.tips.tip_count > 0 && (
            <>
              <Divider sx={{ mb: 4 }} />
              <Box sx={{ mb: 4 }}>
                <TipsSection tips={data.tips} />
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default StatsPageContent;
