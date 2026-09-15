"use client";

import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import type { AgendaRole } from "@/schemas/agendaNote.schema";
import type { AgendaNote } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  date: string | null;               // "YYYY-MM-DD"
  notes: AgendaNote[];               // already filtered to this day by the page
  assignableRoles: AgendaRole[];
  onChanged: () => void;
  /**
   * Therapists read the agenda but never change it. The write endpoints reject them regardless —
   * this only removes affordances that would otherwise 403.
   */
  readOnly?: boolean;
};

const AgendaDayDialog = ({
  open, onClose, date, notes, assignableRoles, onChanged, readOnly = false,
}: Props) => {
  const t = useTranslations("Agenda");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [roles, setRoles] = useState<AgendaRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setContent("");
    // Default to the full audience this user may address — the common case is "everyone".
    setRoles([...assignableRoles]);
    setError(null);
  };

  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const toggleRole = (role: AgendaRole) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const save = () =>
    guard(async () => {
      if (!date) return;
      if (!content.trim()) { setError(t("contentRequired")); return; }
      if (roles.length === 0) { setError(t("audienceRequired")); return; }
      setError(null);

      const res = await fetch(editingId ? `/api/agenda/${editingId}` : "/api/agenda", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_date: date, content: content.trim(), target_roles: roles }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || t("saveError"));
        return;
      }
      toast.success(editingId ? t("updated") : t("created"));
      resetForm();
      onChanged();
    });

  const remove = (id: string) =>
    guard(async () => {
      const res = await fetch(`/api/agenda/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error(t("deleteError")); return; }
      toast.success(t("deleted"));
      if (editingId === id) resetForm();
      onChanged();
    });

  const startEdit = (n: AgendaNote) => {
    setEditingId(n.id);
    setContent(n.content);
    setRoles(n.target_roles.filter((r) => assignableRoles.includes(r)));
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("dayTitle", { date: date ?? "" })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "1rem !important" }}>
        {notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t("noNotes")}</Typography>
        ) : (
          <Stack spacing={1}>
            {notes.map((n) => (
              <Box
                key={n.id}
                sx={{
                  p: 1.5, borderRadius: 1, bgcolor: "action.hover",
                  display: "flex", alignItems: "flex-start", gap: 1,
                  outline: editingId === n.id ? "2px solid" : "none",
                  outlineColor: "primary.main",
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {n.content}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
                    {n.target_roles.map((r) => (
                      <Chip key={r} size="small" variant="outlined" label={t(`role_${r}`)}
                        sx={{ height: 18, fontSize: "0.65rem" }} />
                    ))}
                  </Box>
                </Box>
                {!readOnly && (
                  <>
                    <Tooltip title={tCommon("edit")}>
                      <IconButton size="small" onClick={() => startEdit(n)} disabled={submitting} sx={{ p: 0.25 }}>
                        <EditIcon sx={{ fontSize: "0.9rem" }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tCommon("delete")}>
                      <IconButton size="small" color="error" onClick={() => remove(n.id)} disabled={submitting} sx={{ p: 0.25 }}>
                        <DeleteOutlineIcon sx={{ fontSize: "0.9rem" }} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            ))}
          </Stack>
        )}

        {!readOnly && (
          <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {editingId ? t("editNote") : t("addNote")}
            </Typography>
            <TextField
              size="small" fullWidth multiline rows={3} required
              label={t("content")} value={content}
              onChange={(e) => { setContent(e.target.value); if (e.target.value.trim()) setError(null); }}
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {assignableRoles.map((r) => (
                <FormControlLabel
                  key={r}
                  control={<Checkbox size="small" checked={roles.includes(r)} onChange={() => toggleRole(r)} />}
                  label={<Typography variant="body2">{t(`role_${r}`)}</Typography>}
                />
              ))}
            </Box>
            {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {!readOnly && editingId && (
          <Button size="small" onClick={resetForm} disabled={submitting}>{tCommon("cancel")}</Button>
        )}
        <Button onClick={onClose} startIcon={<CloseIcon />} disabled={submitting}>{tCommon("close")}</Button>
        {!readOnly && (
          <Button
            onClick={save} color="success" disabled={submitting}
            startIcon={editingId ? <SaveIcon /> : <AddCircleIcon />}
          >
            {editingId ? tCommon("save") : t("addNote")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AgendaDayDialog;
