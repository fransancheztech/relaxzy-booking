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
        <Typography variant="subtitle2" color="text.secondary">Client</Typography>
        <Divider />
      </Grid>
      <BookingClientSection autoFocus />
      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">Booking Details</Typography>
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
                label="Date & Time"
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
              <InputLabel id="service_name">Service</InputLabel>
              <Select labelId="service_name" {...field} label="Service">
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
              <InputLabel>Therapist</InputLabel>
              <Select {...field} value={field.value ?? ""} label="Therapist">
                <MenuItem value=""><em>None</em></MenuItem>
                {therapists.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>
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
                  label="Duration"
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
                  label="Price"
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
              <InputLabel id="status">Status</InputLabel>
              <Select labelId="status" {...field} label="Status">
                {BOOKING_DEFAULT_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status[0].toUpperCase() + status.slice(1)}
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
              label="Notes"
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
              <Typography variant="subtitle2" color="text.secondary">Payment</Typography>
              <Chip
                label={
                  totalPrice === 0 && totalPaid === 0
                    ? "No price set"
                    : remainingBalance <= 0
                    ? "Paid"
                    : totalPaid > 0
                    ? "Partial"
                    : "Unpaid"
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
                <Typography variant="caption" color="text.secondary">Price</Typography>
                <Typography variant="body2" fontWeight={500}>{formatMoney(totalPrice)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Paid</Typography>
                <Typography variant="body2" fontWeight={500}>{formatMoney(totalPaid)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Due</Typography>
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
            Add Payment
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
