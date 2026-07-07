"use client";

import { Box, Chip, Grid, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useTranslations } from "next-intl";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";
import { formatBusinessBucketLabel } from "@/utils/businessTime";

export type Stream = "bookings" | "vouchers" | "tips";

type Bucket = StatsResponse["meta"]["date_bucket"];

interface RevenueTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: {
    dataKey?: string | number;
    name?: string;
    value?: number;
    color?: string;
    payload?: { total?: number; refunds?: number };
  }[];
}

interface Props {
  revenue: StatsResponse["revenue"];
  bucket: Bucket;
  onBucketChange: (bucket: Bucket) => void;
  // Lifted to the page so the headline "Total revenue" card and this chart share one selection.
  streams: Stream[];
  onStreamsChange: (streams: Stream[]) => void;
}

const PIE_COLORS = ["#002d04", "#60a561"];

const RevenueSection = ({ revenue, bucket, onBucketChange, streams, onStreamsChange }: Props) => {
  const t = useTranslations("Stats");
  const hasData = revenue.over_time.length > 0;
  const bucketLabel = bucket === "day" ? t("revenuePerDay") : bucket === "week" ? t("revenuePerWeek") : t("revenuePerMonth");

  // Which streams feed the headline total and the over-time bars (cash/card breakdown is kept).
  const showBookings = streams.includes("bookings");
  const showVouchers = streams.includes("vouchers");
  const showTips = streams.includes("tips");

  const empty = (
    <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
      {t("noDataForPeriod")}
    </Typography>
  );

  const barData = revenue.over_time.map((p) => {
    const label = formatBusinessBucketLabel(p.period, bucket);
    const cash = (showBookings ? p.bookings.cash : 0) + (showVouchers ? p.vouchers.cash : 0) + (showTips ? p.tips.cash : 0);
    const credit_card = (showBookings ? p.bookings.credit_card : 0) + (showVouchers ? p.vouchers.credit_card : 0) + (showTips ? p.tips.credit_card : 0);
    const refunds = (showBookings ? p.bookings.refunds : 0) + (showVouchers ? p.vouchers.refunds : 0);
    return { label, cash, credit_card, refunds, total: cash + credit_card - refunds };
  });

  const selectedRefundsTotal = barData.reduce((s, d) => s + d.refunds, 0);

  // Cash/card totals for the selected streams, so the payment-method breakdown follows the
  // Include chips (Bookings / Vouchers / Tips) just like the bars and the headline total.
  const selectedCash = barData.reduce((s, d) => s + d.cash, 0);
  const selectedCard = barData.reduce((s, d) => s + d.credit_card, 0);

  const pieData = [
    { name: t("cash"), value: selectedCash },
    { name: t("card"), value: selectedCard },
  ].filter((d) => d.value > 0);

  const therapistData = revenue.by_therapist.map((th) => ({
    label: th.therapist_name,
    revenue: th.revenue,
  }));

  const RevenueTooltip = ({ active, payload, label }: RevenueTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    // Net total (already refund-adjusted) and the period's refunds ride along on the data point.
    const point = payload[0]?.payload;
    const refunds = Number(point?.refunds ?? 0);
    const total = Number(point?.total ?? payload.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0));
    return (
      <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.25, py: 0.75, boxShadow: 2 }}>
        <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>{label}</Typography>
        {payload.map((entry) => (
          <Box key={String(entry.dataKey)} sx={{ display: "flex", justifyContent: "space-between", gap: 2.5 }}>
            <Typography variant="caption" sx={{ color: entry.color }}>{entry.name}:</Typography>
            <Typography variant="caption">{formatMoney(Number(entry.value ?? 0))}</Typography>
          </Box>
        ))}
        {refunds > 0 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2.5 }}>
            <Typography variant="caption" sx={{ color: "error.main" }}>{t("refunds")}</Typography>
            <Typography variant="caption" sx={{ color: "error.main" }}>−{formatMoney(refunds)}</Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2.5, mt: 0.5, pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" fontWeight={700}>{t("total")}:</Typography>
          <Typography variant="caption" fontWeight={700}>{formatMoney(total)}</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>{t("revenueSectionTitle")}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">{t("includeLabel")}</Typography>
          <ToggleButtonGroup
            value={streams}
            size="small"
            onChange={(_, v: Stream[]) => onStreamsChange(v)}
            sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
          >
            <ToggleButton value="bookings">{t("bookings")}</ToggleButton>
            <ToggleButton value="vouchers">{t("voucherSectionTitle")}</ToggleButton>
            <ToggleButton value="tips">{t("tipsSectionTitle")}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {/* Refunds for the selected streams — always visible (muted when zero). */}
        <Chip
          label={t("refundsChip", { amount: formatMoney(selectedRefundsTotal) })}
          size="small"
          color={selectedRefundsTotal > 0 ? "error" : "default"}
          variant="outlined"
          sx={{ fontSize: "0.7rem" }}
        />
      </Box>
      <Grid container spacing={2}>
        {/* Revenue over time */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {bucketLabel}
                </Typography>
                <ToggleButtonGroup
                  value={bucket}
                  exclusive
                  size="small"
                  onChange={(_, v) => { if (v) onBucketChange(v); }}
                  sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
                >
                  <ToggleButton value="day">{t("bucketDay")}</ToggleButton>
                  <ToggleButton value="week">{t("bucketWeek")}</ToggleButton>
                  <ToggleButton value="month">{t("bucketMonth")}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
            {hasData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="cash" name={t("cash")} stackId="a" fill="#002d04" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="credit_card" name={t("card")} stackId="a" fill="#60a561" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : empty}
          </Paper>
        </Grid>

        {/* Payment method breakdown */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t("byPaymentMethod")}
            </Typography>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            ) : empty}
            <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {[
                { label: t("cash"), value: selectedCash, color: "#002d04" },
                { label: t("card"), value: selectedCard, color: "#60a561" },
              ].map(({ label, value, color }) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                  <Typography variant="caption" fontWeight={600}>{formatMoney(value)}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Revenue per therapist */}
        <Grid size={12}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t("revenueByTherapist")}
            </Typography>
            {therapistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, therapistData.length * 44 + 40)}>
                <BarChart data={therapistData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                  <Bar dataKey="revenue" name={t("revenueBarName")} fill="#60a561" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : empty}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RevenueSection;
