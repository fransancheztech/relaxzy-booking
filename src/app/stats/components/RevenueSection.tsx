"use client";

import { Box, Chip, Grid, Paper, Typography } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useTranslations } from "next-intl";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";

interface Props {
  revenue: StatsResponse["revenue"];
  bucket: StatsResponse["meta"]["date_bucket"];
}

const PIE_COLORS = ["#002d04", "#60a561", "#a8d5a9"];

const RevenueSection = ({ revenue, bucket }: Props) => {
  const t = useTranslations("Stats");
  const hasData = revenue.over_time.length > 0;
  const bucketLabel = bucket === "day" ? t("revenuePerDay") : bucket === "week" ? t("revenuePerWeek") : t("revenuePerMonth");

  const empty = (
    <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
      {t("noDataForPeriod")}
    </Typography>
  );

  const barData = revenue.over_time.map((p) => {
    const d = new Date(p.period);
    let label: string;
    if (bucket === "day") label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    else if (bucket === "week") label = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("es-ES", { month: "short" })}`;
    else label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    return { label, cash: p.cash, credit_card: p.credit_card, voucher: p.voucher };
  });

  const pieData = [
    { name: t("cash"), value: revenue.cash },
    { name: t("card"), value: revenue.credit_card },
    { name: t("voucher"), value: revenue.voucher },
  ].filter((d) => d.value > 0);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>{t("revenueSectionTitle")}</Typography>
      <Grid container spacing={2}>
        {/* Revenue over time */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {bucketLabel}
              </Typography>
              {revenue.refunds_total > 0 && (
                <Chip
                  label={t("refundsChip", { amount: formatMoney(revenue.refunds_total) })}
                  size="small" color="error" variant="outlined"
                  sx={{ fontSize: "0.7rem" }}
                />
              )}
            </Box>
            {hasData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="cash" name={t("cash")} stackId="a" fill="#002d04" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="credit_card" name={t("card")} stackId="a" fill="#60a561" />
                  <Bar dataKey="voucher" name={t("voucher")} stackId="a" fill="#a8d5a9" radius={[4, 4, 0, 0]} />
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
                { label: t("cash"), value: revenue.cash, color: "#002d04" },
                { label: t("card"), value: revenue.credit_card, color: "#60a561" },
                { label: t("voucher"), value: revenue.voucher, color: "#a8d5a9" },
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
      </Grid>
    </Box>
  );
};

export default RevenueSection;
