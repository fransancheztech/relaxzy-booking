"use client";

import { Avatar, Box, Chip, Paper, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { ClientRow } from "@/hooks/useSimilarClients";

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

type Props = {
  clients: ClientRow[];
  onSelect: (c: ClientRow) => void;
  query?: string;
};

const ClientDropdown = ({ clients, onSelect, query }: Props) => {
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
};

export default ClientDropdown;
