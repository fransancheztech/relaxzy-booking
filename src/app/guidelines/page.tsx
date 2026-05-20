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
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { useRole } from "@/hooks/useRole";
import GuidelineDialog, { GuidelineRow } from "./GuidelineDialog";

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

  // Track which guideline is currently in view for the nav highlight
  useEffect(() => {
    if (guidelines.length < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.getAttribute("data-guideline-id"));
        }
      },
      { rootMargin: "-5% 0px -75% 0px", threshold: 0 },
    );

    guidelines.forEach((g) => {
      const el = document.getElementById(`guideline-${g.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [guidelines]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`guideline-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const navLabel = (g: Guideline) => {
    if (g.title?.trim()) return g.title.trim();
    const flat = g.content.replace(/\n/g, " ");
    return flat.length > 50 ? flat.slice(0, 50) + "…" : flat;
  };

  const handleEdit = (g: Guideline) => {
    setEditing(g);
    setDialogOpen(true);
  };

  const handleDelete = async (g: Guideline) => {
    const label = g.title?.trim() || g.content.slice(0, 60);
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        px: { xs: 2, md: 3 },
        py: 3,
        maxWidth: 1060,
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
            top: 72,
            maxHeight: "calc(100vh - 100px)",
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
              sx={{ p: 2 }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {g.title && (
                    <Typography variant="h6" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                      {g.title}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-wrap", mb: 1.5, color: "text.primary" }}
                  >
                    {g.content}
                  </Typography>
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
