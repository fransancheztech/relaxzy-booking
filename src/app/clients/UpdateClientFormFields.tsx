"use client";

import { TextField, Grid, Typography } from "@mui/material";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { ClientUpdateSchemaType } from "@/schemas/client.schema";
import { useTranslations } from "next-intl";

// Plain labelled value shown in view mode — deliberately NOT a text field, so it's obvious
// the info is read-only (no focus, no caret) rather than looking like a broken form.
const ReadOnlyField = ({ label, value }: { label: string; value?: string | null }) => (
  <>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {value?.trim() ? value : "—"}
    </Typography>
  </>
);

const UpdateClientFormFields = ({ readOnly = false }: { readOnly?: boolean }) => {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const {
    control,
    formState: { errors },
  } = useFormContext<ClientUpdateSchemaType>();

  const values = useWatch({ control });

  if (readOnly) {
    return (
      <Grid container sx={{ paddingTop: "1rem" }} spacing={2}>
        <Grid size={6}><ReadOnlyField label={t("name")} value={values.client_name} /></Grid>
        <Grid size={6}><ReadOnlyField label={t("surname")} value={values.client_surname} /></Grid>
        <Grid size={6}><ReadOnlyField label={t("email")} value={values.client_email} /></Grid>
        <Grid size={6}><ReadOnlyField label={t("phone")} value={values.client_phone} /></Grid>
        <Grid size={12}><ReadOnlyField label={t("notes")} value={values.client_notes} /></Grid>
      </Grid>
    );
  }

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

export default UpdateClientFormFields;
