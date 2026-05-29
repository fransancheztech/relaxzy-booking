"use client";

import { useTranslations } from "next-intl";
import {
  BOOKING_DEFAULT_DURATIONS,
  BOOKING_DEFAULT_PRICES,
  BOOKING_DEFAULT_SERVICES,
  ORDERED_BOOKING_STATUSES,
  STATUS_COLORS,
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
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFormContext } from "react-hook-form";
import { Dispatch, SetStateAction } from "react";
import BookingClientSection from "./BookingClientSection";
import BookingGroupSection from "./BookingGroupSection";
import { normalizeMoney } from "@/utils/normalizeMoney";
import { formatMoney, formatMoneyInput } from "@/utils/formatMoney";
import { useTherapists } from "@/hooks/useTherapists";
import TipSection from "./TipSection";

interface Props {
  bookingId: string;
  setIsPaymentDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsManagePaymentsDialogOpen: Dispatch<SetStateAction<boolean>>;
  paymentSummary: {
    totalPrice: number;
    paidCash: number;
    paidCard: number;
    totalPaid: number;
    remainingBalance: number;
  };
  readOnly?: boolean;
  clientNotes?: string | null;
  onClientPicked?: (notes: string | null) => void;
  bookingGroupId?: string | null;
  onGroupChanged?: () => void;
}

const UpdateBookingFormFields = ({ bookingId, setIsPaymentDialogOpen, setIsManagePaymentsDialogOpen, paymentSummary, readOnly, clientNotes, onClientPicked, bookingGroupId, onGroupChanged }: Props) => {
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
  const therapistRequested = watch("therapist_requested");

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
      <BookingClientSection
        readOnly={readOnly}
        clientNotes={clientNotes}
        onClientPicked={(c) => onClientPicked?.(c.client_notes ?? null)}
      />
      <BookingGroupSection
        bookingId={bookingId}
        bookingGroupId={bookingGroupId ?? null}
        readOnly={readOnly}
        onGroupChanged={onGroupChanged}
      />
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
                disabled={readOnly}
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
            <FormControl fullWidth size="small" error={!!errors.service_name} disabled={readOnly}>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Controller
            name="therapist_id"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small" disabled={readOnly}>
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
          <Controller
            name="therapist_requested"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={!!field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={readOnly}
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    {t("therapistRequested")}
                  </Typography>
                }
              />
            )}
          />
        </Box>
      </Grid>
      <Grid size={6}>
        <Controller
          name="duration"
          control={control}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              disabled={readOnly}
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
              disabled={readOnly}
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
            <FormControl fullWidth size="small" error={!!errors.status} disabled={readOnly}>
              <InputLabel id="status">{t("status")}</InputLabel>
              <Select
                labelId="status"
                {...field}
                label={t("status")}
                sx={{
                  backgroundColor: STATUS_COLORS[field.value as keyof typeof STATUS_COLORS]?.bg,
                  color: "#fff",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: STATUS_COLORS[field.value as keyof typeof STATUS_COLORS]?.border,
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: STATUS_COLORS[field.value as keyof typeof STATUS_COLORS]?.border,
                  },
                  "& .MuiSvgIcon-root": { color: "#fff" },
                }}
              >
                {ORDERED_BOOKING_STATUSES.map((status) => (
                  <MenuItem key={status} value={status} sx={{
                    color: "#fff",
                    backgroundColor: STATUS_COLORS[status].bg,
                    "&:hover": { backgroundColor: STATUS_COLORS[status].border, color: "#fff" },
                    "&.Mui-selected": { backgroundColor: STATUS_COLORS[status].bg, color: "#fff" },
                    "&.Mui-selected:hover": { backgroundColor: STATUS_COLORS[status].border, color: "#fff" },
                  }}>
                    {tBookings(status)}
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
              helperText={
                errors.notes?.message
                ?? (therapistRequested ? t("therapistRequestedHelper") : undefined)
              }
              slotProps={{
                formHelperText: therapistRequested && !errors.notes
                  ? { sx: { color: "warning.main", fontWeight: 500 } }
                  : undefined,
              }}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              multiline
              rows={2}
              disabled={readOnly}
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
          {!readOnly && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button variant="outlined" size="small" onClick={() => setIsPaymentDialogOpen(true)}>
                {t("addPayment")}
              </Button>
              <Button variant="text" size="small" color="inherit" onClick={() => setIsManagePaymentsDialogOpen(true)}
                sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                {t("managePayments")}
              </Button>
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid size={12}>
        <TipSection bookingId={bookingId} defaultTherapistId={therapistId ?? undefined} readOnly={readOnly} />
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
