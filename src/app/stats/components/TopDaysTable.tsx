"use client";

import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StatsRevenuePeriodPoint } from "@/types/stats";
import { BUSINESS_TIMEZONE } from "@/constants";
import { formatMoney } from "@/utils/formatMoney";
import type { Stream } from "./RevenueSection";

type Metric = "total" | "cash" | "card";

const LIMITS = [10, 25, 50, 100] as const;

interface Props {
  days: StatsRevenuePeriodPoint[];
  /** The Revenue section's Include chips: the table counts the same streams as the charts. */
  streams: Stream[];
}

/** The best days of the period by revenue, counting the streams selected for the section. */
const TopDaysTable = ({ days, streams }: Props) => {
  const t = useTranslations("Stats");
  const locale = useLocale();

  const [metric, setMetric] = useState<Metric>("total");
  const [limit, setLimit] = useState<number>(10);

  const rows = useMemo(() => {
    const has = (s: Stream) => streams.includes(s);
    const valueOf = (r: { cash: number; card: number; total: number }) =>
      metric === "cash" ? r.cash : metric === "card" ? r.card : r.total;
    return days
      .map((d) => {
        const cash = (has("bookings") ? d.bookings.cash : 0) + (has("vouchers") ? d.vouchers.cash : 0) + (has("tips") ? d.tips.cash : 0);
        const card = (has("bookings") ? d.bookings.credit_card : 0) + (has("vouchers") ? d.vouchers.credit_card : 0) + (has("tips") ? d.tips.credit_card : 0);
        const refunds = (has("bookings") ? d.bookings.refunds : 0) + (has("vouchers") ? d.vouchers.refunds : 0);
        return { day: d.period, cash, card, refunds, total: cash + card - refunds };
      })
      // A day with nothing in the selected method is not a top day by that method.
      .filter((r) => valueOf(r) > 0)
      .sort((a, b) => valueOf(b) - valueOf(a) || a.day.localeCompare(b.day))
      .slice(0, limit);
  }, [days, streams, metric, limit]);

  const showRefunds = rows.some((r) => r.refunds > 0);
  const dayLabel = (iso: string) =>
    DateTime.fromISO(iso, { zone: BUSINESS_TIMEZONE }).setLocale(locale).toFormat("ccc dd/MM/yyyy");
  // The ranked column is set in bold, so the order reads at a glance.
  const ranked = (m: Metric) => (metric === m ? { fontWeight: 600 } : undefined);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t("topDaysTitle")}
        </Typography>
        <ToggleButtonGroup
          value={metric}
          exclusive
          size="small"
          onChange={(_, v: Metric | null) => { if (v) setMetric(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          <ToggleButton value="total">{t("topDaysByTotal")}</ToggleButton>
          <ToggleButton value="cash">{t("topDaysByCash")}</ToggleButton>
          <ToggleButton value="card">{t("topDaysByCard")}</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 96 }}>
          <InputLabel>{t("topNLabel")}</InputLabel>
          <Select value={limit} label={t("topNLabel")} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {streams.length === 0 || rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
          {streams.length === 0 ? t("noneSelected") : t("noDataForPeriod")}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": { fontVariantNumeric: "tabular-nums" } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t("topDaysColDay")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("cash")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("card")}</TableCell>
                {showRefunds && <TableCell align="right" sx={{ fontWeight: 600 }}>{t("topDaysColRefunds")}</TableCell>}
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("total")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.day} hover>
                  <TableCell sx={{ color: "text.disabled" }}>{i + 1}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dayLabel(r.day)}</TableCell>
                  <TableCell align="right" sx={ranked("cash")}>{formatMoney(r.cash)}</TableCell>
                  <TableCell align="right" sx={ranked("card")}>{formatMoney(r.card)}</TableCell>
                  {showRefunds && (
                    <TableCell align="right" sx={{ color: r.refunds > 0 ? "error.main" : "text.disabled" }}>
                      {r.refunds > 0 ? `−${formatMoney(r.refunds)}` : "—"}
                    </TableCell>
                  )}
                  <TableCell align="right" sx={ranked("total")}>{formatMoney(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
        {t("topDaysFootnote")}
      </Typography>
    </Box>
  );
};

export default TopDaysTable;
