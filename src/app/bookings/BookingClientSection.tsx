"use client";

import { useTranslations } from "next-intl";
import { useClientSearch } from "@/hooks/useClientSearch";
import { ClientRow } from "@/hooks/useSimilarClients";
import { BookingSchemaType } from "@/schemas/booking.schema";
import { Avatar, Box, Chip, Grid, Paper, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

type Props = {
  autoFocus?: boolean;
  readOnly?: boolean;
};

type FocusedField = "name" | "surname" | "phone" | "email" | null;

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
        overflow: "hidden",
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
                {[c.client_email, c.client_phone].filter(Boolean).join(" · ")}
              </Typography>
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

const BookingClientSection = ({ autoFocus, readOnly }: Props) => {
  const t = useTranslations("Common");
  const { control, setValue, formState: { errors } } = useFormContext<BookingSchemaType>();

  const [nameVal, surnameVal, phoneVal, emailVal] = useWatch({
    control,
    name: ["client_name", "client_surname", "client_phone", "client_email"],
  });

  const { clients, clear } = useClientSearch({
    name: nameVal,
    surname: surnameVal,
    email: emailVal,
    phone: phoneVal,
  });

  const [focusedField, setFocusedField] = useState<FocusedField>(null);
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
    clear();
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocusedField(null);
  };

  const show = (field: FocusedField) => focusedField === field && clients.length > 0;

  return (
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
    </>
  );
};

export default BookingClientSection;
