import {
  BOOKING_DEFAULT_DURATIONS,
  BOOKING_DEFAULT_PRICES,
  BOOKING_DEFAULT_SERVICES,
} from "@/constants";
import { BookingSchemaType } from "@/schemas/booking.schema";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { normalizeMoney } from "@/utils/normalizeMoney";
import BookingClientSection from "./BookingClientSection";

const NewBookingFormFields = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<BookingSchemaType>();

  const { fields: companions, append, remove } = useFieldArray({
    control,
    name: "companions",
  });

  const [primaryService, primaryDuration, primaryPrice] = useWatch({
    control,
    name: ["service_name", "duration", "price"],
  });

  return (
    <Grid container spacing={{ xs: 1, xl: 2 }}>
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
                {BOOKING_DEFAULT_SERVICES.map((service) => (
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
          name="duration"
          control={control}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              options={BOOKING_DEFAULT_DURATIONS}
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
              options={BOOKING_DEFAULT_PRICES}
              value={field.value ?? null}
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
        ></Controller>
      </Grid>
      {(errors as any).booking_creation_form?.message && (
        <Container sx={{ marginBottom: 2 }}>
          <Alert severity="error" variant="standard">
            {(errors as any).booking_creation_form.message}
          </Alert>
        </Container>
      )}

      {/* Companions section */}
      <Grid size={12} sx={{ mt: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Companions
          </Typography>
          <Divider sx={{ flex: 1 }} />
          <Tooltip title="Add companion (same client, same time)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() =>
                append({
                  service_name: primaryService ?? "",
                  duration: primaryDuration ?? 60,
                  price: primaryPrice ?? undefined,
                  notes: "",
                })
              }
            >
              Add
            </Button>
          </Tooltip>
        </Box>
        {companions.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
            No companions — same client info and start time, no extra data needed.
          </Typography>
        )}
      </Grid>

      {companions.map((companion, index) => (
        <Grid size={12} key={companion.id}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1.5,
              py: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 24, pt: 1.2, fontWeight: 600 }}
            >
              {index + 1}
            </Typography>

            {/* Service */}
            <Controller
              name={`companions.${index}.service_name`}
              control={control}
              render={({ field }) => (
                <FormControl size="small" sx={{ flex: 1.5 }}>
                  <InputLabel>Service</InputLabel>
                  <Select {...field} label="Service">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {BOOKING_DEFAULT_SERVICES.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            {/* Duration */}
            <Controller
              name={`companions.${index}.duration`}
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={BOOKING_DEFAULT_DURATIONS}
                  value={field.value ?? null}
                  onChange={(_, v) => field.onChange(Number(v) ?? null)}
                  onInputChange={(_, v) => {
                    const n = parseInt(v, 10);
                    field.onChange(isNaN(n) ? "" : n);
                  }}
                  getOptionLabel={(o) => String(o) || ""}
                  isOptionEqualToValue={(o, v) => o === v}
                  sx={{ flex: 1 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Duration"
                      size="small"
                      error={!!errors.companions?.[index]?.duration}
                      helperText={errors.companions?.[index]?.duration?.message}
                    />
                  )}
                />
              )}
            />

            {/* Price */}
            <Controller
              name={`companions.${index}.price`}
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={BOOKING_DEFAULT_PRICES}
                  value={field.value ?? null}
                  onChange={(_, v) => field.onChange(normalizeMoney(v as string))}
                  onInputChange={(_, v) => field.onChange(normalizeMoney(v))}
                  getOptionLabel={(o) => String(o) || ""}
                  isOptionEqualToValue={(o, v) => o === v}
                  sx={{ flex: 1 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Price" size="small" />
                  )}
                />
              )}
            />

            {/* Notes */}
            <Controller
              name={`companions.${index}.notes`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Notes"
                  size="small"
                  sx={{ flex: 1.5 }}
                />
              )}
            />

            <Tooltip title="Remove companion">
              <IconButton size="small" color="error" onClick={() => remove(index)} sx={{ mt: 0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

export default NewBookingFormFields;
