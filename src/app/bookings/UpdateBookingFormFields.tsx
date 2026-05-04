"use client";

import { useTranslations } from "next-intl";
import {
  BOOKING_DEFAULT_DURATIONS,
  BOOKING_DEFAULT_PRICES,
  BOOKING_DEFAULT_SERVICES,
  BOOKING_DEFAULT_STATUSES,
} from "@/constants";
import { useServiceLookups } from "@/hooks/useServiceLookups";
import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFormContext } from "react-hook-form";
import { Dispatch, SetStateAction } from "react";
import BookingClientSection from "./BookingClientSection";
import { normalizeMoney } from "@/utils/normalizeMoney";
import { formatMoney, formatMoneyInput } from "@/utils/formatMoney";
import { useTherapists } from "@/hooks/useTherapists";
import TipSection from "./TipSection";

interface Props {
  bookingId: string;
  setIsPaymentDialogOpen: Dispatch<SetStateAction<boolean>>;
  paymentSummary: {
    totalPrice: number;
    paidCash: number;
    paidCard: number;
    totalPaid: number;
    remainingBalance: number;
  };
}

const UpdateBookingFormFields = ({ bookingId, setIsPaymentDialogOpen, paymentSummary }: Props) => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");
  const tBookings = useTranslations("Bookings");
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<BookingUpdateSchemaType>();

  const { totalPrice, totalPaid, remainingBalance } = paymentSummary;
  const therapists = useTherapists();
  const therapistId = watch("therapist_id");

  const { availableServices, availableDurations, availablePrices } = useServiceLookups();
  const serviceOptions = availableServices.length > 0 ? availableServices : BOOKING_DEFAULT_SERVICES;
  const durationOptions = availableDurations.length > 0 ? availableDurations : BOOKING_DEFAULT_DURATIONS;
  const priceOptions = availablePrices.length > 0 ? availablePrices : BOOKING_DEFAULT_PRICES;

  return (
    <Grid container spacing={{ xs: 1  , xl: 2 }}>
      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">{t("clientSection")}</Typography>
        <Divider />
      </Grid>
      <BookingClientSection autoFocus />
      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">{t("bookingDetails")}</Typography>
        <Divider />
      </Grid>
      <Grid size={6}>
        <Controller
          name="start_time"
          control={control}
          render={({ field }) => (
            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={es}
            >
              <DateTimePicker
                {...field}
                label={t("dateTime")}
                value={field.value}
                onChange={(date) => field.onChange(date)}
                format="dd/MM/yyyy HH:mm"
                ampm={false}
                slotProps={{
                  textField: {
                    error: !!errors.start_time,
                    helperText: errors.start_time?.message,
                    size: "small",
                    sx: { borderRadius: "5px", width: "100%" },
                  },
                }}
              />
            </LocalizationProvider>
          )}
        ></Controller>
      </Grid>
      <Grid size={6}>
        <Controller
          name="service_name"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" error={!!errors.service_name}>
              <InputLabel id="service_name">{tCommon("service")}</InputLabel>
              <Select labelId="service_name" {...field} label={tCommon("service")}>
                {serviceOptions.map((service) => (
                  <MenuItem key={service} value={service}>
                    {service}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.service_name?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="therapist_id"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small">
              <InputLabel>{tCommon("therapist")}</InputLabel>
              <Select {...field} value={field.value ?? ""} label={tCommon("therapist")}>
                <MenuItem value=""><em>{tCommon("none")}</em></MenuItem>
                {therapists.map((th) => (
                  <MenuItem key={th.id} value={th.id}>{th.full_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="duration"
          control={control}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              options={durationOptions}
              value={field.value ?? null}
              onChange={(_, newValue) =>
                field.onChange(Number(newValue) ?? null)
              }
              onInputChange={(_, newInputValue) => {
                const num = parseInt(newInputValue, 10);
                field.onChange(isNaN(num) ? "" : num);
              }}
              getOptionLabel={(option) => String(option) || ""}
              isOptionEqualToValue={(option, value) => option === value}
              renderInput={(params) => (
                <TextField
                  {...params}
                  error={!!errors.duration}
                  helperText={errors.duration?.message}
                  value={Number(field.value)}
                  label={tCommon("duration")}
                  size="small"
                  fullWidth
                />
              )}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="price"
          control={control}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              options={priceOptions}
              value={field.value ? formatMoneyInput(field.value) : null}
              onChange={(_, newValue) =>
                field.onChange(normalizeMoney(newValue as any))
              }
              onInputChange={(_, newInputValue) => {
                field.onChange(normalizeMoney(newInputValue));
              }}
              getOptionLabel={(option) => String(option) || ""}
              isOptionEqualToValue={(option, value) => option === value}
              renderInput={(params) => (
                <TextField
                  {...params}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                  label={tCommon("price")}
                  size="small"
                  fullWidth
                />
              )}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" error={!!errors.status}>
              <InputLabel id="status">{t("status")}</InputLabel>
              <Select labelId="status" {...field} label={t("status")}>
                {BOOKING_DEFAULT_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {tBookings(status as "pending" | "confirmed" | "completed" | "cancelled")}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.status?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Grid>
      <Grid size={12}>
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={tCommon("notes")}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              multiline
              rows={2}
            />
          )}
        />
      </Grid>
      <Grid size={12}>
        <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">{t("payment")}</Typography>
              <Chip
                label={
                  totalPrice === 0 && totalPaid === 0
                    ? t("noPriceSet")
                    : remainingBalance <= 0
                    ? t("paidStatus")
                    : totalPaid > 0
                    ? t("partial")
                    : t("unpaid")
                }
                size="small"
                color={
                  totalPrice === 0 && totalPaid === 0
                    ? "default"
                    : remainingBalance <= 0
                    ? "success"
                    : totalPaid > 0
                    ? "warning"
                    : "default"
                }
              />
            </Box>
            <Box sx={{ display: "flex", gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">{tCommon("price")}</Typography>
                <Typography variant="body2" fontWeight={500}>{formatMoney(totalPrice)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{tBookings("paid")}</Typography>
                <Typography variant="body2" fontWeight={500}>{formatMoney(totalPaid)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t("due")}</Typography>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color={
                    totalPrice === 0 && totalPaid === 0
                      ? "text.secondary"
                      : remainingBalance <= 0
                      ? "success.main"
                      : "error.main"
                  }
                >
                  {formatMoney(Math.max(0, remainingBalance))}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Button variant="outlined" size="small" onClick={() => setIsPaymentDialogOpen(true)}>
            {t("addPayment")}
          </Button>
        </Paper>
      </Grid>

      <Grid size={12}>
        <TipSection bookingId={bookingId} defaultTherapistId={therapistId ?? undefined} />
      </Grid>

      {(errors as any).form?.message && (
        <Container sx={{ marginBottom: 2 }}>
          <Alert severity="error" variant="standard">
            {(errors as any).form.message}
          </Alert>
        </Container>
      )}
    </Grid>
  );
};

export default UpdateBookingFormFields;
