"use client";

import { TextField, Grid, Typography } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { useTranslations } from "next-intl";

// No similar-client dropdown here, deliberately. The booking and voucher forms have one
// because their client fields answer "WHICH client is this for?", so picking a match and
// prefilling is the point. Here the fields are the record's own details:
//
//   - New Client: prefilling from a match would just recreate someone who already exists,
//     so the pick has nowhere useful to go.
//   - Edit Client: the row is fixed by clientId, so picking another client would copy their
//     details onto THIS record rather than switching which one is being edited.
//
// Duplicates are caught on submit instead: the routes pre-check with assertContactFree and
// return which field clashed and who owns it, and the dialog keeps the input for correction.
// Known limit: that only covers email/phone (the unique index). The same name with a
// different phone is not a collision and will not be flagged.
const NewClientFormFields = () => {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
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
              required
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
      <Grid size={12} sx={{ pb: 0, mb: -1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {tCommon("phoneOrEmailRequired")}
        </Typography>
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
