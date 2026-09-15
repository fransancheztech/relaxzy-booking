"use client";

import { Box, Button, Chip, Tooltip, Typography } from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { nowBusiness } from "@/utils/businessTime";
import type { AgendaNote } from "@/app/agenda/types";

const DISMISS_KEY = "agenda-bar-dismissed";

/** Fixed so the layout can offset for it without measuring. Keep in sync with the styles below. */
export const AGENDA_BAR_HEIGHT = 34;

/** Today's business calendar day as "YYYY-MM-DD". */
const businessToday = () => nowBusiness().toFormat("yyyy-MM-dd");
const businessTomorrow = () => nowBusiness().plus({ days: 1 }).toFormat("yyyy-MM-dd");

/**
 * Dismissal is scoped to the business DAY, not a rolling 24 hours. Hiding the bar at 18:00 with a
 * 24h timer would keep it hidden through the whole of the next morning — exactly when the notes
 * matter most. localStorage because it is a per-device UI preference: dismissing on the reception
 * PC should not hide it on a phone. Wrapped because storage throws in some privacy modes.
 */
const readDismissed = (): string | null => {
  try { return window.localStorage.getItem(DISMISS_KEY); } catch { return null; }
};
const writeDismissed = (day: string) => {
  try { window.localStorage.setItem(DISMISS_KEY, day); } catch { /* ignore */ }
};

const AgendaBar = ({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) => {
  const t = useTranslations("Agenda");
  const router = useRouter();

  const [today, setToday] = useState(businessToday);
  const [notes, setNotes] = useState<AgendaNote[]>([]);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => { setDismissedFor(readDismissed()); }, []);

  // Survive a browser left open overnight: when the business day rolls over, today's notes change
  // and a bar dismissed yesterday must come back.
  useEffect(() => {
    const id = setInterval(() => {
      const d = businessToday();
      setToday((prev) => (prev === d ? prev : d));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agenda?from=${today}&to=${businessTomorrow()}`, { cache: "no-store" });
      if (!res.ok) { setNotes([]); return; }   // 401 on the login page
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      setNotes([]);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // Without this the bar would only appear after a full page reload: adding today's first
  // note from the Agenda page left the (hidden) bar with nothing to re-render from.
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("refreshAgendaData", refresh);
    return () => window.removeEventListener("refreshAgendaData", refresh);
  }, [load]);

  const todayNotes = notes.filter((n) => n.note_date === today);
  const tomorrowNotes = notes.filter((n) => n.note_date === businessTomorrow());

  // No notes you can see -> no bar at all, rather than empty chrome.
  const visible = (todayNotes.length > 0 || tomorrowNotes.length > 0) && dismissedFor !== today;

  useEffect(() => { onVisibilityChange?.(visible); }, [visible, onVisibilityChange]);

  if (!visible) return null;

  const hide = () => {
    writeDismissed(today);
    setDismissedFor(today);
  };

  const summary = [
    ...todayNotes.map((n) => n.content),
    ...tomorrowNotes.map((n) => `${t("tomorrowPrefix")} ${n.content}`),
  ].join("  ·  ");

  // The full text lives in a hover tooltip rather than an expanding panel. The panel crowded the
  // page underneath and opened behind the sidebar — and a tooltip is the only way therapists can
  // read a truncated note at all, since the Agenda page is closed to them.
  const fullText = (
    <Box>
      {[
        { label: t("today"), items: todayNotes },
        { label: t("tomorrow"), items: tomorrowNotes },
      ].map(({ label, items }) =>
        items.length === 0 ? null : (
          <Box key={label} sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
            {items.map((n) => (
              <Typography key={n.id} variant="caption" sx={{ display: "block", whiteSpace: "pre-wrap" }}>
                • {n.content}
              </Typography>
            ))}
          </Box>
        ),
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        height: AGENDA_BAR_HEIGHT,
        borderTop: "1px solid", borderColor: "divider",
        bgcolor: "background.paper", color: "text.primary", px: 2,
        display: "flex", alignItems: "center", gap: 1,
      }}
    >
      <Chip size="small" color="primary" variant="outlined" label={t("barLabel")}
        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />

      <Tooltip title={fullText} placement="bottom-start">
        {/* One behaviour for every role and both input methods: a tap/click opens the Agenda.
            Therapists get the same page read-only, so there is no dead end and nothing that
            depends on a long-press, which is undiscoverable on the tablets they use. */}
        <Box
          onClick={() => router.push("/agenda")}
          sx={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center",
            cursor: "pointer",
          }}
        >
          <Typography
            variant="caption"
            sx={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {summary}
          </Typography>
        </Box>
      </Tooltip>

      {/* Spells out all three surprises: it is per-device, it lasts only today, and it comes
          back on its own. Without this, "Hide" reads as permanent. */}
      <Tooltip title={t("hideBarHelp")} placement="bottom-end">
        <Button size="small" onClick={hide} startIcon={<VisibilityOffIcon sx={{ fontSize: "0.9rem" }} />}
          sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0 }}>
          {t("hideBar")}
        </Button>
      </Tooltip>
    </Box>
  );
};

export default AgendaBar;
