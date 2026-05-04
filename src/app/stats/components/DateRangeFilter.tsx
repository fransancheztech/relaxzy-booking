"use client";

import {
  Box,
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

export type Preset = "week" | "month" | "year" | "12months" | "all" | "custom";

interface Props {
  preset: Preset;
  customFrom: Date | null;
  customTo: Date | null;
  onChange: (preset: Preset, from: Date, to: Date) => void;
}

export function resolvePreset(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
    case "month":
      return { from: startOfMonth(now), to: now };
    case "year":
      return { from: startOfYear(now), to: now };
    case "12months":
      return { from: subDays(now, 365), to: now };
    case "all":
      return { from: new Date("1970-01-01T00:00:00Z"), to: new Date("2099-12-31T23:59:59Z") };
    default:
      return { from: startOfMonth(now), to: now };
  }
}

const DateRangeFilter = ({ preset, customFrom, customTo, onChange }: Props) => {
  const t = useTranslations("Stats");

  const PRESETS: { value: Preset; label: string }[] = [
    { value: "week", label: t("thisWeek") },
    { value: "month", label: t("thisMonth") },
    { value: "year", label: t("thisYear") },
    { value: "12months", label: t("last12Months") },
    { value: "all", label: t("all") },
    { value: "custom", label: t("custom") },
  ];

  const handlePreset = (_: React.MouseEvent, value: Preset | null) => {
    if (!value) return;
    if (value === "custom") {
      onChange("custom", customFrom ?? new Date(), customTo ?? new Date());
      return;
    }
    const { from, to } = resolvePreset(value);
    onChange(value, from, to);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap">
        <ToggleButtonGroup
          value={preset}
          exclusive
          onChange={handlePreset}
          size="small"
          sx={{ flexWrap: "wrap" }}
        >
          {PRESETS.map((p) => (
            <ToggleButton key={p.value} value={p.value} sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {preset === "custom" && (
          <Stack direction="row" spacing={1} alignItems="center">
            <DatePicker
              label={t("from")}
              value={customFrom}
              onChange={(d) => {
                if (d) onChange("custom", d, customTo ?? new Date());
              }}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
            />
            <Typography variant="body2" color="text.secondary">—</Typography>
            <DatePicker
              label={t("to")}
              value={customTo}
              onChange={(d) => {
                if (d) onChange("custom", customFrom ?? new Date(), d);
              }}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
            />
          </Stack>
        )}
      </Stack>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;
