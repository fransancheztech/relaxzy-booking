"use client";

import { VoucherSchemaInput } from "@/schemas/voucher.schema";
import { Divider, FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, InputAdornment, InputLabel, MenuItem, Radio, RadioGroup, Select, TextField, Typography } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import VoucherClientSection from "./VoucherClientSection";
import { useTranslations } from "next-intl";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";

const NewVoucherFormFields = () => {
  const t = useTranslations("Vouchers");
  const tCommon = useTranslations("Common");
  const {
    control,
    formState: { errors },
  } = useFormContext<VoucherSchemaInput>();
  const source = useWatch({ control, name: "source" });

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
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="payment_method"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" error={!!errors.payment_method}>
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
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
              <DatePicker
                label={t("createdAt")}
                value={(field.value as Date) ?? null}
                onChange={(date) => field.onChange(date ?? new Date())}
                format="dd/MM/yyyy"
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
                  },
                }}
              />
            </LocalizationProvider>
          )}
        />
      </Grid>

      <Grid size={4}>
        <Controller
          name="expiration_date"
          control={control}
          render={({ field }) => (
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
              <DatePicker
                label={t("expirationDate")}
                value={field.value ?? null}
                onChange={(date) => field.onChange(date)}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: {
                    error: !!errors.expiration_date,
                    helperText: errors.expiration_date?.message,
                    size: "small",
                    sx: { borderRadius: "5px", width: "100%" },
                    onBlur: field.onBlur,
                    name: field.name,
                    inputRef: field.ref,
                  },
                }}
              />
            </LocalizationProvider>
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
                sx={{
                  position: "absolute",
                  top: -8,
                  left: 8,
                  bgcolor: "background.paper",
                  px: 0.5,
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {t("source")}
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
              slotProps={
                source === "online"
                  ? {
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">#</InputAdornment>
                        ),
                      },
                    }
                  : undefined
              }
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
