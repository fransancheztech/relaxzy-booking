"use client";

import {
  Box,
  Chip,
  Container,
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
    <Container sx={{ py: 3 }} maxWidth="md">
      {!loading && guidelines.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            {isAdmin ? t("emptyAdmin") : t("emptyReader")}
          </Typography>
        </Paper>
      )}

      <Stack spacing={2}>
        {guidelines.map((g) => (
          <Paper key={g.id} variant="outlined" sx={{ p: 2 }}>
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
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                  {g.target_roles.map((r) => (
                    <Chip
                      key={r}
                      size="small"
                      label={ROLE_LABEL_KEYS[r] ? t(ROLE_LABEL_KEYS[r] as Parameters<typeof t>[0]) : r}
                      color={ROLE_CHIP_COLORS[r] ?? "default"}
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", height: 22 }}
                    />
                  ))}
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
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
                    <IconButton size="small" color="error" onClick={() => handleDelete(g)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Paper>
        ))}
      </Stack>

      <GuidelineDialog
        open={dialogOpen}
        guideline={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />
    </Container>
  );
}
