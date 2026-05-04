"use client";

import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";

interface Props {
  tips: StatsResponse["tips"];
}

const TipsSection = ({ tips }: Props) => {
  const t = useTranslations("Stats");

  if (tips.tip_count === 0) return null;

  const chartData = tips.by_therapist.map((th) => ({
    label: th.therapist_name,
    gross: th.gross_amount,
    net: th.net_amount,
  }));

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>{t("tipsSectionTitle")}</Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={t("totalTipsChip", { count: tips.tip_count })} size="small" variant="outlined" />
        <Chip label={t("grossChip", { amount: formatMoney(tips.total_gross) })} size="small" variant="outlined" />
        <Chip label={t("netChip", { amount: formatMoney(tips.total_net) })} size="small" color="success" variant="outlined" />
        <Chip label={t("vatChip", { amount: formatMoney(tips.total_gross - tips.total_net) })} size="small" color="warning" variant="outlined" />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t("byTherapistChart")}
            </Typography>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 52 + 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                <Bar dataKey="gross" name={t("gross")} fill="#60a561" radius={[0, 2, 2, 0]} />
                <Bar dataKey="net" name={t("net")} fill="#002d04" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              {t("detailByTherapist")}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {tips.by_therapist.map((th) => (
                <Box key={th.therapist_id}>
                  <Typography variant="body2" fontWeight={600}>{th.therapist_name}</Typography>
                  <Box sx={{ display: "flex", gap: 2, mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("tipCount", { count: th.tip_count })}
                    </Typography>
                    <Typography variant="caption">{t("gross")} {formatMoney(th.gross_amount)}</Typography>
                    <Typography variant="caption" color="success.main">{t("net")} {formatMoney(th.net_amount)}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TipsSection;
