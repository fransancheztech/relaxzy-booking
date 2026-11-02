"use client";

import { useClientSearch, FocusedClientField } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import { VoucherSchemaInput } from "@/schemas/voucher.schema";
import { Box, Divider, Grid, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import ClientResolutionHint from "@/components/ClientResolutionHint";
import { useClientPreview } from "@/hooks/useClientPreview";
import ClientNotesAlert, { previewNotes } from "@/components/ClientNotesAlert";
import ClientDropdown from "@/app/bookings/ClientDropdown";

type Prefix = "buyer" | "recipient";

type NameField    = "buyer_name"    | "recipient_name";
type SurnameField = "buyer_surname" | "recipient_surname";
type PhoneField   = "buyer_phone"   | "recipient_phone";
type EmailField   = "buyer_email"   | "recipient_email";
type PickedField  = "buyer_picked_id" | "recipient_picked_id";

type FocusedKind = "name" | "surname" | "phone" | "email" | null;

const API_FIELD: Record<Exclude<FocusedKind, null>, Exclude<FocusedClientField, null>> = {
  name: "client_name",
  surname: "client_surname",
  phone: "client_phone",
  email: "client_email",
};

type Props = {
  prefix: Prefix;
  label: string;
  autoFocus?: boolean;
};

const VoucherClientSection = ({ prefix, label, autoFocus }: Props) => {
  const tCommon = useTranslations("Common");
  const { control, setValue, formState: { errors } } = useFormContext<VoucherSchemaInput>();

  const nameField    = `${prefix}_name`    as NameField;
  const surnameField = `${prefix}_surname` as SurnameField;
  const phoneField   = `${prefix}_phone`   as PhoneField;
  const emailField   = `${prefix}_email`   as EmailField;
  const pickedField  = `${prefix}_picked_id` as PickedField;

  const [nameVal, surnameVal, phoneVal, emailVal, pickedId] = useWatch({
    control,
    name: [nameField, surnameField, phoneField, emailField, pickedField],
  });

  const preview = useClientPreview({
    name: nameVal,
    surname: surnameVal,
    phone: phoneVal,
    email: emailVal,
    pickedId,
  });

  const [focusedKind, setFocusedKind] = useState<FocusedKind>(null);

  const { clients, clear } = useClientSearch({
    focusedField: focusedKind ? API_FIELD[focusedKind] : null,
    name: nameVal,
    surname: surnameVal,
    email: emailVal,
    phone: phoneVal,
  });

  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = (kind: Exclude<FocusedKind, null>) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedKind(kind);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setFocusedKind(null), 150);
  };

  const handleSelect = (c: ClientRow) => {
    setValue(pickedField,  c.id);
    setValue(nameField,    c.client_name    ?? "");
    setValue(surnameField, c.client_surname ?? "");
    setValue(phoneField,   c.client_phone   ?? "");
    setValue(emailField,   c.client_email   ?? "");
    clear();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedKind(null);
  };

  const show = (kind: Exclude<FocusedKind, null>) => focusedKind === kind && clients.length > 0;

  return (
    <>
      <Grid size={12}>
        <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
        <Divider />
      </Grid>

      <Grid size={6}>
        <Box sx={{ position: "relative" }}>
          <Controller
            name={nameField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={tCommon("name")}
                required={prefix === "buyer"}
                error={!!errors[nameField]}
                helperText={errors[nameField]?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
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
            name={surnameField}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={tCommon("surname")}
                error={!!errors[surnameField]}
                helperText={errors[surnameField]?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
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
                label={tCommon("phone")}
                error={!!errors[phoneField]}
                helperText={errors[phoneField]?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
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
                label={tCommon("email")}
                error={!!errors[emailField]}
                helperText={errors[emailField]?.message}
                fullWidth
                sx={{ borderRadius: "5px" }}
                size="small"
                type="text"
                variant="outlined"
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

      {/* Always rendered (fixed height) so its text changing never moves the form. */}
      <Grid size={12}>
        <ClientResolutionHint preview={preview} />
      </Grid>
      {previewNotes(preview) && (
        <Grid size={12}>
          <ClientNotesAlert notes={previewNotes(preview)} />
        </Grid>
      )}
    </>
  );
};

export default VoucherClientSection;
