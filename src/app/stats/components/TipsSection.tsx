"use client";

import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StatsResponse } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";
import { formatBusinessBucketLabel } from "@/utils/businessTime";

type Bucket = StatsResponse["meta"]["date_bucket"];
type Method = "cash" | "credit_card";

interface OtTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string }[];
}

interface Props {
  tips: StatsResponse["tips"];
  bucket: Bucket;
  onBucketChange: (bucket: Bucket) => void;
}

const TipsSection = ({ tips, bucket, onBucketChange }: Props) => {
  const t = useTranslations("Stats");

  // Section-wide payment-method filter (default both).
  const [methods, setMethods] = useState<Method[]>(["cash", "credit_card"]);
  const showCash = methods.includes("cash");
  const showCard = methods.includes("credit_card");

  const therapistOptions = tips.over_time_therapists;
  const optionKey = therapistOptions.map((o) => o.therapist_id).join(",");
  const [selected, setSelected] = useState<string[]>(therapistOptions.map((o) => o.therapist_id));
  useEffect(() => {
    setSelected(optionKey ? optionKey.split(",") : []);
  }, [optionKey]);
  const selectedSet = new Set(selected);

  if (tips.tip_count === 0) return null;

  // --- Summary totals for the selected method(s) ---
  const bm = tips.by_method;
  const selCount = (showCash ? bm.cash.count : 0) + (showCard ? bm.credit_card.count : 0);
  const selGross = (showCash ? bm.cash.gross : 0) + (showCard ? bm.credit_card.gross : 0);
  const selNet = (showCash ? bm.cash.net : 0) + (showCard ? bm.credit_card.net : 0);
  const selVat = selGross - selNet;

  // --- By therapist for the selected method(s) and selected therapists ---
  const byTherapist = tips.by_therapist
    .filter((th) => selectedSet.has(th.therapist_id))
    .map((th) => ({
      therapist_id: th.therapist_id,
      therapist_name: th.therapist_name,
      gross: (showCash ? th.cash.gross : 0) + (showCard ? th.credit_card.gross : 0),
      net: (showCash ? th.cash.net : 0) + (showCard ? th.credit_card.net : 0),
      count: (showCash ? th.cash.count : 0) + (showCard ? th.credit_card.count : 0),
    }))
    .filter((th) => th.count > 0)
    .sort((a, b) => b.gross - a.gross);

  const chartData = byTherapist.map((th) => ({ label: th.therapist_name, gross: th.gross, net: th.net }));

  // --- Over time (cash/card per period for the selected therapists) ---
  const bucketLabel = bucket === "day" ? t("tipsPerDay") : bucket === "week" ? t("tipsPerWeek") : t("tipsPerMonth");
  const otBars = tips.over_time.map((p) => {
    const label = formatBusinessBucketLabel(p.period, bucket);
    let cash = 0;
    let credit_card = 0;
    for (const [id, amt] of Object.entries(p.by_therapist)) {
      if (selectedSet.has(id)) {
        cash += amt.cash;
        credit_card += amt.credit_card;
      }
    }
    return { label, cash, credit_card, total: (showCash ? cash : 0) + (showCard ? credit_card : 0) };
  });
  const hasOtData = tips.over_time.length > 0;

  const OtTooltip = ({ active, payload, label }: OtTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((sum, e) => sum + Number(e.value ?? 0), 0);
    return (
      <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.25, py: 0.75, boxShadow: 2 }}>
        <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>{label}</Typography>
        {payload.map((entry) => (
          <Box key={entry.name} sx={{ display: "flex", justifyContent: "space-between", gap: 2.5 }}>
            <Typography variant="caption" sx={{ color: entry.color }}>{entry.name}:</Typography>
            <Typography variant="caption">{formatMoney(Number(entry.value ?? 0))}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2.5, mt: 0.5, pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" fontWeight={700}>{t("total")}:</Typography>
          <Typography variant="caption" fontWeight={700}>{formatMoney(total)}</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h6" fontWeight={600}>{t("tipsSectionTitle")}</Typography>
        <ToggleButtonGroup
          value={methods}
          size="small"
          onChange={(_, v: Method[]) => setMethods(v)}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          <ToggleButton value="cash">{t("cash")}</ToggleButton>
          <ToggleButton value="credit_card">{t("card")}</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("tipsTherapistsLabel")}</InputLabel>
          <Select
            multiple
            value={selected}
            label={t("tipsTherapistsLabel")}
            onChange={(e) =>
              setSelected(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)
            }
            renderValue={(sel) =>
              (sel as string[]).length === therapistOptions.length
                ? t("allTherapists")
                : t("therapistsSelected", { count: (sel as string[]).length })
            }
            MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
          >
            {therapistOptions.map((o) => (
              <MenuItem key={o.therapist_id} value={o.therapist_id}>
                <Checkbox checked={selectedSet.has(o.therapist_id)} size="small" />
                <ListItemText primary={o.therapist_name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={t("totalTipsChip", { count: selCount })} size="small" variant="outlined" />
        <Chip label={t("grossChip", { amount: formatMoney(selGross) })} size="small" variant="outlined" />
        <Chip label={t("netChip", { amount: formatMoney(selNet) })} size="small" color="success" variant="outlined" />
        <Chip label={t("vatChip", { amount: formatMoney(selVat) })} size="small" color="warning" variant="outlined" />
      </Stack>

      <Grid container spacing={2}>
        {/* Tips over time */}
        <Grid size={12}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" color="text.secondary">{bucketLabel}</Typography>
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
            {hasOtData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={otBars} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip content={<OtTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {showCash && <Bar dataKey="cash" name={t("cash")} stackId="a" fill="#002d04" radius={showCard ? [0, 0, 0, 0] : [4, 4, 0, 0]} />}
                  {showCard && <Bar dataKey="credit_card" name={t("card")} stackId="a" fill="#60a561" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
                {t("noDataForPeriod")}
              </Typography>
            )}
          </Paper>
        </Grid>

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
              {byTherapist.map((th) => (
                <Box key={th.therapist_id}>
                  <Typography variant="body2" fontWeight={600}>{th.therapist_name}</Typography>
                  <Box sx={{ display: "flex", gap: 2, mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("tipCount", { count: th.count })}
                    </Typography>
                    <Typography variant="caption">{t("gross")} {formatMoney(th.gross)}</Typography>
                    <Typography variant="caption" color="success.main">{t("net")} {formatMoney(th.net)}</Typography>
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
