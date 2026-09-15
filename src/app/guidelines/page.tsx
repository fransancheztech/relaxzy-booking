"use client";

import {
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { formatBusinessDate } from "@/utils/businessTime";
import { useRole } from "@/hooks/useRole";
import GuidelineDialog, { GuidelineRow } from "./GuidelineDialog";
import Markdown from "@/components/Markdown";
import { stripMarkdown } from "@/utils/stripMarkdown";
import { extractToc } from "@/utils/markdownToc";

interface Guideline extends GuidelineRow {
  author_id: string;
  created_at: string;
  updated_at: string;
}

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "roleAdmin",
  receptionist: "roleReceptionist",
  therapist: "roleTherapist",
};

const ROLE_CHIP_COLORS: Record<string, "primary" | "secondary" | "success"> = {
  admin: "primary",
  receptionist: "secondary",
  therapist: "success",
};

export default function GuidelinesPage() {
  const t = useTranslations("Guidelines");
  const tCommon = useTranslations("Common");
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const { isAdmin } = useRole();

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/guidelines", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuidelines(data.guidelines ?? []);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
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
      setDialogOpen(true);
    });
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [isAdmin, setButtonLabel, setOnButtonClick, t]);

  // Track which guideline is currently in view for the nav highlight.
  //
  // Deliberately NOT an IntersectionObserver. That reports only the entries whose intersection
  // CHANGED in a given callback, which made the result direction-dependent: scrolling down to a
  // guideline reported only that guideline, but scrolling up also re-reported the previous one —
  // and since a long preceding document has a large negative `top`, it sorted first and won.
  //
  // This asks a question with one answer regardless of direction: which is the LAST guideline
  // whose top has passed under the header?
  useEffect(() => {
    if (guidelines.length < 2) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const headerH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--app-bar-height"),
          10,
        ) || 64;
      // A little below the header, so a guideline counts as active once its title is readable.
      const line = headerH + 24;

      let current: string | null = guidelines[0]?.id ?? null;
      for (const g of guidelines) {
        const el = document.getElementById(`guideline-${g.id}`);
        if (el && el.getBoundingClientRect().top <= line) current = g.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;                    // coalesce to one measurement per frame
      frame = window.requestAnimationFrame(update);
    };

    update();                               // set the initial highlight
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [guidelines]);

  // The page stacks every guideline in one column, so a global TOC across seven trilingual
  // documents would be unusable. It follows the scroll-spy instead and shows only the
  // guideline currently in view.
  const activeToc = useMemo(() => {
    const active = guidelines.find((g) => g.id === activeId) ?? guidelines[0];
    return active ? extractToc(active.content) : [];
  }, [guidelines, activeId]);

  // Whether the column exists at all must NOT depend on the active guideline. Some guidelines
  // have no headings (VACATION POLICY is all bullets), so keying visibility off activeToc made
  // the 210px column unmount mid-scroll, widening the content, reflowing every card and landing
  // the scroll on the wrong guideline. Presence is fixed; only the contents vary.
  const hasAnyToc = useMemo(
    () => guidelines.some((g) => extractToc(g.content).length >= 2),
    [guidelines],
  );

  // Headings carry ids from rehype-slug; offset matches the fixed AppBar.
  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // scrollIntoView honours the element's CSS scroll-margin-top, which tracks the live
    // header height — unlike the fixed offset this replaces.
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(`guideline-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navLabel = (g: Guideline) => {
    if (g.title?.trim()) return g.title.trim();
    const flat = stripMarkdown(g.content);
    return flat.length > 50 ? flat.slice(0, 50) + "…" : flat;
  };

  const handleEdit = (g: Guideline) => {
    setEditing(g);
    setDialogOpen(true);
  };

  const handleDelete = async (g: Guideline) => {
    const label = g.title?.trim() || stripMarkdown(g.content).slice(0, 60);
    if (!window.confirm(t("confirmDelete", { label }))) return;
    try {
      const res = await fetch(`/api/guidelines/${g.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("deletedSuccess"));
      load();
    } catch {
      toast.error(t("deleteError"));
    }
  };

  const formatDate = (iso: string) => formatBusinessDate(iso);

  return (
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
      {/* Left outline nav — shown only when ≥2 guidelines exist */}
      {guidelines.length >= 2 && (
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
            sx={{
              px: 1,
              fontSize: "0.6rem",
              letterSpacing: 1.2,
              color: "text.disabled",
              lineHeight: 2,
            }}
          >
            {t("navContents")}
          </Typography>
          <Divider sx={{ mb: 0.5 }} />
          <Stack spacing={0}>
            {guidelines.map((g) => {
              const isActive = activeId === g.id;
              return (
                <Box
                  key={g.id}
                  onClick={() => scrollTo(g.id)}
                  sx={{
                    px: 1,
                    py: 0.6,
                    cursor: "pointer",
                    borderRadius: 0.75,
                    borderLeft: "2px solid",
                    borderColor: isActive ? "primary.main" : "transparent",
                    bgcolor: isActive ? "action.selected" : "transparent",
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
                    {navLabel(g)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {!loading && guidelines.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              {isAdmin ? t("emptyAdmin") : t("emptyReader")}
            </Typography>
          </Paper>
        )}

        <Stack spacing={2}>
          {guidelines.map((g) => (
            <Paper
              key={g.id}
              id={`guideline-${g.id}`}
              data-guideline-id={g.id}
              variant="outlined"
              sx={{ p: 2, scrollMarginTop: "calc(var(--app-bar-height, 64px) + 16px)" }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {g.title && (
                    <Typography variant="h6" sx={{ mb: 1, lineHeight: 1.25, fontSize: "1.5rem", fontWeight: 700 }}>
                      {g.title}
                    </Typography>
                  )}
                  <Markdown sx={{ mb: 1.5 }}>{g.content}</Markdown>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {g.target_roles.map((r) => (
                      <Chip
                        key={r}
                        size="small"
                        label={
                          ROLE_LABEL_KEYS[r]
                            ? t(ROLE_LABEL_KEYS[r] as Parameters<typeof t>[0])
                            : r
                        }
                        color={ROLE_CHIP_COLORS[r] ?? "default"}
                        variant="outlined"
                        sx={{ fontSize: "0.7rem", height: 22 }}
                      />
                    ))}
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ ml: 1 }}
                    >
                      {formatDate(g.created_at)}
                    </Typography>
                  </Box>
                </Box>
                {isAdmin && (
                  <Box sx={{ display: "flex", flexShrink: 0 }}>
                    <Tooltip title={tCommon("edit")}>
                      <IconButton size="small" onClick={() => handleEdit(g)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tCommon("delete")}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(g)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* Right-hand contents for the guideline in view */}
      {hasAnyToc && (
        <Box
          component="nav"
          sx={{
            display: { xs: "none", lg: "flex" },
            flexDirection: "column",
            width: 210,
            flexShrink: 0,
            position: "sticky",
            top: "calc(var(--app-bar-height, 64px) + 24px)",
            maxHeight: "calc(100vh - var(--app-bar-height, 64px) - 52px)",
            overflowY: "auto",
          }}
        >
          {activeToc.length >= 2 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, px: 1, mb: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}
              >
                {t("onThisPage")}
              </Typography>
              <Stack spacing={0.25}>
            {activeToc.map((h) => (
              <Box
                key={h.id}
                onClick={() => scrollToHeading(h.id)}
                sx={{
                  cursor: "pointer",
                  py: 0.4,
                  // Indent by heading level so the outline is readable at a glance.
                  pl: 1 + (h.depth - 1) * 1.1,
                  pr: 1,
                  borderRadius: 0.75,
                  borderLeft: "2px solid transparent",
                  "&:hover": { bgcolor: "action.hover", borderColor: "divider" },
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
                    color: h.depth <= 2 ? "text.primary" : "text.secondary",
                    fontWeight: h.depth <= 2 ? 500 : 400,
                  }}
                >
                  {h.text}
                </Typography>
              </Box>
            ))}
              </Stack>
            </>
          )}
        </Box>
      )}

      <GuidelineDialog
        open={dialogOpen}
        guideline={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </Box>
  );
}
