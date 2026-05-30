"use client";

import { useTranslations } from "next-intl";
import { Box, Grid, TextField } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { BookingSchemaType } from "@/schemas/booking.schema";
import { useClientSearch, FocusedClientField } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import ClientDropdown from "./ClientDropdown";

type FocusedField = "name" | "surname" | "phone" | "email" | null;

const API_FIELD: Record<Exclude<FocusedField, null>, Exclude<FocusedClientField, null>> = {
  name: "client_name",
  surname: "client_surname",
  phone: "client_phone",
  email: "client_email",
};

type Props = {
  index: number;
};

const CompanionClientFields = ({ index }: Props) => {
  const t = useTranslations("Common");
  const { control, setValue, formState: { errors } } = useFormContext<BookingSchemaType>();

  const nameField = `companions.${index}.client_name` as const;
  const surnameField = `companions.${index}.client_surname` as const;
  const phoneField = `companions.${index}.client_phone` as const;
  const emailField = `companions.${index}.client_email` as const;

  const [nameVal, surnameVal, phoneVal, emailVal] = useWatch({
    control,
    name: [nameField, surnameField, phoneField, emailField],
  });

  const [focusedField, setFocusedField] = useState<FocusedField>(null);

  const { clients, clear } = useClientSearch({
    focusedField: focusedField ? API_FIELD[focusedField] : null,
    name: nameVal,
    surname: surnameVal,
    email: emailVal,
    phone: phoneVal,
  });

  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = (field: FocusedField) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedField(field);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setFocusedField(null), 150);
  };

  const handleSelect = (c: ClientRow) => {
    setValue(nameField, c.client_name ?? "");
    setValue(surnameField, c.client_surname ?? "");
    setValue(phoneField, c.client_phone ?? "");
    setValue(emailField, c.client_email ?? "");
    clear();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedField(null);
  };

  const show = (field: FocusedField) => focusedField === field && clients.length > 0;
  const companionErrors = errors.companions?.[index];

  return (
    <Grid container spacing={1} sx={{ mt: 0.5 }}>
      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name={nameField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                label={t("name")}
                required
                error={!!companionErrors?.client_name}
                helperText={companionErrors?.client_name?.message}
                fullWidth
                size="small"
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
            name={surnameField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                label={t("surname")}
                error={!!companionErrors?.client_surname}
                helperText={companionErrors?.client_surname?.message}
                fullWidth
                size="small"
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
      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name={phoneField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                label={t("phone")}
                error={!!companionErrors?.client_phone}
                helperText={companionErrors?.client_phone?.message}
                fullWidth
                size="small"
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
            name={emailField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ""}
                label={t("email")}
                error={!!companionErrors?.client_email}
                helperText={companionErrors?.client_email?.message}
                fullWidth
                size="small"
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
    </Grid>
  );
};

export default CompanionClientFields;
