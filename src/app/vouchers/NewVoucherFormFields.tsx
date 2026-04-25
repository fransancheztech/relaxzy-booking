import { VoucherSchemaType } from "@/schemas/voucher.schema";
import { Divider, Grid, TextField, Typography } from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFormContext } from "react-hook-form";
import VoucherClientSection from "./VoucherClientSection";

const NewVoucherFormFields = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<VoucherSchemaType>();

  return (
    <Grid container sx={{ paddingTop: "1rem" }} spacing={{ xs: 1, xl: 2 }}>

      <VoucherClientSection prefix="buyer" label="Buyer" autoFocus />
      <VoucherClientSection prefix="recipient" label="Recipient (optional — defaults to buyer)" />

      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">Voucher Details</Typography>
        <Divider />
      </Grid>

      <Grid size={6}>
        <Controller
          name="initial_balance"
          control={control}
          render={({ field }) => (
            <TextField
              label="Balance (€) *"
              error={!!errors.initial_balance}
              helperText={errors.initial_balance?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="number"
              variant="outlined"
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
              }
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
          )}
        />
      </Grid>

      <Grid size={6}>
        <Controller
          name="expiration_date"
          control={control}
          render={({ field }) => (
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
              <DatePicker
                label="Expiration Date *"
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

      <Grid size={6}>
        <Controller
          name="initial_payment_code"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Payment Reference"
              error={!!errors.initial_payment_code}
              helperText={errors.initial_payment_code?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
            />
          )}
        />
      </Grid>

      <Grid size={6}>
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
            />
          )}
        />
      </Grid>

    </Grid>
  );
};

export default NewVoucherFormFields;
