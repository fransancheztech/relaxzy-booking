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
type Unit = "day" | "week" | "month" | "year";

const LIMITS = [10, 25, 50, 100] as const;

const UNIT_KEYS: Record<Unit, { toggle: string; title: string; column: string }> = {
  day: { toggle: "periodDays", title: "topDaysTitle", column: "topDaysColDay" },
  week: { toggle: "periodWeeks", title: "topWeeksTitle", column: "topColWeek" },
  month: { toggle: "periodMonths", title: "topMonthsTitle", column: "topColMonth" },
  year: { toggle: "periodYears", title: "topYearsTitle", column: "topColYear" },
};

interface Props {
  days: StatsRevenuePeriodPoint[];
  /** The Revenue section's Include chips: the table counts the same streams as the charts. */
  streams: Stream[];
}

/**
 * The best days, weeks, months or years of the period by revenue, counting the streams selected
 * for the section. Longer periods are added up from the days, in business time (weeks start on
 * Monday), so they only count the dates selected on the page.
 */
const TopDaysTable = ({ days, streams }: Props) => {
  const t = useTranslations("Stats");
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  const locale = useLocale();

  const [unit, setUnit] = useState<Unit>("day");
  const [metric, setMetric] = useState<Metric>("total");
  const [limit, setLimit] = useState<number>(10);

  const rows = useMemo(() => {
    const has = (s: Stream) => streams.includes(s);
    const valueOf = (r: { cash: number; card: number; total: number }) =>
      metric === "cash" ? r.cash : metric === "card" ? r.card : r.total;
    const periods = new Map<string, { period: string; cash: number; card: number; refunds: number }>();
    for (const d of days) {
      const period = unit === "day"
        ? d.period
        : DateTime.fromISO(d.period, { zone: BUSINESS_TIMEZONE }).startOf(unit).toISO()!;
      const p = periods.get(period) ?? { period, cash: 0, card: 0, refunds: 0 };
      p.cash += (has("bookings") ? d.bookings.cash : 0) + (has("vouchers") ? d.vouchers.cash : 0) + (has("tips") ? d.tips.cash : 0);
      p.card += (has("bookings") ? d.bookings.credit_card : 0) + (has("vouchers") ? d.vouchers.credit_card : 0) + (has("tips") ? d.tips.credit_card : 0);
      p.refunds += (has("bookings") ? d.bookings.refunds : 0) + (has("vouchers") ? d.vouchers.refunds : 0);
      periods.set(period, p);
    }
    return [...periods.values()]
      .map((p) => ({ ...p, total: p.cash + p.card - p.refunds }))
      // A period with nothing in the selected method is not a top period by that method.
      .filter((r) => valueOf(r) > 0)
      .sort((a, b) => valueOf(b) - valueOf(a) || a.period.localeCompare(b.period))
      .slice(0, limit);
  }, [days, streams, unit, metric, limit]);

  const showRefunds = rows.some((r) => r.refunds > 0);
  const periodLabel = (iso: string) => {
    const dt = DateTime.fromISO(iso, { zone: BUSINESS_TIMEZONE }).setLocale(locale);
    if (unit === "week") {
      const end = dt.endOf("week");
      // A week across New Year names both years.
      return `${dt.toFormat(dt.year === end.year ? "ccc dd/MM" : "ccc dd/MM/yyyy")} – ${end.toFormat("ccc dd/MM/yyyy")}`;
    }
    if (unit === "month") return dt.toFormat("LLLL yyyy");
    if (unit === "year") return dt.toFormat("yyyy");
    return dt.toFormat("ccc dd/MM/yyyy");
  };
  // The ranked column is set in bold, so the order reads at a glance.
  const ranked = (m: Metric) => (metric === m ? { fontWeight: 600 } : undefined);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {tk(UNIT_KEYS[unit].title)}
        </Typography>
        <ToggleButtonGroup
          value={unit}
          exclusive
          size="small"
          onChange={(_, v: Unit | null) => { if (v) setUnit(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          {(Object.keys(UNIT_KEYS) as Unit[]).map((u) => (
            <ToggleButton key={u} value={u}>{tk(UNIT_KEYS[u].toggle)}</ToggleButton>
          ))}
        </ToggleButtonGroup>
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
                <TableCell sx={{ fontWeight: 600 }}>{tk(UNIT_KEYS[unit].column)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("cash")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("card")}</TableCell>
                {showRefunds && <TableCell align="right" sx={{ fontWeight: 600 }}>{t("topDaysColRefunds")}</TableCell>}
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("total")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.period} hover>
                  <TableCell sx={{ color: "text.disabled" }}>{i + 1}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", "&::first-letter": { textTransform: "uppercase" } }}>
                    {periodLabel(r.period)}
                  </TableCell>
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
        {unit !== "day" && ` ${t("topPeriodsPartialNote")}`}
      </Typography>
    </Box>
  );
};

export default TopDaysTable;
