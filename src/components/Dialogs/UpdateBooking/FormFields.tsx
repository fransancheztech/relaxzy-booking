import { BOOKING_DEFAULT_DURATIONS, BOOKING_DEFAULT_PRICES, BOOKING_DEFAULT_SERVICES, BOOKING_DEFAULT_STATUSES } from "@/constants";
import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import { Alert, Autocomplete, Button, Container, FormControl, FormHelperText, Grid, InputLabel, MenuItem, Select, TextField, Tooltip } from "@mui/material";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { Controller, useFormContext } from "react-hook-form";
import EuroIcon from '@mui/icons-material/Euro';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { Dispatch, SetStateAction, useState } from "react";

interface Props {
  setIsPaymentDialogOpen: Dispatch<SetStateAction<boolean>>
}

const FormFields = ({ setIsPaymentDialogOpen }: Props) => {
  const { control, formState: { errors }, watch } = useFormContext<BookingUpdateSchemaType>();

  const paidCash = watch('paidCash')
  const paidCard = watch('paidCard')

  return (
    <Grid container sx={{ paddingTop: '1rem' }} spacing={{ xs: 1, xl: 2 }}>
      <Grid size={6}>
        <Controller name="client_name" control={control} disabled render={({ field }) => (
          <TextField
            {...field}
            label='Name'
            error={!!errors.client_name}
            helperText={errors.client_name?.message}
            fullWidth
            sx={{ borderRadius: '5px' }}
            size='small'
            type='text'
            variant='outlined'
            autoFocus={true}
          />
        )}>
        </Controller>
      </Grid>
      <Grid size={6}>
        <Controller name="client_surname" control={control} disabled render={({ field }) => (
          <TextField
            {...field}
            label='Surname(s)'
            error={!!errors.client_surname}
            helperText={errors.client_surname?.message}
            fullWidth
            sx={{ borderRadius: '5px' }}
            size='small'
            type='text'
            variant='outlined'
          />
        )}>
        </Controller>
      </Grid><Grid size={6}>
        <Controller name="client_phone" control={control} disabled render={({ field }) => (
          <TextField
            {...field}
            label='Phone'
            error={!!errors.client_phone}
            helperText={errors.client_phone?.message}
            fullWidth
            sx={{ borderRadius: '5px' }}
            size='small'
            type='text'
            variant='outlined'
          />
        )}>
        </Controller>
      </Grid>
      <Grid size={6}>
        <Controller name="client_email" control={control} disabled render={({ field }) => (
          <TextField
            {...field}
            label='Email'
            error={!!errors.client_email}
            helperText={errors.client_email?.message}
            fullWidth
            sx={{ borderRadius: '5px' }}
            size='small'
            type='text'
            variant='outlined'
          />
        )}>
        </Controller>
      </Grid>
      <Grid size={6}>
        <Controller name="start_time" control={control} render={({ field }) => (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
            <DateTimePicker
              {...field}
              label='Date & Time'
              value={field.value}
              onChange={(date) => field.onChange(date)}
              format='dd/MM/yyyy HH:mm'
              ampm={false}
              slotProps={{
                textField: { error: !!errors.start_time, helperText: errors.start_time?.message, size: 'small', sx: { borderRadius: '5px', width: '100%' } }
              }}
            />
          </LocalizationProvider>
        )}>
        </Controller>
      </Grid>
      <Grid size={6}>
        <Controller
          name="service_name"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" error={!!errors.service_name}>
              <InputLabel id="service_name">Massage</InputLabel>
              <Select
                labelId="service_name"
                {...field}
                label="Massage"
              >
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
        <Controller name="duration" control={control} render={({ field }) => (
          <FormControl size='small' fullWidth>
            <Autocomplete
              freeSolo // <-- allows free text typing
              options={BOOKING_DEFAULT_DURATIONS} // your list of available options
              value={field.value ?? null}
              onChange={(_, newValue) => field.onChange(Number(newValue) ?? null)}
              onInputChange={(_, newInputValue) => {
                const num = parseInt(newInputValue, 10);
                field.onChange(isNaN(num) ? '' : num);
              }}
              getOptionLabel={(option) => String(option) || ''}
              isOptionEqualToValue={(option, value) => option === value}
              renderInput={(params) => (
                <TextField {...params} error={!!errors.duration} helperText={errors.duration?.message} value={Number(field.value)} label="Duration" size='small' sx={{ borderRadius: '5px', width: '100%' }} />
              )}
            />
          </FormControl>
        )} />
      </Grid>
      <Grid size={6}>
        <Controller name="price" control={control} render={({ field }) => (
          <FormControl size='small' fullWidth>
            <Autocomplete
              freeSolo // <-- allows free text typing
              options={BOOKING_DEFAULT_PRICES} // your list of available options
              value={field.value ?? null}
              onChange={(_, newValue) => field.onChange(Number(newValue) ?? null)}
              onInputChange={(_, newInputValue) => {
                const num = parseInt(newInputValue, 10);
                field.onChange(isNaN(num) ? '' : num);
              }}
              getOptionLabel={(option) => String(option) || ''}
              isOptionEqualToValue={(option, value) => option === value}
              renderInput={(params) => (
                <TextField
                  {...params}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                  label="Price"
                  size='small'
                  sx={{ borderRadius: '5px', width: '100%' }} />
              )}
            />
          </FormControl>
        )} />
      </Grid>
      <Grid size={6}>
        <Controller name="notes" control={control} render={({ field }) => (
          <TextField
            {...field}
            label='Notes'
            error={!!errors.notes}
            helperText={errors.notes?.message}
            fullWidth
            sx={{ borderRadius: '5px' }}
            size='small'
            type='text'
            variant='outlined'
          />
        )}>
        </Controller>
      </Grid>
      <Grid size={6}>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth size="small" error={!!errors.status}>
              <InputLabel id="status">Status</InputLabel>
              <Select
                labelId="status"
                {...field}
                label="Status"
              >
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
      <Grid size={4}>
        <Controller
          name="paidCash"
          control={control}
          disabled
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? 0}
              label="Paid in Cash"
              fullWidth
              size="small"
              variant="outlined"
              error={!!errors.paidCash}
              helperText={errors.paidCash?.message}
            />
          )}
        />
      </Grid>
      <Grid size={1} >
        <Tooltip title="Pay All with Cash"><Button fullWidth disabled={typeof paidCash === 'number' && paidCash > 0}><EuroIcon /></Button></Tooltip>
      </Grid>
      <Grid size={2}>
        <Tooltip title="Custom Payment"><Button fullWidth onClick={() => setIsPaymentDialogOpen(true)}>Pay</Button></Tooltip>
      </Grid>
      <Grid size={1}>
        <Tooltip title="Pay All with Credit Card"><Button fullWidth disabled={typeof paidCard === 'number' && paidCard > 0}><CreditCardIcon /></Button></Tooltip>
      </Grid>
      <Grid size={4}>
        <Controller name="paidCard"
          control={control}
          disabled
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? 0}
              label='Paid in Card'
              fullWidth
              size='small'
              variant='outlined'
              error={!!errors.paidCard}
              helperText={errors.paidCard?.message}
            />
          )}>
        </Controller>
      </Grid>
      {(errors as any).form?.message && (
        <Container sx={{ marginBottom: 2 }} >
          <Alert severity="error" variant="standard">
            {(errors as any).form.message}
          </Alert>
        </Container>
      )}
    </Grid>

  )
}

export default FormFields