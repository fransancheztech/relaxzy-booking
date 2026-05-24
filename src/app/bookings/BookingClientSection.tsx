"use client";

import { useTranslations } from "next-intl";
import { useClientSearch, FocusedClientField } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import { BookingSchemaType } from "@/schemas/booking.schema";
import { Alert, Avatar, Box, Chip, FormControlLabel, Grid, Paper, Switch, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

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

const AVATAR_COLORS = ["#4CAF50", "#2196F3", "#9C27B0", "#FF9800", "#00BCD4", "#E91E63"];

function avatarColor(str: string): string {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + "…";
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
  const t = useTranslations("Common");
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
            <Avatar
              sx={{ width: 32, height: 32, fontSize: 12, bgcolor: avatarColor(ini), flexShrink: 0 }}
            >
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
              {c.client_notes?.trim() && (
                <Typography
                  component="div"
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ fontStyle: "italic", mt: 0.5 }}
                >
                  <strong>{t("clientNotes")}:</strong> {truncate(c.client_notes, 20)}
                </Typography>
              )}
            </Box>
            <Chip
              label={t("existing")}
              size="small"
              sx={{ fontSize: 10, height: 20, flexShrink: 0 }}
            />
          </Box>
        );
      })}
    </Paper>
  );
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
