"use client";

import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { startOfWeek, startOfMonth, startOfYear, subDays } from "date-fns";
import { useTranslations } from "next-intl";

export type Preset = "today" | "week" | "month" | "year" | "12months" | "all" | "custom";

interface Props {
  preset: Preset;
  from: Date;
  to: Date;
  onPresetChange: (preset: Preset) => void;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
}

// Inclusive, date-only display range for each preset. The page derives the actual
// (half-open) query window from these. "all" keeps `from` before 1990 so the API's
// all-time branch still triggers.
export function resolvePreset(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: now, to: now };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
    case "month":
      return { from: startOfMonth(now), to: now };
    case "year":
      return { from: startOfYear(now), to: now };
    case "12months":
      return { from: subDays(now, 365), to: now };
    case "all":
      return { from: new Date(1970, 0, 1), to: new Date(2099, 11, 31) };
    default:
      return { from: startOfMonth(now), to: now };
  }
}

const DateRangeFilter = ({ preset, from, to, onPresetChange, onFromChange, onToChange }: Props) => {
  const t = useTranslations("Stats");

  const PRESETS: { value: Preset; label: string }[] = [
    { value: "today", label: t("today") },
    { value: "week", label: t("thisWeek") },
    { value: "month", label: t("thisMonth") },
    { value: "year", label: t("thisYear") },
    { value: "12months", label: t("last12Months") },
    { value: "all", label: t("all") },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap">
        <ToggleButtonGroup
          value={preset}
          exclusive
          onChange={(_, value: Preset | null) => { if (value) onPresetChange(value); }}
          size="small"
          sx={{ flexWrap: "wrap" }}
        >
          {PRESETS.map((p) => (
            <ToggleButton key={p.value} value={p.value} sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1} alignItems="center">
          <DatePicker
            label={t("from")}
            value={from}
            onChange={(d) => { if (d) onFromChange(d); }}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
          />
          <Typography variant="body2" color="text.secondary">—</Typography>
          <DatePicker
            label={t("to")}
            value={to}
            onChange={(d) => { if (d) onToChange(d); }}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
          />
        </Stack>
      </Stack>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;
