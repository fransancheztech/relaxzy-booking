"use client";

import { Box, Button, Chip, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/utils/formatMoney";
import type {
  OnlineOrderDetails,
  OnlineOrderOutcome,
  OnlineOrderProposal,
  OnlineOrderStatus,
  ReviewAction,
  ReviewItem,
} from "@/lib/review/types";
import type { DecidePayload } from "./ReviewItemCard";
import { Field, SystemVoucherLine, ymd } from "./VoucherParts";

const OUTCOMES: OnlineOrderOutcome[] = ["ok", "missing", "fix", "test"];
const DEFAULT_OUTCOME: Record<OnlineOrderStatus, OnlineOrderOutcome> = {
  ok: "ok",
  missing: "missing",
  only_deleted: "missing",
  count_differs: "fix",
  amount_differs: "fix",
};

type Props = { item: ReviewItem; busy: boolean; onDecide: (action: ReviewAction, payload: DecidePayload) => void };

/** One online order next to the system vouchers carrying its number, and what to do about it. */
const OnlineOrderReview = ({ item, busy, onDecide }: Props) => {
  const t = useTranslations("Review");
  const o = item.details as OnlineOrderDetails;
  const p = item.proposal as OnlineOrderProposal | null;
  const status = p?.status ?? "missing";
  const [outcome, setOutcome] = useState<OnlineOrderOutcome>(DEFAULT_OUTCOME[status]);
  const [note, setNote] = useState(item.note ?? "");
  const noteMissing = outcome === "fix" && !note.trim();

  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 1 }}>
          #{o.invoice} · {ymd(o.date)} · {o.buyer}
        </Typography>
        <Chip size="small" color={status === "ok" ? "success" : "warning"} variant="outlined" label={t(`orderStatus.${status}`)} />
        {item.status === "deferred" && <Chip size="small" color="warning" label={t("deferredChip")} />}
      </Box>

      <Stack spacing={0.5}>
        <Field label={t("orderItems")}>
          {o.items.map((i) => `${i.qty} × ${i.name} (${formatMoney(i.line_total)})`).join(", ")}
        </Field>
        <Field label={t("orderTotal")}>
          {formatMoney(o.total)} · {o.paid ? t("orderPaid") : t("orderUnpaid")} · {o.status}
        </Field>
        {o.email && <Field label={t("email")}>{o.email}</Field>}
        {o.forms.map((f, i) => (
          <Field key={i} label={t("orderForm")}>
            {t("orderFormValue", { para: f.para, de: f.de })}
            {f.message ? <Typography component="span" variant="body2" color="text.secondary"> · «{f.message}»</Typography> : null}
          </Field>
        ))}
      </Stack>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("orderInSystem", { live: p?.live_count ?? 0, paid: formatMoney(p?.paid_total ?? 0), vouchers: o.vouchers, total: formatMoney(o.total) })}
        </Typography>
        <Stack spacing={1} sx={{ pl: 1 }}>
          {!p?.system.length && <Typography variant="body2" color="text.secondary">{t("orderNoneInSystem")}</Typography>}
          {p?.system.map((v) => <SystemVoucherLine key={v.id} v={v} />)}
        </Stack>
      </Box>

      <RadioGroup value={outcome} onChange={(e) => setOutcome(e.target.value as OnlineOrderOutcome)}>
        {OUTCOMES.map((x) => (
          <FormControlLabel key={x} value={x} control={<Radio size="small" />} label={t(`orderOutcome.${x}`)} />
        ))}
      </RadioGroup>

      <TextField
        size="small"
        multiline
        label={outcome === "fix" ? t("noteRequired") : t("note")}
        error={noteMissing}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="contained" disabled={busy || noteMissing} onClick={() => onDecide("apply", { values: { outcome }, note })}>
          {t("confirm")}
        </Button>
        {item.status !== "deferred" && (
          <Button disabled={busy} onClick={() => onDecide("later", { note })}>{t("later")}</Button>
        )}
      </Stack>
    </Paper>
  );
};

export default OnlineOrderReview;
