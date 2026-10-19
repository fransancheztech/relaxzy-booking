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
import { formatPhone } from "@/utils/phone";
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

// "different" is not a resolution the server knows: a phone or email belongs to exactly one client
// (unique index), so a different person can't be saved with it at all. Choosing it explains what to
// do instead and keeps Continue disabled — so neither wrong outcome happens: booking the visit under
// the other person ("use existing"), or renaming them ("update existing").
type Choice = ClientResolution | "different";

const ClientConflictDialog = ({ open, conflicts, submitting, onCancel, onResolve }: Props) => {
  const t = useTranslations("BookingForm");

  // No pre-selected choice. "Use existing" used to be the default, which meant pressing Continue
  // without reading booked the visit under the OTHER person (Ruth's visit on Adam's record) — the
  // likely outcome at a busy desk once a phone shared by two people belongs to only one of them.
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  useEffect(() => {
    if (open) setChoices({});
  }, [open, conflicts]);

  const allChosen = conflicts.every((c) => choices[c.slot] !== undefined);
  const anyDifferent = conflicts.some((c) => choices[c.slot] === "different");

  const slotLabel = (slot: string) => {
    if (slot === "primary") return t("conflictPrimaryLabel");
    if (slot === "buyer") return t("conflictBuyerLabel");
    if (slot === "recipient") return t("conflictRecipientLabel");
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
            const matchValue = c.matchedBy === "email" ? c.existing.email : formatPhone(c.existing.phone);
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
                  value={choices[c.slot] ?? null}
                  onChange={(_, v: Choice | null) => {
                    if (v) setChoices((prev) => ({ ...prev, [c.slot]: v }));
                  }}
                  sx={{ flexWrap: "wrap" }}
                >
                  <ToggleButton value="use_existing">
                    {t("conflictUseExisting", { name: fullName(c.existing) })}
                  </ToggleButton>
                  <ToggleButton value="update_existing" color="warning">
                    {t("conflictModify", { name: fullName(c.typed) })}
                  </ToggleButton>
                  <ToggleButton value="different" color="info">
                    {t("conflictDifferentPerson", { name: fullName(c.typed) })}
                  </ToggleButton>
                </ToggleButtonGroup>

                {choices[c.slot] === "update_existing" && (
                  <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                    {t("conflictModifyWarning", { name: fullName(c.existing) })}
                  </Alert>
                )}
                {choices[c.slot] === "different" && (
                  <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                    {t(c.matchedBy === "email" ? "conflictDifferentPersonHelpEmail" : "conflictDifferentPersonHelp", {
                      existing: fullName(c.existing),
                      typed: fullName(c.typed),
                    })}
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
        {!allChosen && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 1 }}>
            {t("conflictChooseAll")}
          </Typography>
        )}
        <Button
          variant="contained"
          color="primary"
          disabled={submitting || !allChosen || anyDifferent}
          onClick={() => onResolve(choices as Record<string, ClientResolution>)}
        >
          {t("conflictConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientConflictDialog;
