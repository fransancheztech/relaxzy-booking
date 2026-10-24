"use client";

import { Box, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslations } from "next-intl";
import type { ClientPreview } from "@/types/clientConflict";
import { formatPhone } from "@/utils/phone";

const fullName = (p: { name: string | null; surname: string | null }) =>
  [p.name, p.surname].filter(Boolean).join(" ").trim() || "—";

/** Fixed height for two caption lines: the box never grows or shrinks, so nothing below it moves. */
const HINT_HEIGHT = 44;

/**
 * A fixed-size line under the client fields saying what Save will do with them, so picking a
 * client, retyping one, or adding a phone never has a surprising result:
 *   grey   — nothing typed yet (placeholder that keeps the space)
 *   green  — an existing client will be used (and which empty fields get filled in)
 *   blue   — a new client will be created
 *   amber  — saving will ask a question first
 * It is always rendered and always the same height; only its colour and text change, so it never
 * pushes the rest of the form around. Text that doesn't fit is cut with "…" and shown in full
 * on hover.
 */
const ClientResolutionHint = ({ preview }: { preview: ClientPreview | null }) => {
  const t = useTranslations("ClientHint");

  let color: "success" | "info" | "warning" | null = null;
  let Icon = PersonOutlineIcon;
  let main: string;
  let detail: string | null = null;

  switch (preview?.kind ?? "none") {
    case "existing": {
      const p = preview as Extract<ClientPreview, { kind: "existing" }>;
      color = "success";
      main = t("existing", { name: fullName(p.client), count: p.client.bookings });
      const items = [
        p.fill.phone && t("fillPhone", { value: formatPhone(p.fill.phone) }),
        p.fill.email && t("fillEmail", { value: p.fill.email }),
        p.fill.surname && t("fillSurname", { value: p.fill.surname }),
      ].filter(Boolean);
      if (items.length) detail = t("fill", { items: items.join(", ") });
      break;
    }
    case "new":
      color = "info";
      Icon = PersonAddAltIcon;
      main = t("new");
      break;
    case "contact_conflict": {
      const p = preview as Extract<ClientPreview, { kind: "contact_conflict" }>;
      color = "warning";
      Icon = HelpOutlineIcon;
      main = t(p.matchedBy === "email" ? "contactConflictEmail" : "contactConflictPhone", {
        name: fullName(p.existing),
      });
      detail = t("willAsk");
      break;
    }
    case "contactless_conflict": {
      const p = preview as Extract<ClientPreview, { kind: "contactless_conflict" }>;
      color = "warning";
      Icon = HelpOutlineIcon;
      main = t("contactlessConflict", { name: fullName(p.candidates[0]), count: p.candidates.length });
      detail = t("willAskSamePerson");
      break;
    }
    default:
      main = t("idle");
  }

  const tone = color ? `${color}.main` : "divider";
  const fullText = detail ? `${main} ${detail}` : main;

  return (
    <Tooltip title={color ? fullText : ""} placement="bottom-start" enterDelay={400}>
      <Box
        aria-live="polite"
        sx={{
          height: HINT_HEIGHT,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: tone,
          bgcolor: (theme) => (color ? alpha(theme.palette[color].main, 0.08) : "transparent"),
          transition: "border-color 150ms, background-color 150ms",
          overflow: "hidden",
        }}
      >
        <Icon sx={{ fontSize: 18, flexShrink: 0, color: color ? `${color}.main` : "text.disabled" }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            component="div"
            noWrap
            sx={{ fontWeight: color ? 600 : 400, lineHeight: 1.4, color: color ? "text.primary" : "text.disabled" }}
          >
            {main}
          </Typography>
          {detail && (
            <Typography variant="caption" component="div" color="text.secondary" noWrap sx={{ lineHeight: 1.4 }}>
              {detail}
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
};

export default ClientResolutionHint;
