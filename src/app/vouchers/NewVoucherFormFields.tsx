"use client";

import { VoucherSchemaInput } from "@/schemas/voucher.schema";
import { Divider, FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, InputAdornment, InputLabel, MenuItem, Radio, RadioGroup, Select, TextField, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useEffect } from "react";
import VoucherClientSection from "./VoucherClientSection";
import { useTranslations } from "next-intl";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";
import { BusinessDatePicker } from "@/components/BusinessDatePickers";
import { addBusinessDays } from "@/utils/businessTime";

// Small info icon + tooltip for per-field contextual help.
const FieldHelp = ({ title }: { title: string }) => (
  <Tooltip title={title} arrow enterTouchDelay={0}>
    <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
  </Tooltip>
);

// Same icon wrapped as an input adornment, for placing inside a field.
const HelpAdornment = ({ title, position }: { title: string; position: "start" | "end" }) => (
  <InputAdornment position={position}>
    <FieldHelp title={title} />
  </InputAdornment>
);

const NewVoucherFormFields = () => {
  const t = useTranslations("Vouchers");
  const tCommon = useTranslations("Common");
  const {
    control,
    setValue,
    formState: { errors, dirtyFields },
  } = useFormContext<VoucherSchemaInput>();
  const source = useWatch({ control, name: "source" });
  const createdAt = useWatch({ control, name: "created_at" });

  // Keep the expiry defaulted to exactly 180 days after the (sale) created_at date. Recompute
  // whenever created_at changes — including backdating — but stop once the receptionist
  // has manually edited the expiry (so their choice is never overwritten).
  useEffect(() => {
    if (!createdAt || dirtyFields.expiration_date) return;
    const next = addBusinessDays(createdAt as Date, 180);
    if (next) setValue("expiration_date", next);
  }, [createdAt, dirtyFields.expiration_date, setValue]);

  return (
    <Grid container spacing={{ xs: 1, xl: 2 }}>

      <VoucherClientSection prefix="buyer" label={t("buyerLabel")} autoFocus />
      <VoucherClientSection prefix="recipient" label={t("recipientLabel")} />

      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">{t("voucherDetails")}</Typography>
        <Divider />
      </Grid>

      <Grid size={4}>
        <Controller
          name="initial_balance"
          control={control}
          render={({ field }) => (
            <TextField
              label={t("balanceEur")}
              required
              error={!!errors.initial_balance}
              helperText={errors.initial_balance?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(normalizeMoneyInput(e.target.value))}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              slotProps={{
                htmlInput: { inputMode: "decimal" },
                input: { endAdornment: <HelpAdornment title={t("balanceHelp")} position="end" /> },
              }}
            />
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="payment_method"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" required error={!!errors.payment_method}>
              <InputLabel id="payment-method-label">{t("paymentMethod")}</InputLabel>
              <Select
                {...field}
                labelId="payment-method-label"
                label={t("paymentMethod")}
              >
                <MenuItem value="cash">{t("cash")}</MenuItem>
                <MenuItem value="credit_card">{t("creditCard")}</MenuItem>
              </Select>
              {errors.payment_method && (
                <FormHelperText>{errors.payment_method.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="created_at"
          control={control}
          render={({ field }) => (
            <BusinessDatePicker
              label={t("createdAt")}
              value={(field.value as Date) ?? null}
              onChange={(date) => field.onChange(date ?? new Date())}
              disableFuture
              slotProps={{
                textField: {
                  error: !!errors.created_at,
                  helperText: errors.created_at?.message,
                  size: "small",
                  sx: { width: "100%" },
                  onBlur: field.onBlur,
                  name: field.name,
                  inputRef: field.ref,
                  InputProps: { startAdornment: <HelpAdornment title={t("createdAtHelp")} position="start" /> },
                },
              }}
            />
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="expiration_date"
          control={control}
          render={({ field }) => (
            <BusinessDatePicker
              label={t("expirationDate")}
              value={field.value ?? null}
              onChange={(date) => field.onChange(date)}
              slotProps={{
                textField: {
                  required: true,
                  error: !!errors.expiration_date,
                  helperText: errors.expiration_date?.message,
                  size: "small",
                  sx: { borderRadius: "5px", width: "100%" },
                  onBlur: field.onBlur,
                  name: field.name,
                  inputRef: field.ref,
                  InputProps: { startAdornment: <HelpAdornment title={t("expirationDateHelp")} position="start" /> },
                },
              }}
            />
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <FormControl
              fullWidth
              required
              error={!!errors.source}
              sx={{
                height: 40,
                border: 1,
                borderColor: errors.source ? "error.main" : "rgba(0, 0, 0, 0.23)",
                borderRadius: 1,
                px: 1.5,
                position: "relative",
                justifyContent: "center",
                "&:hover": {
                  borderColor: errors.source ? "error.main" : "text.primary",
                },
              }}
            >
              <FormLabel
                required
                sx={{
                  position: "absolute",
                  top: -8,
                  left: 8,
                  bgcolor: "background.paper",
                  px: 0.5,
                  fontSize: 12,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.25,
                }}
              >
                {t("source")}
                <FieldHelp title={t("sourceHelp")} />
              </FormLabel>
              <RadioGroup {...field} row sx={{ flexWrap: "nowrap" }}>
                <FormControlLabel
                  value="physical"
                  control={<Radio size="small" sx={{ p: 0.5 }} />}
                  label={
                    <Typography variant="body2">{t("sourcePhysical")}</Typography>
                  }
                  sx={{ mr: 1.5, ml: -0.5 }}
                />
                <FormControlLabel
                  value="online"
                  control={<Radio size="small" sx={{ p: 0.5 }} />}
                  label={
                    <Typography variant="body2">{t("sourceOnline")}</Typography>
                  }
                  sx={{ mr: 0 }}
                />
              </RadioGroup>
              {errors.source && (
                <FormHelperText sx={{ position: "absolute", bottom: -22, left: 0 }}>
                  {errors.source.message}
                </FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="external_reference"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("externalReference")}
              error={!!errors.external_reference}
              helperText={errors.external_reference?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              slotProps={{
                input: {
                  ...(source === "online"
                    ? { startAdornment: <InputAdornment position="start">#</InputAdornment> }
                    : {}),
                  endAdornment: <HelpAdornment title={t("externalReferenceHelp")} position="end" />,
                },
              }}
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
              helperText={errors.notes?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
            />
          )}
        />
      </Grid>

    </Grid>
  );
};

export default NewVoucherFormFields;
