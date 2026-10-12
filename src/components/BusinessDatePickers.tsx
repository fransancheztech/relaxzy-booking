"use client";

import { ReactNode } from "react";
import { DateTime } from "luxon";
import { useLocale } from "next-intl";
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

// Bounds must stay `undefined` when unset (not null): MUI falls back to its own default
// bounds only for undefined, and feeds the value straight into month-navigation maths.
const toBusinessBound = (value: Date | undefined) =>
  value ? DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE) : undefined;

type CommonProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  label?: ReactNode;
  format?: string;
  disabled?: boolean;
  disableFuture?: boolean;
  // Bounds are declared in plain `Date` like `value`, and converted to the adapter's
  // Luxon DateTime below — passing a JS Date straight through would be silently ignored.
  minDate?: Date;
  maxDate?: Date;
};

export function BusinessDateTimePicker({
  value,
  onChange,
  ampm = false,
  format = "dd/MM/yyyy HH:mm",
  slotProps,
  views,
  minDate,
  maxDate,
  ...rest
}: CommonProps & {
  ampm?: boolean;
  slotProps?: DateTimeSlotProps;
  // Exposed so a caller can pin which views appear — notably to guarantee no seconds view,
  // rather than relying on MUI's default view list staying seconds-free across upgrades.
  views?: React.ComponentProps<typeof DateTimePicker>["views"];
}) {
  // Names (months/weekdays in the popup) follow the app language; the explicit `format`
  // keeps the numeric layout Spanish-style (dd/MM/yyyy) regardless of locale.
  const locale = useLocale();
  return (
    <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale={locale}>
      <DateTimePicker
        {...rest}
        timezone={BUSINESS_TIMEZONE}
        ampm={ampm}
        format={format}
        views={views}
        slotProps={slotProps}
        minDate={toBusinessBound(minDate) as never}
        maxDate={toBusinessBound(maxDate) as never}
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
  minDate,
  maxDate,
  ...rest
}: CommonProps & { slotProps?: DateSlotProps }) {
  const locale = useLocale();
  return (
    <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale={locale}>
      <DatePicker
        {...rest}
        timezone={BUSINESS_TIMEZONE}
        format={format}
        slotProps={slotProps}
        minDate={toBusinessBound(minDate) as never}
        maxDate={toBusinessBound(maxDate) as never}
        value={toBusinessValue(value) as never}
        onChange={(dt) => onChange(fromPickerValue(dt))}
      />
    </LocalizationProvider>
  );
}
