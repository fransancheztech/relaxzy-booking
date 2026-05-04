"use client";

import { TextField, Grid } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { useTranslations } from "next-intl";

const NewClientFormFields = () => {
  const t = useTranslations("Clients");
  const {
    control,
    formState: { errors },
  } = useFormContext<ClientUpdateSchemaType>();

  return (
    <Grid container sx={{ paddingTop: "1rem" }} spacing={{ xs: 1, xl: 2 }}>
      <Grid size={6}>
        <Controller
          name="client_name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("name")}
              fullWidth
              size="small"
              error={!!errors.client_name}
              helperText={errors.client_name?.message}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="client_surname"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("surname")}
              fullWidth
              size="small"
              error={!!errors.client_surname}
              helperText={errors.client_surname?.message}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="client_email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("email")}
              fullWidth
              size="small"
              error={!!errors.client_email}
              helperText={errors.client_email?.message}
            />
          )}
        />
      </Grid>
      <Grid size={6}>
        <Controller
          name="client_phone"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("phone")}
              fullWidth
              size="small"
              error={!!errors.client_phone}
              helperText={errors.client_phone?.message}
            />
          )}
        />
      </Grid>
      <Grid size={12}>
        <Controller
          name="client_notes"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t("notes")}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          )}
        />
      </Grid>
    </Grid>
  );
};

export default NewClientFormFields;
