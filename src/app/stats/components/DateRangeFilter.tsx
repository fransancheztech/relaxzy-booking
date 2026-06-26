"use client";

import {
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { BUSINESS_TIMEZONE } from "@/constants";
import { BusinessDatePicker } from "@/components/BusinessDatePickers";

export type Preset = "today" | "week" | "month" | "year" | "12months" | "all" | "custom";

interface Props {
  preset: Preset;
  from: Date;
  to: Date;
  onPresetChange: (preset: Preset) => void;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
}

// Inclusive, date-only display range for each preset, computed in the business timezone so
// boundaries (this week/month/year) match the Spanish calendar regardless of device zone.
// The page derives the actual (half-open) query window from these. "all" keeps `from` far in
// the past so the API's all-time branch still triggers.
export function resolvePreset(preset: Preset): { from: Date; to: Date } {
  const now = DateTime.now().setZone(BUSINESS_TIMEZONE);
  const js = (dt: DateTime) => dt.toJSDate();
  switch (preset) {
    case "today":
      return { from: js(now), to: js(now) };
    case "week":
      return { from: js(now.startOf("week")), to: js(now) };
    case "month":
      return { from: js(now.startOf("month")), to: js(now) };
    case "year":
      return { from: js(now.startOf("year")), to: js(now) };
    case "12months":
      return { from: js(now.minus({ days: 365 })), to: js(now) };
    case "all":
      return { from: new Date(1970, 0, 1), to: new Date(2099, 11, 31) };
    default:
      return { from: js(now.startOf("month")), to: js(now) };
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
        <BusinessDatePicker
          label={t("from")}
          value={from}
          onChange={(d) => { if (d) onFromChange(d); }}
          slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
        />
        <Typography variant="body2" color="text.secondary">—</Typography>
        <BusinessDatePicker
          label={t("to")}
          value={to}
          onChange={(d) => { if (d) onToChange(d); }}
          slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
        />
      </Stack>
    </Stack>
  );
};

export default DateRangeFilter;
