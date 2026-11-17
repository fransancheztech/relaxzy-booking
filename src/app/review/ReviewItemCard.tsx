"use client";

import { Box, Button, Chip, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPhone } from "@/utils/phone";
import { formatBusinessDate } from "@/utils/businessTime";
import type {
  ClientSnapshot,
  InactiveDetails,
  MissingAccentDetails,
  NameProposal,
  ReviewAction,
  ReviewItem,
} from "@/lib/review/types";

export type DecidePayload = { client_name?: string; client_surname?: string; values?: unknown; note?: string };

type Props = {
  item: ReviewItem;
  busy: boolean;
  onDecide: (action: ReviewAction, payload: DecidePayload) => void;
};

export const clientFullName = (c: { client_name?: string | null; client_surname?: string | null }) =>
  [c.client_name, c.client_surname].filter((v) => v && v.trim()).join(" ") || "—";

/** 0 = Spanish phone, 1 = no phone, 2 = foreign phone. Spanish clients come first in the accent check. */
export const phoneRank = (phone: string | null) => (!phone ? 1 : phone.startsWith("+34") ? 0 : 2);

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, wordBreak: "break-word" }}>{value}</Typography>
    </Box>
  );
}

const ReviewItemCard = ({ item, busy, onDecide }: Props) => {
  const t = useTranslations("Review");
  const details = item.details as ClientSnapshot;
  const proposal = item.proposal as NameProposal | null;
  const isNameCheck = item.kind === "client_missing_accent" || item.kind === "client_surname_in_name";

  const [name, setName] = useState(proposal?.client_name ?? details.client_name ?? "");
  const [surname, setSurname] = useState(proposal?.client_surname ?? details.client_surname ?? "");
  const [note, setNote] = useState(item.note ?? "");

  const changed = (name.trim() !== (details.client_name ?? "").trim())
    || (surname.trim() !== (details.client_surname ?? "").trim());
  const empty = (v: string | null) => (v && v.trim() ? v : t("emptyValue"));
  const phoneChip =
    phoneRank(details.client_phone) === 0 ? t("phoneSpanish")
      : phoneRank(details.client_phone) === 1 ? t("phoneNone")
        : t("phoneForeign");

  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 1 }}>{clientFullName(details)}</Typography>
        {item.kind === "client_missing_accent" && <Chip size="small" label={phoneChip} variant="outlined" />}
        {item.status === "deferred" && <Chip size="small" color="warning" label={t("deferredChip")} />}
      </Box>

      <Stack spacing={0.5}>
        <Field label={t("phone")} value={details.client_phone ? formatPhone(details.client_phone) : "—"} />
        <Field label={t("email")} value={details.client_email || "—"} />
        {item.kind === "client_inactive" && <InactiveFields details={item.details as InactiveDetails} />}
      </Stack>

      {item.kind === "client_missing_accent" && (
        <Stack spacing={0.25}>
          {(item.details as MissingAccentDetails).words.map((w, i) => (
            <Typography key={i} variant="body2">
              <strong>{w.from} → {w.to}</strong>{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                {w.source === "spanish" ? t("wordSpanish", { count: w.seen }) : t("wordClients", { count: w.seen })}
              </Typography>
            </Typography>
          ))}
        </Stack>
      )}

      {isNameCheck && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t("currentValue", { name: empty(details.client_name), surname: empty(details.client_surname) })}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mt: 1 }}>
            <TextField size="small" label={t("name")} value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1 }} />
            <Tooltip title={t("swap")}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t("swap")}
                  onClick={() => { setName(surname); setSurname(name); }}
                >
                  <SwapHorizIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <TextField size="small" label={t("surname")} value={surname} onChange={(e) => setSurname(e.target.value)} sx={{ flex: 1 }} />
          </Stack>
        </Box>
      )}

      <TextField
        size="small"
        multiline
        minRows={1}
        label={item.kind === "client_inactive" ? t("reasonNote") : t("note")}
        helperText={item.kind === "client_inactive" ? t("reasonHelp") : undefined}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {isNameCheck ? (
          <Button
            variant="contained"
            disabled={busy || !changed || !name.trim()}
            onClick={() => onDecide("apply", { client_name: name, client_surname: surname, note })}
          >
            {t("apply")}
          </Button>
        ) : (
          <Button variant="contained" color="error" disabled={busy} onClick={() => onDecide("apply", { note })}>
            {t("retire")}
          </Button>
        )}
        <Button variant="outlined" disabled={busy} onClick={() => onDecide("keep", { note })}>
          {isNameCheck ? t("keep") : t("keepClient")}
        </Button>
        {item.status !== "deferred" && (
          <Button disabled={busy} onClick={() => onDecide("later", { note })}>{t("later")}</Button>
        )}
      </Stack>
    </Paper>
  );
};

function InactiveFields({ details }: { details: InactiveDetails }) {
  const t = useTranslations("Review");
  return (
    <>
      <Field label={t("clientSince")} value={formatBusinessDate(details.created_at)} />
      <Field label={t("clientNotes")} value={details.client_notes || "—"} />
      <Field
        label={t("deletedBookings")}
        value={details.deleted_bookings
          ? `${details.deleted_bookings} (${t("lastDeleted", { date: formatBusinessDate(details.last_deleted_booking) })})`
          : "0"}
      />
      <Field label={t("movedBookings")} value={details.moved_bookings} />
      <Field label={t("deletedVouchers")} value={details.deleted_vouchers} />
    </>
  );
}

export default ReviewItemCard;
