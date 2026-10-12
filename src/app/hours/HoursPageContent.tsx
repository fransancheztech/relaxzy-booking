"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useLayout } from "@/app/context/LayoutContext";
import { businessDayStartUtc, businessDayEndExclusiveUtc, formatBusinessDate } from "@/utils/businessTime";
import DateRangeFilter, { Preset, resolvePreset } from "@/app/stats/components/DateRangeFilter";
import TherapistHoursSection from "./TherapistHoursSection";
import { isHoursLookbackLimited, therapistHoursFloor } from "@/lib/hours/window";

interface Props {
  role: string;
}

// Therapists get a shorter preset list: with the lookback floor applied, "This year",
// "Last 12 months" and "All" would all resolve to the same window, so only the ones that
// stay distinct are offered. "All" then means "everything you are allowed to see".
const THERAPIST_PRESETS: Preset[] = ["today", "week", "month", "all"];

const HoursPageContent = ({ role }: Props) => {
  const t = useTranslations("Stats");
  const { setButtonLabel, setOnButtonClick } = useLayout();

  // Null for admins — they can look back without limit.
  const floor = useMemo(
    () => (isHoursLookbackLimited(role) ? therapistHoursFloor() : null),
    [role],
  );
  // Never let the displayed range start before what this role may query. The API clamps
  // too; this keeps the pickers honest so the table matches what was asked for.
  const clampFrom = (d: Date) => (floor && d < floor ? floor : d);

  const [preset, setPreset] = useState<Preset>("month");
  // pickFrom/pickTo are the inclusive, date-only values shown in the pickers.
  const [pickFrom, setPickFrom] = useState<Date>(() => resolvePreset("month").from);
  const [pickTo, setPickTo] = useState<Date>(() => resolvePreset("month").to);

  // Effective half-open query window in business time (Europe/Madrid): `from` is the start
  // of pickFrom's Madrid day, `to` is the start of the day after pickTo's Madrid day, so the
  // selected end day is fully included regardless of the operator's device timezone.
  const from = useMemo(() => businessDayStartUtc(pickFrom)!, [pickFrom]);
  const to = useMemo(() => businessDayEndExclusiveUtc(pickTo)!, [pickTo]);

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);

  const handlePresetChange = (newPreset: Preset) => {
    const { from: f, to: t2 } = resolvePreset(newPreset);
    setPreset(newPreset);
    setPickFrom(clampFrom(f));
    setPickTo(t2);
  };

  // Editing a date is a manual range — no preset stays highlighted.
  const handleFromChange = (d: Date) => { setPreset("custom"); setPickFrom(clampFrom(d)); };
  const handleToChange = (d: Date) => { setPreset("custom"); setPickTo(d); };

  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <DateRangeFilter
          preset={preset}
          from={pickFrom}
          to={pickTo}
          onPresetChange={handlePresetChange}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          presets={floor ? THERAPIST_PRESETS : undefined}
          minDate={floor ?? undefined}
        />

        {floor && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {t("hoursLookbackNotice", { date: formatBusinessDate(floor) })}
          </Typography>
        )}
      </Box>

      <TherapistHoursSection isTherapist={role === "therapist"} from={from} to={to} />
    </Box>
  );
};

export default HoursPageContent;
