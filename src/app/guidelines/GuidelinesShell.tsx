"use client";

import { Box, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { useRole } from "@/hooks/useRole";
import { stripMarkdown } from "@/utils/stripMarkdown";
import { pickTranslation, type GuidelineLanguage } from "@/lib/guidelines/languages";
import GuidelineDialog, { GuidelineRow } from "./GuidelineDialog";

export interface Guideline extends GuidelineRow {
  author_id: string;
  created_at: string;
  updated_at: string;
}

/** Title in `language` (or the fallback version), or the start of the text when untitled. */
export function guidelineLabel(g: Guideline, language: string, max = 50) {
  const version = pickTranslation(g.translations, language);
  if (!version) return "";
  if (version.title?.trim()) return version.title.trim();
  const flat = stripMarkdown(version.content);
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

type GuidelinesContextValue = {
  guidelines: Guideline[];
  /** False until the first fetch finishes, so a page doesn't flash "not found" while loading. */
  loaded: boolean;
  /** Opens the editor on `language`'s tab: the version being read. */
  edit: (g: Guideline, language: GuidelineLanguage) => void;
  remove: (g: Guideline) => Promise<void>;
};

const GuidelinesContext = createContext<GuidelinesContextValue | null>(null);

export function useGuidelines() {
  const ctx = useContext(GuidelinesContext);
  if (!ctx) throw new Error("useGuidelines must be used inside GuidelinesShell");
  return ctx;
}

/**
 * Everything the guideline subpages share, kept in the layout so it survives moving from one
 * guideline to the next: the list (fetched once), the left-hand links, the header's "New
 * guideline" button and the edit dialog. Each /guidelines/<id> page renders one guideline.
 *
 * The left column is plain links highlighted by the route. There is deliberately no scroll-spy:
 * the old single page measured scroll position to work out the active guideline, and that is
 * what made the page jump and the nav drift.
 */
export default function GuidelinesShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Guidelines");
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const { isAdmin } = useRole();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const currentId = params?.id ?? null;

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [editingLanguage, setEditingLanguage] = useState<GuidelineLanguage | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guidelines", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuidelines(data.guidelines ?? []);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) {
      setButtonLabel("");
      setOnButtonClick(null);
      return;
    }
    setButtonLabel(t("newGuideline"));
    setOnButtonClick(() => () => {
      setEditing(null);
      setEditingLanguage(undefined);
      setDialogOpen(true);
    });
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [isAdmin, setButtonLabel, setOnButtonClick, t]);

  const edit = useCallback((g: Guideline, language: GuidelineLanguage) => {
    setEditing(g);
    setEditingLanguage(language);
    setDialogOpen(true);
  }, []);

  const remove = useCallback(
    async (g: Guideline) => {
      const label = guidelineLabel(g, locale, 60);
      if (!window.confirm(t("confirmDelete", { label }))) return;
      try {
        const res = await fetch(`/api/guidelines/${g.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success(t("deletedSuccess"));
        // Move off the deleted page first (to its neighbour), then refresh the list, so the
        // page never renders a guideline that no longer exists.
        const i = guidelines.findIndex((x) => x.id === g.id);
        const neighbour = guidelines[i + 1] ?? guidelines[i - 1];
        if (g.id === currentId) {
          router.replace(neighbour ? `/guidelines/${neighbour.id}` : "/guidelines", { scroll: false });
        }
        load();
      } catch {
        toast.error(t("deleteError"));
      }
    },
    [guidelines, currentId, router, load, t, locale],
  );

  const value = useMemo(() => ({ guidelines, loaded, edit, remove }), [guidelines, loaded, edit, remove]);
  const showNav = guidelines.length >= 2;

  return (
    <GuidelinesContext.Provider value={value}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          px: { xs: 2, md: 3 },
          py: 3,
          maxWidth: 1320,
          mx: "auto",
          alignItems: "flex-start",
        }}
      >
        {showNav && (
          <Box
            component="nav"
            sx={{
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              width: 200,
              flexShrink: 0,
              position: "sticky",
              top: "calc(var(--app-bar-height, 64px) + 8px)",
              maxHeight: "calc(100vh - var(--app-bar-height, 64px) - 36px)",
              overflowY: "auto",
            }}
          >
            <Typography
              variant="overline"
              sx={{ px: 1, fontSize: "0.6rem", letterSpacing: 1.2, color: "text.disabled", lineHeight: 2 }}
            >
              {t("navContents")}
            </Typography>
            <Divider sx={{ mb: 0.5 }} />
            <Stack spacing={0}>
              {guidelines.map((g) => {
                const isActive = currentId === g.id;
                return (
                  <Box
                    key={g.id}
                    component={Link}
                    href={`/guidelines/${g.id}`}
                    scroll={false}
                    aria-current={isActive ? "page" : undefined}
                    sx={{
                      display: "block",
                      px: 1,
                      py: 0.6,
                      borderRadius: 0.75,
                      borderLeft: "2px solid",
                      borderColor: isActive ? "primary.main" : "transparent",
                      bgcolor: isActive ? "action.selected" : "transparent",
                      textDecoration: "none",
                      transition: "background-color 0.15s, border-color 0.15s",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.45,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? "text.primary" : "text.secondary",
                      }}
                    >
                      {guidelineLabel(g, locale)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Phones have no room for the left column: pick the guideline from a list instead. */}
          {showNav && currentId && (
            <TextField
              select
              size="small"
              fullWidth
              label={t("navContents")}
              value={guidelines.some((g) => g.id === currentId) ? currentId : ""}
              onChange={(e) => router.push(`/guidelines/${e.target.value}`, { scroll: false })}
              sx={{ display: { xs: "flex", md: "none" }, mb: 2 }}
            >
              {guidelines.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {guidelineLabel(g, locale)}
                </MenuItem>
              ))}
            </TextField>
          )}
          {children}
        </Box>
      </Box>

      <GuidelineDialog
        open={dialogOpen}
        guideline={editing}
        initialLanguage={editingLanguage}
        onClose={() => setDialogOpen(false)}
        onSaved={async (saved) => {
          setDialogOpen(false);
          // Reload before navigating, so a new guideline's page finds it in the list.
          await load();
          if (saved?.id && saved.id !== currentId) router.push(`/guidelines/${saved.id}`, { scroll: false });
        }}
      />
    </GuidelinesContext.Provider>
  );
}
