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
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StatsBookingsDayPoint } from "@/types/stats";
import { formatHours } from "@/utils/formatHours";
import { PERIOD_KEYS, PERIOD_UNITS, periodCellSx, periodLabel, periodStart, type PeriodUnit } from "./periods";

const LIMITS = [10, 25, 50, 100] as const;

const TITLE_KEYS: Record<PeriodUnit, string> = {
  day: "busiestDaysTitle",
  week: "busiestWeeksTitle",
  month: "busiestMonthsTitle",
  year: "busiestYearsTitle",
};

interface Props {
  days: StatsBookingsDayPoint[];
}

/**
 * The days, weeks, months or years of the period with the most hours of service provided
 * (completed bookings). Longer periods are added up from the days, so they only count the dates
 * selected on the page.
 */
const BusiestPeriodsTable = ({ days }: Props) => {
  const t = useTranslations("Stats");
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  const locale = useLocale();

  const [unit, setUnit] = useState<PeriodUnit>("day");
  const [limit, setLimit] = useState<number>(10);

  const rows = useMemo(() => {
    const periods = new Map<string, { period: string; bookings: number; hours: number }>();
    for (const d of days) {
      const period = periodStart(d.period, unit);
      const p = periods.get(period) ?? { period, bookings: 0, hours: 0 };
      p.bookings += d.bookings;
      p.hours += d.hours;
      periods.set(period, p);
    }
    return [...periods.values()]
      .filter((p) => p.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.period.localeCompare(b.period))
      .slice(0, limit);
  }, [days, unit, limit]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {tk(TITLE_KEYS[unit])}
        </Typography>
        <ToggleButtonGroup
          value={unit}
          exclusive
          size="small"
          onChange={(_, v: PeriodUnit | null) => { if (v) setUnit(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          {PERIOD_UNITS.map((u) => (
            <ToggleButton key={u} value={u}>{tk(PERIOD_KEYS[u].toggle)}</ToggleButton>
          ))}
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

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
          {t("noDataForPeriod")}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": { fontVariantNumeric: "tabular-nums" } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tk(PERIOD_KEYS[unit].column)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("busiestColBookings")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("busiestColHours")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.period} hover>
                  <TableCell sx={{ color: "text.disabled" }}>{i + 1}</TableCell>
                  <TableCell sx={periodCellSx}>{periodLabel(r.period, unit, locale)}</TableCell>
                  <TableCell align="right">{r.bookings}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatHours(r.hours)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
        {t("busiestFootnote")}
        {unit !== "day" && ` ${t("topPeriodsPartialNote")}`}
      </Typography>
    </Box>
  );
};

export default BusiestPeriodsTable;
