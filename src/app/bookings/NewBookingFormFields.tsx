"use client";

import { useTranslations } from "next-intl";
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
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { normalizeMoney, normalizeMoneyInput } from "@/utils/normalizeMoney";

const toPaymentNumber = (raw: string): number | undefined => {
  const filtered = normalizeMoneyInput(raw);
  if (filtered === "") return undefined;
  const n = parseFloat(filtered);
  return isNaN(n) || n <= 0 ? undefined : n;
};
import BookingClientSection from "./BookingClientSection";
import { useTherapists } from "@/hooks/useTherapists";
import { useServiceLookups } from "@/hooks/useServiceLookups";
import VoucherPickerField from "./VoucherPickerField";

// ─── Inline payment section ──────────────────────────────────────────────────

interface InlinePaymentSectionProps {
  cashName: string;
  cardName: string;
  voucherAmountName: string;
  voucherCodeName: string;
  priceName: string;
}

const InlinePaymentSection = ({
  cashName,
  cardName,
  voucherAmountName,
  voucherCodeName,
  priceName,
}: InlinePaymentSectionProps) => {
  const tPayment = useTranslations("BookingPayment");
  const tForm = useTranslations("BookingForm");
  const { control, setValue } = useFormContext<BookingSchemaType>();

  const [watchedPrice, watchedCash, watchedCard] = useWatch({
    control,
    name: [priceName as any, cashName as any, cardName as any],
  });
  const remainingAmount = Math.max(
    0,
    (watchedPrice ?? 0) - (watchedCash ?? 0) - (watchedCard ?? 0)
  );
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);

  const closePayment = () => {
    setValue(cashName as any, undefined);
    setValue(cardName as any, undefined);
    setValue(voucherAmountName as any, undefined);
    setValue(voucherCodeName as any, undefined);
    setVoucherOpen(false);
    setPaymentOpen(false);
  };

  return (
    <Box sx={{ mt: 0.5 }}>
      <Divider
        onClick={() => (paymentOpen ? closePayment() : setPaymentOpen(true))}
        sx={{ cursor: "pointer", userSelect: "none" }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          {paymentOpen ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
          {tForm("addPayment")}
        </Typography>
      </Divider>

      <Collapse in={paymentOpen} unmountOnExit>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid size={6}>
            <Controller
              name={cashName as any}
              control={control}
              render={({ field }) => (
                <TextField
                  value={field.value != null ? String(field.value) : ""}
                  onChange={(e) => field.onChange(toPaymentNumber(e.target.value))}
                  label={tPayment("cash")}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                />
              )}
            />
          </Grid>
          <Grid size={6}>
            <Controller
              name={cardName as any}
              control={control}
              render={({ field }) => (
                <TextField
                  value={field.value != null ? String(field.value) : ""}
                  onChange={(e) => field.onChange(toPaymentNumber(e.target.value))}
                  label={tPayment("card")}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                />
              )}
            />
          </Grid>

          {/* Voucher sub-section */}
          <Grid size={12}>
            <Divider
              onClick={() => {
                if (voucherOpen) {
                  setValue(voucherAmountName as any, undefined);
                  setValue(voucherCodeName as any, undefined);
                }
                setVoucherOpen((p) => !p);
              }}
              sx={{ cursor: "pointer", userSelect: "none" }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                {voucherOpen ? (
                  <ExpandLessIcon fontSize="inherit" />
                ) : (
                  <ExpandMoreIcon fontSize="inherit" />
                )}
                {tPayment("voucher")}
              </Typography>
            </Divider>
          </Grid>
          <Grid size={12}>
            <Collapse in={voucherOpen} unmountOnExit>
              <Grid container spacing={1}>
                <Grid size={6}>
                  <VoucherPickerField
                    key={String(voucherOpen)}
                    control={control}
                    voucherCodeName={voucherCodeName as any}
                    remainingAmount={remainingAmount}
                    onSetVoucherPayment={(val) =>
                      setValue(
                        voucherAmountName as any,
                        val === "0" ? undefined : (Number(val) || undefined)
                      )
                    }
                  />
                </Grid>
                <Grid size={6}>
                  <Controller
                    name={voucherAmountName as any}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        value={field.value != null ? String(field.value) : ""}
                        onChange={(e) => field.onChange(toPaymentNumber(e.target.value))}
                        label={tPayment("voucherAmount")}
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Collapse>
          </Grid>
        </Grid>
      </Collapse>
    </Box>
  );
};

// ─── Companion row ────────────────────────────────────────────────────────────

interface CompanionRowProps {
  index: number;
  onRemove: () => void;
  lookupPrice: (name: string, duration: number) => number | undefined;
  lookupDuration: (name: string, price: number) => number | undefined;
  therapists: { id: string; full_name: string }[];
  serviceOptions: string[];
  durationOptions: number[];
  priceOptions: number[];
}

const CompanionRow = ({
  index,
  onRemove,
  lookupPrice,
  lookupDuration,
  therapists,
  serviceOptions,
  durationOptions,
  priceOptions,
}: CompanionRowProps) => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<BookingSchemaType>();

  const [companionService, companionDuration, companionPrice] = useWatch({
    control,
    name: [
      `companions.${index}.service_name`,
      `companions.${index}.duration`,
      `companions.${index}.price`,
    ],
  });

  // Autofill price when service + duration set and price is empty
  useEffect(() => {
    if (!companionService || !companionDuration) return;
    const current = getValues(`companions.${index}.price`);
    if (current != null && String(current) !== "") return;
    const price = lookupPrice(String(companionService), Number(companionDuration));
    if (price != null) setValue(`companions.${index}.price`, price);
  }, [companionService, companionDuration, lookupPrice, index, getValues, setValue]);

  // Autofill duration when service + price set and duration is empty
  useEffect(() => {
    if (!companionService || !companionPrice) return;
    const current = getValues(`companions.${index}.duration`);
    if (current != null && String(current) !== "") return;
    const duration = lookupDuration(String(companionService), Number(companionPrice));
    if (duration != null) setValue(`companions.${index}.duration`, duration);
  }, [companionService, companionPrice, lookupDuration, index, getValues, setValue]);

  return (
    <Box
      sx={{
        bgcolor: "action.hover",
        borderRadius: 1,
        px: 1.5,
        py: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
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
              <InputLabel>{tCommon("service")}</InputLabel>
              <Select {...field} label={tCommon("service")}>
                <MenuItem value=""><em>{tCommon("none")}</em></MenuItem>
                {serviceOptions.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {/* Therapist */}
        <Controller
          name={`companions.${index}.therapist_id`}
          control={control}
          render={({ field }) => (
            <FormControl size="small" sx={{ flex: 1.2 }}>
              <InputLabel>{tCommon("therapist")}</InputLabel>
              <Select {...field} value={field.value ?? ""} label={tCommon("therapist")}>
                <MenuItem value=""><em>{tCommon("none")}</em></MenuItem>
                {therapists.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>
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
              options={durationOptions}
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
                  label={tCommon("duration")}
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
              options={priceOptions}
              value={field.value ?? null}
              onChange={(_, v) => field.onChange(normalizeMoney(v as string))}
              onInputChange={(_, v) => field.onChange(normalizeMoney(v))}
              getOptionLabel={(o) => String(o) || ""}
              isOptionEqualToValue={(o, v) => o === v}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField {...params} label={tCommon("price")} size="small" />
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
              label={tCommon("notes")}
              size="small"
              sx={{ flex: 1.5 }}
            />
          )}
        />

        <Tooltip title={t("removeCompanion")}>
          <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <InlinePaymentSection
        cashName={`companions.${index}.cashPayment`}
        cardName={`companions.${index}.cardPayment`}
        voucherAmountName={`companions.${index}.voucherPayment`}
        voucherCodeName={`companions.${index}.voucherCode`}
        priceName={`companions.${index}.price`}
      />
    </Box>
  );
};

// ─── Main form ────────────────────────────────────────────────────────────────

const NewBookingFormFields = () => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<BookingSchemaType>();

  const { fields: companions, append, remove } = useFieldArray({
    control,
    name: "companions",
  });

  const [primaryService, primaryDuration, primaryPrice, primaryTherapistId, therapistRequested] = useWatch({
    control,
    name: ["service_name", "duration", "price", "therapist_id", "therapist_requested"],
  });

  const therapists = useTherapists();
  const { availableServices, availableDurations, availablePrices, lookupPrice, lookupDuration } = useServiceLookups();

  const serviceOptions = availableServices.length > 0 ? availableServices : BOOKING_DEFAULT_SERVICES;
  const durationOptions = availableDurations.length > 0 ? availableDurations : BOOKING_DEFAULT_DURATIONS;
  const priceOptions = availablePrices.length > 0 ? availablePrices : BOOKING_DEFAULT_PRICES;

  // Autofill price when service + duration set and price is empty
  useEffect(() => {
    if (!primaryService || !primaryDuration) return;
    const current = getValues("price");
    if (current != null && String(current) !== "") return;
    const price = lookupPrice(String(primaryService), Number(primaryDuration));
    if (price != null) setValue("price", price);
  }, [primaryService, primaryDuration, lookupPrice, getValues, setValue]);

  // Autofill duration when service + price set and duration is empty
  useEffect(() => {
    if (!primaryService || !primaryPrice) return;
    const current = getValues("duration");
    if (current != null && String(current) !== "") return;
    const duration = lookupDuration(String(primaryService), Number(primaryPrice));
    if (duration != null) setValue("duration", duration);
  }, [primaryService, primaryPrice, lookupDuration, getValues, setValue]);

  return (
    <Grid container spacing={{ xs: 1, xl: 2 }}>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Controller
            name="therapist_id"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>{tCommon("therapist")}</InputLabel>
                <Select {...field} value={field.value ?? ""} label={tCommon("therapist")}>
                  <MenuItem value=""><em>{tCommon("none")}</em></MenuItem>
                  {therapists.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>
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
                  label={tCommon("price")}
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
            />
          )}
        ></Controller>
      </Grid>

      {/* Main booking payment */}
      <Grid size={12}>
        <InlinePaymentSection
          cashName="cashPayment"
          cardName="cardPayment"
          voucherAmountName="voucherPayment"
          voucherCodeName="voucherCode"
          priceName="price"
        />
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
            {t("companions")}
          </Typography>
          <Divider sx={{ flex: 1 }} />
          <Tooltip title={t("addCompanion")}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() =>
                append({
                  service_name: primaryService ?? "",
                  therapist_id: primaryTherapistId ?? "",
                  duration: primaryDuration ?? 60,
                  price: primaryPrice ?? undefined,
                  notes: "",
                })
              }
            >
              {t("add")}
            </Button>
          </Tooltip>
        </Box>
        {companions.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
            {t("noCompanions")}
          </Typography>
        )}
      </Grid>

      {companions.map((companion, index) => (
        <Grid size={12} key={companion.id}>
          <CompanionRow
            index={index}
            onRemove={() => remove(index)}
            lookupPrice={lookupPrice}
            lookupDuration={lookupDuration}
            therapists={therapists}
            serviceOptions={serviceOptions}
            durationOptions={durationOptions}
            priceOptions={priceOptions}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default NewBookingFormFields;
