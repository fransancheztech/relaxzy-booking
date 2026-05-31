"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ClientConflict,
  ClientConflictParty,
  ClientResolution,
} from "@/types/clientConflict";

type Props = {
  open: boolean;
  conflicts: ClientConflict[];
  submitting?: boolean;
  onCancel: () => void;
  onResolve: (resolutions: Record<string, ClientResolution>) => void;
};

const fullName = (p: ClientConflictParty) =>
  [p.name, p.surname].filter(Boolean).join(" ").trim() || "—";

const ClientConflictDialog = ({ open, conflicts, submitting, onCancel, onResolve }: Props) => {
  const t = useTranslations("BookingForm");

  // Default every conflict to the safe "use existing" choice.
  const [choices, setChoices] = useState<Record<string, ClientResolution>>({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, ClientResolution> = {};
    for (const c of conflicts) initial[c.slot] = "use_existing";
    setChoices(initial);
  }, [open, conflicts]);

  const slotLabel = (slot: string) => {
    if (slot === "primary") return t("conflictPrimaryLabel");
    const idx = Number(slot.split("-")[1] ?? 0);
    return t("conflictCompanionLabel", { n: idx + 1 });
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("conflictTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t("conflictIntro")}</DialogContentText>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {conflicts.map((c, i) => {
            const matchValue = c.matchedBy === "email" ? c.existing.email : c.existing.phone;
            return (
              <Box key={c.slot}>
                {i > 0 && <Divider sx={{ mb: 2 }} />}
                {conflicts.length > 1 && (
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    {slotLabel(c.slot)}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  {c.matchedBy === "email"
                    ? t("conflictMatchedEmail", { value: matchValue ?? "", name: fullName(c.existing) })
                    : t("conflictMatchedPhone", { value: matchValue ?? "", name: fullName(c.existing) })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t("conflictTyped", { name: fullName(c.typed) })}
                </Typography>

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={choices[c.slot] ?? "use_existing"}
                  onChange={(_, v: ClientResolution | null) => {
                    if (v) setChoices((prev) => ({ ...prev, [c.slot]: v }));
                  }}
                >
                  <ToggleButton value="use_existing">
                    {t("conflictUseExisting", { name: fullName(c.existing) })}
                  </ToggleButton>
                  <ToggleButton value="update_existing" color="warning">
                    {t("conflictModify", { name: fullName(c.typed) })}
                  </ToggleButton>
                </ToggleButtonGroup>

                {choices[c.slot] === "update_existing" && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                    {t("conflictModifyWarning")}
                  </Alert>
                )}
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>
          {t("conflictCancel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={submitting}
          onClick={() => onResolve(choices)}
        >
          {t("conflictConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientConflictDialog;
