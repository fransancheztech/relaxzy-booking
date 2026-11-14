"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import HistoryIcon from "@mui/icons-material/History";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Markdown from "@/components/Markdown";
import { formatBusinessDate, formatBusinessDateTime } from "@/utils/businessTime";
import { diffLines } from "@/utils/textDiff";
import {
  GUIDELINE_LANGUAGES,
  GUIDELINE_LANGUAGE_NATIVE,
  isGuidelineLanguage,
} from "@/lib/guidelines/languages";
import {
  GUIDELINE_HISTORY_START,
  buildTimeline,
  versionLanguages,
  type CurrentVersion,
  type GuidelineLogEntry,
  type TimelineItem,
  type VersionStatus,
} from "@/lib/guidelines/versions";

type Version = Extract<TimelineItem, { type: "version" }>;

const STATUS_KEYS: Record<VersionStatus, string> = {
  created: "versionCreated",
  edited: "versionEdited",
  removed: "versionRemoved",
  baseline: "versionBaseline",
  unchanged: "versionUnchanged",
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "roleAdmin",
  receptionist: "roleReceptionist",
  therapist: "roleTherapist",
};

interface Props {
  open: boolean;
  guidelineId: string;
  /** The guideline's title, for the dialog header. */
  label: string;
  /** The language to open on: the version being read. */
  language: string;
  onClose: () => void;
}

/**
 * Admin-only: every saved version of a guideline, one language at a time. The list shows each
 * save (when, who, what kind); the right side shows that version's full text, or what that save
 * changed compared with the version before it.
 */
export default function GuidelineVersionsDialog({ open, guidelineId, label, language, onClose }: Props) {
  const t = useTranslations("Guidelines");
  const tCommon = useTranslations("Common");

  const [entries, setEntries] = useState<GuidelineLogEntry[]>([]);
  const [current, setCurrent] = useState<CurrentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState(language);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<"changes" | "text">("changes");

  // Re-read on every open: the guideline may have been edited since the last time.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setLang(language);
    setSelectedKey(null);
    setView("changes");
    fetch(`/api/guidelines/${guidelineId}/versions`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setCurrent(data.current ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, guidelineId, language]);

  const languages = useMemo(() => versionLanguages(entries, current, GUIDELINE_LANGUAGES), [entries, current]);
  const shownLang = languages.includes(lang) ? lang : languages[0] ?? lang;
  const timeline = useMemo(() => buildTimeline(entries, current, shownLang), [entries, current, shownLang]);
  const versions = timeline.filter((i): i is Version => i.type === "version");
  const selected = versions.find((v) => v.key === selectedKey) ?? versions[0] ?? null;

  const langName = (l: string) => (isGuidelineLanguage(l) ? t(`lang_${l}` as Parameters<typeof t>[0]) : l);
  const roleList = (roles: string[] | null) =>
    (roles ?? []).map((r) => (ROLE_LABEL_KEYS[r] ? t(ROLE_LABEL_KEYS[r] as Parameters<typeof t>[0]) : r)).join(", ") ||
    "—";
  const byLine = (by: string | null) => (by ? t("versionBy", { who: by }) : t("versionByUnknown"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { height: { md: "85vh" } } } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pr: 2 }}>
        <HistoryIcon fontSize="small" color="action" />
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          {t("versionsTitle", { label })}
        </Box>
        {languages.length >= 2 && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={shownLang}
            onChange={(_, v) => {
              if (!v) return;
              setLang(v);
              setSelectedKey(null);
            }}
            sx={{ "& .MuiToggleButton-root": { px: 1.25, py: 0.25, fontSize: "0.75rem", fontWeight: 600 } }}
          >
            {languages.map((l) => (
              <ToggleButton key={l} value={l} lang={l} title={isGuidelineLanguage(l) ? GUIDELINE_LANGUAGE_NATIVE[l] : l}>
                {l.toUpperCase()}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: 0 }}>
        {loading ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : failed ? (
          <Alert severity="error" sx={{ m: 2, flex: 1 }}>
            {t("versionsLoadError")}
          </Alert>
        ) : (
          <>
            {/* The list: one row per save of this language, plus the guideline's own changes. */}
            <Box
              sx={{
                width: { xs: "100%", md: 300 },
                flexShrink: 0,
                maxHeight: { xs: 240, md: "none" },
                overflowY: "auto",
                borderRight: { md: 1 },
                borderBottom: { xs: 1, md: 0 },
                borderColor: "divider",
              }}
            >
              <List dense disablePadding>
                {timeline.map((item) =>
                  item.type === "version" ? (
                    <ListItemButton
                      key={item.key}
                      selected={item.key === selected?.key}
                      onClick={() => setSelectedKey(item.key)}
                      sx={{ alignItems: "flex-start", py: 0.75 }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <span>{item.at ? formatBusinessDateTime(item.at) : "—"}</span>
                            {item.isCurrent && (
                              <Chip
                                size="small"
                                color="success"
                                variant="outlined"
                                label={t("versionCurrent")}
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                            )}
                          </Box>
                        }
                        secondary={`${t(STATUS_KEYS[item.status] as Parameters<typeof t>[0])} · ${byLine(item.by)}`}
                        slotProps={{
                          primary: { variant: "body2", fontWeight: 600 },
                          secondary: { variant: "caption", sx: { wordBreak: "break-word" } },
                        }}
                      />
                    </ListItemButton>
                  ) : (
                    <ListItem key={item.key} sx={{ py: 0.5, bgcolor: "action.hover" }}>
                      <ListItemText
                        primary={
                          item.event === "created"
                            ? t("eventCreated", { roles: roleList(item.roles_after) })
                            : item.event === "audience"
                              ? t("eventAudience", { before: roleList(item.roles_before), after: roleList(item.roles_after) })
                              : item.event === "deleted"
                                ? t("eventDeleted")
                                : t("eventRestored")
                        }
                        secondary={`${formatBusinessDateTime(item.at)} · ${byLine(item.by)}`}
                        slotProps={{
                          primary: { variant: "caption", color: "text.secondary" },
                          secondary: { variant: "caption", sx: { wordBreak: "break-word" } },
                        }}
                      />
                    </ListItem>
                  ),
                )}
              </List>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", px: 2, py: 1.5 }}>
                {t("historyStarts", { date: formatBusinessDate(GUIDELINE_HISTORY_START) })}
              </Typography>
            </Box>

            {/* The selected version. */}
            <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 2 }}>
              {selected && (
                <SelectedVersion
                  version={selected}
                  language={shownLang}
                  languageName={langName(shownLang)}
                  view={selected.status === "edited" ? view : "text"}
                  onView={setView}
                />
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{tCommon("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function SelectedVersion({
  version,
  language,
  languageName,
  view,
  onView,
}: {
  version: Version;
  language: string;
  languageName: string;
  view: "changes" | "text";
  onView: (v: "changes" | "text") => void;
}) {
  const t = useTranslations("Guidelines");
  // A removed language shows the last text it had.
  const shown = version.after ?? version.before;

  return (
    <Box>
      {version.status === "edited" && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && onView(v)}
          sx={{ mb: 2, "& .MuiToggleButton-root": { px: 1.5, py: 0.25, fontSize: "0.75rem", textTransform: "none" } }}
        >
          <ToggleButton value="changes">{t("viewChanges")}</ToggleButton>
          <ToggleButton value="text">{t("viewText")}</ToggleButton>
        </ToggleButtonGroup>
      )}

      {version.status === "removed" && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0 }}>
          {t("removedNotice", { language: languageName })}
        </Alert>
      )}
      {version.status === "baseline" && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0 }}>
          {t("baselineNotice")}
        </Alert>
      )}
      {version.status === "unchanged" && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, py: 0 }}>
          {t("unchangedNotice", { date: formatBusinessDate(GUIDELINE_HISTORY_START) })}
        </Alert>
      )}

      {view === "changes" && version.before && version.after ? (
        <Changes before={version.before} after={version.after} />
      ) : (
        shown && (
          <Box lang={language}>
            {shown.title && (
              <Typography variant="h6" sx={{ mb: 1, lineHeight: 1.25, fontSize: "1.5rem", fontWeight: 700 }}>
                {shown.title}
              </Typography>
            )}
            <Markdown>{shown.content}</Markdown>
          </Box>
        )
      )}
    </Box>
  );
}

const ROW_COLORS = {
  removed: (theme: Theme) => theme.palette.error.main,
  added: (theme: Theme) => theme.palette.success.main,
};

/** What one save changed: the title, and the text line by line with the edited words marked. */
function Changes({
  before,
  after,
}: {
  before: { title: string | null; content: string };
  after: { title: string | null; content: string };
}) {
  const t = useTranslations("Guidelines");
  const rows = useMemo(() => diffLines(before.content, after.content), [before.content, after.content]);
  const titleChanged = (before.title ?? "") !== (after.title ?? "");

  return (
    <Box>
      {titleChanged && (
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {t("titleChanged", { before: before.title || t("noTitle"), after: after.title || t("noTitle") })}
        </Typography>
      )}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("textUnchanged")}
        </Typography>
      ) : (
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: "0.78rem",
            lineHeight: 1.6,
            overflow: "hidden",
          }}
        >
          {rows.map((row, k) => {
            if (row.type === "skip") {
              return (
                <Box key={k} sx={{ px: 1.5, py: 0.25, color: "text.disabled", bgcolor: "action.hover", fontStyle: "italic" }}>
                  {t("unchangedLines", { count: row.count })}
                </Box>
              );
            }
            const tone = row.type === "same" ? null : ROW_COLORS[row.type];
            return (
              <Box key={k} sx={{ display: "flex", bgcolor: tone ? (theme) => alpha(tone(theme), 0.1) : undefined }}>
                <Box
                  component="span"
                  sx={{ width: 24, flexShrink: 0, textAlign: "center", userSelect: "none", color: tone ?? "text.disabled" }}
                >
                  {row.type === "removed" ? "−" : row.type === "added" ? "+" : ""}
                </Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", pr: 1 }}>
                  {row.parts
                    ? row.parts.map((part, p) => (
                        <Box
                          key={p}
                          component="span"
                          sx={
                            part.type === "same" || !tone
                              ? undefined
                              : { bgcolor: (theme) => alpha(tone(theme), 0.3), borderRadius: 0.5 }
                          }
                        >
                          {part.text}
                        </Box>
                      ))
                    : row.text || "\u00a0"}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
