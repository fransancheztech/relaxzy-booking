import { VoucherSchemaType } from "@/schemas/voucher.schema";
import { Alert, Autocomplete, Container, FormControl, Grid, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";

const NewVoucherFormFields = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<VoucherSchemaType>();
  return (
    <Grid container sx={{ paddingTop: "1rem" }} spacing={{ xs: 1, xl: 2 }}>
      <Grid size={6}>
        <Controller
          name="recipient_name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.recipient_name}
              helperText={errors.recipient_name?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="recipient_surname"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.recipient_surname}
              helperText={errors.recipient_surname?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="recipient_phone"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.recipient_phone}
              helperText={errors.recipient_phone?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="recipient_email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.recipient_email}
              helperText={errors.recipient_email?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="buyer_name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.buyer_name}
              helperText={errors.buyer_name?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="buyer_surname"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.buyer_surname}
              helperText={errors.buyer_surname?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
        <Controller
          name="buyer_phone"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.buyer_phone}
              helperText={errors.buyer_phone?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="buyer_email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              error={!!errors.buyer_email}
              helperText={errors.buyer_email?.message}
              fullWidth
              sx={{ borderRadius: "5px" }}
              size="small"
              type="text"
              variant="outlined"
              autoFocus={true}
            />
          )}
        />
      </Grid>
      {/* <Grid size={6}>
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
              <InputLabel id="service_name">Massage</InputLabel>
              <Select labelId="service_name" {...field} label="Massage">
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
            <FormControl size="small" fullWidth>
              <Autocomplete
                freeSolo // <-- allows free text typing
                options={BOOKING_DEFAULT_DURATIONS} // your list of available options
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
                    sx={{ borderRadius: "5px", width: "100%" }}
                  />
                )}
              />
            </FormControl>
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="price"
          control={control}
          render={({ field }) => (
            <FormControl size="small" fullWidth>
              <Autocomplete
                freeSolo // <-- allows free text typing
                options={BOOKING_DEFAULT_PRICES} // your list of available options
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
                    sx={{ borderRadius: "5px", width: "100%" }}
                  />
                )}
              />
            </FormControl>
          )}
        />
      </Grid> */}
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
        ></Controller>
      </Grid>
      {(errors as any).booking_creation_form?.message && (
        <Container sx={{ marginBottom: 2 }}>
          <Alert severity="error" variant="standard">
            {(errors as any).booking_creation_form.message}
          </Alert>
        </Container>
      )}
    </Grid>
  );
}

export default NewVoucherFormFields