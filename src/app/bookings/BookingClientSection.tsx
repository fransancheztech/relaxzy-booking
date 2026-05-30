"use client";

import { useTranslations } from "next-intl";
import { useClientSearch, FocusedClientField } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import { BookingSchemaType } from "@/schemas/booking.schema";
import { Alert, Box, FormControlLabel, Grid, Switch, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import ClientDropdown from "./ClientDropdown";

type Props = {
  autoFocus?: boolean;
  readOnly?: boolean;
  enableWalkIn?: boolean;
  clientNotes?: string | null;
  onClientPicked?: (c: ClientRow) => void;
};

type FocusedField = "name" | "surname" | "phone" | "email" | null;

const API_FIELD: Record<Exclude<FocusedField, null>, Exclude<FocusedClientField, null>> = {
  name: "client_name",
  surname: "client_surname",
  phone: "client_phone",
  email: "client_email",
};

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + "…";
}

const BookingClientSection = ({ autoFocus, readOnly, enableWalkIn, clientNotes, onClientPicked }: Props) => {
  const t = useTranslations("Common");
  const tForm = useTranslations("BookingForm");
  const { control, setValue, formState: { errors } } = useFormContext<BookingSchemaType>();

  const [nameVal, surnameVal, phoneVal, emailVal] = useWatch({
    control,
    name: ["client_name", "client_surname", "client_phone", "client_email"],
  });

  const [focusedField, setFocusedField] = useState<FocusedField>(null);

  const { clients, clear } = useClientSearch({
    focusedField: focusedField ? API_FIELD[focusedField] : null,
    name: nameVal,
    surname: surnameVal,
    email: emailVal,
    phone: phoneVal,
  });

  const [walkIn, setWalkIn] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = (field: FocusedField) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedField(field);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setFocusedField(null), 150);
  };

  const handleSelect = (c: ClientRow) => {
    setValue("client_name",    c.client_name    ?? "");
    setValue("client_surname", c.client_surname ?? "");
    setValue("client_phone",   c.client_phone   ?? "");
    setValue("client_email",   c.client_email   ?? "");
    onClientPicked?.(c);
    clear();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedField(null);
  };

  const handleWalkInToggle = (checked: boolean) => {
    setWalkIn(checked);
    if (checked) {
      // a walk-in has no client details — clear anything already typed
      setValue("client_name", "");
      setValue("client_surname", "");
      setValue("client_phone", "");
      setValue("client_email", "");
      setFocusedField(null);
    }
  };

  const show = (field: FocusedField) => focusedField === field && clients.length > 0;

  return (
    <>
      {enableWalkIn && (
        <Grid size={12}>
          <Box
            sx={{
              borderRadius: 1,
              p: walkIn ? 1.5 : 0,
              border: "1px solid",
              borderColor: walkIn ? "warning.main" : "transparent",
              transition: "padding 0.15s, border-color 0.15s",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={walkIn}
                  color="warning"
                  onChange={(e) => handleWalkInToggle(e.target.checked)}
                />
              }
              label={tForm("walkInToggle")}
              sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.75rem", color: "text.secondary" } }}
            />
            {!walkIn && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", ml: 4.5, mt: -0.5, fontStyle: "italic", fontSize: "0.7rem" }}
              >
                {tForm("walkInHint")}
              </Typography>
            )}
            {walkIn && (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                {tForm("walkInWarning")}
              </Alert>
            )}
          </Box>
        </Grid>
      )}

      {!walkIn && (
        <>
      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name="client_name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("name")}
                required
                error={!!errors.client_name}
                helperText={errors.client_name?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
                disabled={readOnly}
                autoFocus={autoFocus}
                onFocus={() => handleFocus("name")}
                onBlur={() => { field.onBlur(); handleBlur(); }}
              />
            )}
          />
          {show("name") && (
            <ClientDropdown clients={clients} onSelect={handleSelect} query={nameVal} />
          )}
        </Box>
      </Grid>

      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name="client_surname"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("surname")}
                error={!!errors.client_surname}
                helperText={errors.client_surname?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
                disabled={readOnly}
                onFocus={() => handleFocus("surname")}
                onBlur={() => { field.onBlur(); handleBlur(); }}
              />
            )}
          />
          {show("surname") && (
            <ClientDropdown clients={clients} onSelect={handleSelect} query={surnameVal} />
          )}
        </Box>
      </Grid>

      <Grid size={12} sx={{ pb: 0, mb: -1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {t("phoneOrEmailRequired")}
        </Typography>
      </Grid>

      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name="client_phone"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("phone")}
                error={!!errors.client_phone}
                helperText={errors.client_phone?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
                disabled={readOnly}
                onFocus={() => handleFocus("phone")}
                onBlur={() => { field.onBlur(); handleBlur(); }}
              />
            )}
          />
          {show("phone") && (
            <ClientDropdown clients={clients} onSelect={handleSelect} query={phoneVal} />
          )}
        </Box>
      </Grid>

      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name="client_email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("email")}
                error={!!errors.client_email}
                helperText={errors.client_email?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
                disabled={readOnly}
                onFocus={() => handleFocus("email")}
                onBlur={() => { field.onBlur(); handleBlur(); }}
              />
            )}
          />
          {show("email") && (
            <ClientDropdown clients={clients} onSelect={handleSelect} query={emailVal} />
          )}
        </Box>
      </Grid>
      {clientNotes?.trim() && (
        <Grid size={12}>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
            <strong>{t("clientNotes")}:</strong> {truncate(clientNotes, 20)}
          </Typography>
        </Grid>
      )}
        </>
      )}
    </>
  );
};

export default BookingClientSection;
