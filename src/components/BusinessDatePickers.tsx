"use client";

import { ReactNode } from "react";
import { DateTime } from "luxon";
import { DatePicker, DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterLuxon } from "@mui/x-date-pickers/AdapterLuxon";
import { BUSINESS_TIMEZONE } from "@/constants";

// Pickers pinned to the business timezone (Europe/Madrid) regardless of the device zone.
// Public API deals in plain JS `Date` (so callers/forms/zod are unchanged); internally the
// value is expressed as a Madrid-zoned Luxon DateTime, so a picked "17:00" always means
// 17:00 Madrid. The `as never` casts isolate MUI's adapter-specific generic at this boundary.

type DateTimeSlotProps = React.ComponentProps<typeof DateTimePicker>["slotProps"];
type DateSlotProps = React.ComponentProps<typeof DatePicker>["slotProps"];

const toBusinessValue = (value: Date | null) =>
  value ? DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE) : null;

const fromPickerValue = (dt: unknown): Date | null =>
  dt instanceof DateTime && dt.isValid ? dt.toJSDate() : null;

type CommonProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  label?: ReactNode;
  format?: string;
  disabled?: boolean;
  disableFuture?: boolean;
};

export function BusinessDateTimePicker({
  value,
  onChange,
  ampm = false,
  format = "dd/MM/yyyy HH:mm",
  slotProps,
  ...rest
}: CommonProps & { ampm?: boolean; slotProps?: DateTimeSlotProps }) {
  return (
    <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale="es">
      <DateTimePicker
        {...rest}
        timezone={BUSINESS_TIMEZONE}
        ampm={ampm}
        format={format}
        slotProps={slotProps}
        value={toBusinessValue(value) as never}
        onChange={(dt) => onChange(fromPickerValue(dt))}
      />
    </LocalizationProvider>
  );
}

export function BusinessDatePicker({
  value,
  onChange,
  format = "dd/MM/yyyy",
  slotProps,
  ...rest
}: CommonProps & { slotProps?: DateSlotProps }) {
  return (
    <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale="es">
      <DatePicker
        {...rest}
        timezone={BUSINESS_TIMEZONE}
        format={format}
        slotProps={slotProps}
        value={toBusinessValue(value) as never}
        onChange={(dt) => onChange(fromPickerValue(dt))}
      />
    </LocalizationProvider>
  );
}
