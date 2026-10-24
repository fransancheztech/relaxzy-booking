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
  FormControlLabel,
  Radio,
  RadioGroup,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatPhone } from "@/utils/phone";
import { formatBusinessDate } from "@/utils/businessTime";
import { formatMoney } from "@/utils/formatMoney";
import type {
  ClientConflict,
  ClientConflictParty,
  ClientResolution,
  ContactClientConflict,
  ContactlessCandidate,
  ContactlessClientConflict,
} from "@/types/clientConflict";

type Props = {
  open: boolean;
  conflicts: ClientConflict[];
  submitting?: boolean;
  onCancel: () => void;
  onResolve: (resolutions: Record<string, ClientResolution>) => void;
};

const fullName = (p: { name: string | null; surname: string | null }) =>
  [p.name, p.surname].filter(Boolean).join(" ").trim() || "—";

// "different" is not a resolution the server knows: a phone or email belongs to exactly one client
// (unique index), so a different person can't be saved with it at all. Choosing it explains what to
// do instead and keeps Continue disabled — so neither wrong outcome happens: booking the visit under
// the other person ("use existing"), or renaming them ("update existing").
type Choice = ClientResolution | "different";

/** A voucher the candidate received with balance left: the strongest hint it's the same person. */
const giftVoucher = (c: ContactlessCandidate) =>
  c.vouchers.find((v) => v.role === "recipient" && v.balance > 0);

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
  const onlyContactless = conflicts.every((c) => c.kind === "contactless");

  const choose = (slot: string, v: Choice) => setChoices((prev) => ({ ...prev, [slot]: v }));

  const slotLabel = (slot: string) => {
    if (slot === "primary") return t("conflictPrimaryLabel");
    if (slot === "buyer") return t("conflictBuyerLabel");
    if (slot === "recipient") return t("conflictRecipientLabel");
    const idx = Number(slot.split("-")[1] ?? 0);
    return t("conflictCompanionLabel", { n: idx + 1 });
  };

  const renderContact = (c: ContactClientConflict) => {
    const matchValue = c.matchedBy === "email" ? c.existing.email : formatPhone(c.existing.phone);
    return (
      <>
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
          onChange={(_, v: Choice | null) => { if (v) choose(c.slot, v); }}
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
      </>
    );
  };

  const candidateDetails = (cand: ContactlessCandidate) => {
    const parts = [
      t("conflictCandidateCreated", { date: formatBusinessDate(cand.created_at) }),
      t("conflictCandidateBookings", { count: cand.bookings }),
    ];
    if (cand.last_visit) parts.push(t("conflictCandidateLastVisit", { date: formatBusinessDate(cand.last_visit) }));
    return parts.join(" · ");
  };

  const renderContactless = (c: ContactlessClientConflict) => {
    const typedContact = [formatPhone(c.typed.phone), c.typed.email].filter(Boolean).join(" · ");
    const gift = c.candidates.map(giftVoucher).find(Boolean);
    return (
      <>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {t("conflictContactlessIntro", {
            typed: [fullName(c.typed), typedContact].filter((s) => s && s !== "—").join(" · "),
            count: c.candidates.length,
          })}
        </Typography>
        {gift && (
          <Alert severity="info" sx={{ mb: 1, py: 0 }}>
            {gift.otherName
              ? t("conflictContactlessGiftTip", { buyer: gift.otherName })
              : t("conflictContactlessGiftTipNoBuyer")}
          </Alert>
        )}

        <RadioGroup value={choices[c.slot] ?? ""} onChange={(e) => choose(c.slot, e.target.value as Choice)}>
          {c.candidates.map((cand) => (
            <FormControlLabel
              key={cand.id}
              value={`link:${cand.id}`}
              control={<Radio size="small" />}
              sx={{ alignItems: "flex-start", mb: 0.5, "& .MuiRadio-root": { pt: 0.25 } }}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t("conflictLinkCandidate", { name: fullName(cand) })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {candidateDetails(cand)}
                  </Typography>
                  {cand.vouchers.map((v) => (
                    <Typography key={v.code} variant="caption" color="text.secondary" component="div">
                      {v.role === "recipient"
                        ? t(v.otherName ? "conflictCandidateGiftFrom" : "conflictCandidateGift", {
                            code: v.code,
                            balance: formatMoney(v.balance),
                            name: v.otherName ?? "",
                          })
                        : t(v.otherName ? "conflictCandidateBoughtFor" : "conflictCandidateBought", {
                            code: v.code,
                            balance: formatMoney(v.balance),
                            name: v.otherName ?? "",
                          })}
                    </Typography>
                  ))}
                  <Typography variant="caption" color="success.main" component="div">
                    {typedContact
                      ? t("conflictLinkEffect", { contact: typedContact })
                      : t("conflictLinkEffectNoContact")}
                  </Typography>
                </Box>
              }
            />
          ))}
          <FormControlLabel
            value="create_new"
            control={<Radio size="small" />}
            sx={{ alignItems: "flex-start", "& .MuiRadio-root": { pt: 0.25 } }}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {t("conflictCreateNew", { count: c.candidates.length })}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {t("conflictCreateNewEffect", { name: fullName(c.typed) })}
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </>
    );
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{onlyContactless ? t("conflictContactlessTitle") : t("conflictTitle")}</DialogTitle>
      <DialogContent>
        {!onlyContactless && <DialogContentText sx={{ mb: 2 }}>{t("conflictIntro")}</DialogContentText>}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {conflicts.map((c, i) => (
            <Box key={c.slot}>
              {i > 0 && <Divider sx={{ mb: 2 }} />}
              {conflicts.length > 1 && (
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                  {slotLabel(c.slot)}
                </Typography>
              )}
              {c.kind === "contactless" ? renderContactless(c) : renderContact(c)}
            </Box>
          ))}
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
