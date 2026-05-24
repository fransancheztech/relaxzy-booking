"use client";

import { useClientSearch, FocusedClientField } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import { VoucherSchemaInput } from "@/schemas/voucher.schema";
import { Avatar, Box, Chip, Divider, Grid, Paper, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";

type Prefix = "buyer" | "recipient";

type NameField    = "buyer_name"    | "recipient_name";
type SurnameField = "buyer_surname" | "recipient_surname";
type PhoneField   = "buyer_phone"   | "recipient_phone";
type EmailField   = "buyer_email"   | "recipient_email";

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

const AVATAR_COLORS = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#00BCD4", "#E91E63"];

function avatarColor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name?: string | null, surname?: string | null): string {
  return [name, surname]
    .filter(Boolean)
    .map((s) => s![0].toUpperCase())
    .join("")
    .slice(0, 2);
}

function HighlightedText({ text, query }: { text?: string | null; query?: string }) {
  if (!text) return null;
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="span" sx={{ color: "warning.main", fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

function ClientDropdown({
  clients,
  onSelect,
  query,
}: {
  clients: ClientRow[];
  onSelect: (c: ClientRow) => void;
  query?: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 1400,
        borderRadius: 1,
        overflowY: "auto",
        overflowX: "hidden",
        maxHeight: 240,
        mt: 0.5,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {clients.map((c, i) => {
        const ini = initials(c.client_name, c.client_surname);
        const fullName = [c.client_name, c.client_surname].filter(Boolean).join(" ");
        return (
          <Box
            key={c.id}
            onClick={() => onSelect(c)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 1.5,
              py: 1,
              cursor: "pointer",
              borderTop: i > 0 ? "1px solid" : "none",
              borderColor: "divider",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: avatarColor(ini), flexShrink: 0 }}>
              {ini}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                <HighlightedText text={fullName} query={query} />
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {[c.client_email, c.client_phone]
                  .filter(Boolean)
                  .map((text, idx, arr) => (
                    <Box component="span" key={idx}>
                      <HighlightedText text={text} query={query} />
                      {idx < arr.length - 1 && " · "}
                    </Box>
                  ))}
              </Typography>
            </Box>
            <Chip label={tCommon("existing")} size="small" sx={{ fontSize: 10, height: 20, flexShrink: 0 }} />
          </Box>
        );
      })}
    </Paper>
  );
}

const VoucherClientSection = ({ prefix, label, autoFocus }: Props) => {
  const tCommon = useTranslations("Common");
  const { control, setValue, formState: { errors } } = useFormContext<VoucherSchemaInput>();

  const nameField    = `${prefix}_name`    as NameField;
  const surnameField = `${prefix}_surname` as SurnameField;
  const phoneField   = `${prefix}_phone`   as PhoneField;
  const emailField   = `${prefix}_email`   as EmailField;

  const [nameVal, surnameVal, phoneVal, emailVal] = useWatch({
    control,
    name: [nameField, surnameField, phoneField, emailField],
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
                label={prefix === "buyer" ? tCommon("name") + " *" : tCommon("name")}
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
    </>
  );
};

export default VoucherClientSection;
