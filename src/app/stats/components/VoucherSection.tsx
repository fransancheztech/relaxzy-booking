"use client";

import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useTranslations } from "next-intl";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";

type Bucket = StatsResponse["meta"]["date_bucket"];

interface Props {
  vouchers: StatsResponse["vouchers"];
  bucket: Bucket;
}

const SOURCE_COLORS: Record<string, string> = {
  online: "#60a561",
  physical: "#002d04",
};
const FALLBACK_COLORS = ["#002d04", "#60a561", "#9cc39d"];

const VoucherSection = ({ vouchers, bucket }: Props) => {
  const t = useTranslations("Stats");
  const hasOverTime = vouchers.over_time.length > 0;

  const empty = (
    <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
      {t("noDataForPeriod")}
    </Typography>
  );

  const sourceLabel = (source: string) =>
    source === "online" ? t("voucherSourceOnline")
      : source === "physical" ? t("voucherSourcePhysical")
        : source;

  const barData = vouchers.over_time.map((p) => {
    const d = new Date(p.period);
    let label: string;
    if (bucket === "day") label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    else if (bucket === "week") label = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("es-ES", { month: "short" })}`;
    else label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    return { label, sold: p.sold, redeemed: p.redeemed };
  });

  const pieData = vouchers.by_source
    .filter((s) => s.value > 0)
    .map((s) => ({ name: sourceLabel(s.source), value: s.value, source: s.source }));

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>{t("voucherSectionTitle")}</Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label={t("vouchersSoldChip", { count: vouchers.sold_count, amount: formatMoney(vouchers.sold_value) })}
          size="small" variant="outlined"
        />
        <Chip
          label={t("vouchersRedeemedChip", { count: vouchers.redeemed_count, amount: formatMoney(vouchers.redeemed_value) })}
          size="small" variant="outlined"
        />
        <Chip
          label={t("vouchersOutstandingChip", { count: vouchers.active_count, amount: formatMoney(vouchers.outstanding_balance) })}
          size="small" color="success" variant="outlined"
        />
        {vouchers.expired_balance > 0 && (
          <Chip
            label={t("vouchersExpiredChip", { count: vouchers.expired_count, amount: formatMoney(vouchers.expired_balance) })}
            size="small" color="warning" variant="outlined"
          />
        )}
      </Stack>

      <Grid container spacing={2}>
        {/* Sold vs redeemed over time */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t("voucherActivityOverTime")}
            </Typography>
            {hasOverTime ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={0} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sold" name={t("voucherSold")} fill="#002d04" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="redeemed" name={t("voucherRedeemed")} fill="#60a561" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : empty}
          </Paper>
        </Grid>

        {/* By source */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t("voucherBySource")}
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
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[d.source] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            ) : empty}
            <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {vouchers.by_source.map((s, i) => (
                <Box key={s.source} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: SOURCE_COLORS[s.source] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }} />
                    <Typography variant="caption" color="text.secondary">
                      {sourceLabel(s.source)} ({s.count})
                    </Typography>
                  </Box>
                  <Typography variant="caption" fontWeight={600}>{formatMoney(s.value)}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VoucherSection;
