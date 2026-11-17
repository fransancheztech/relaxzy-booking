"use client";

import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/utils/formatMoney";
import type {
  CardUsage,
  ReviewAction,
  ReviewItem,
  VoucherCardDecision,
  VoucherCardDetails,
  VoucherCardProposal,
} from "@/lib/review/types";
import type { DecidePayload } from "./ReviewItemCard";
import { Field, SystemVoucherLine, ymd } from "./VoucherParts";

type Link = VoucherCardDecision["link"];
const USAGES: CardUsage[] = ["recorded", "unrecorded", "unused", "unknown"];
// Before December 2025 vouchers weren't recorded in the app, so a card with nothing close is missing.
const TRACKING_START = "2025-12-01";

type Props = { item: ReviewItem; busy: boolean; onDecide: (action: ReviewAction, payload: DecidePayload) => void };

/**
 * One physical gift card: what's written on it, the system vouchers it may be (preselected when
 * the match is clear), the online order it may be a printed copy of, and whether it was used.
 */
const VoucherCardReview = ({ item, busy, onDecide }: Props) => {
  const t = useTranslations("Review");
  const card = item.details as VoucherCardDetails;
  const p = (item.proposal as VoucherCardProposal | null) ?? { by_code: false, suggested: [], candidates: [], online_orders: [], usage: "unknown" as CardUsage };
  const strongOnline = p.online_orders.find((o) => o.strong);

  const defaultLink: Link | null = p.suggested.length ? "system"
    : strongOnline ? "online_order"
      : card.fecha && card.fecha < TRACKING_START && !p.candidates.length ? "missing"
        : null;
  const [link, setLink] = useState<Link | null>(defaultLink);
  const [ids, setIds] = useState<string[]>(p.suggested);
  const [invoice, setInvoice] = useState<number | null>(strongOnline?.invoice ?? p.online_orders[0]?.invoice ?? null);
  const [used, setUsed] = useState<CardUsage>(p.usage);
  const [gift, setGift] = useState(card.shop_gift);
  const [note, setNote] = useState(item.note ?? "");

  const valid = link === "system" ? ids.length > 0 : link === "online_order" ? invoice != null : link === "missing";
  const toggle = (id: string) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 1 }}>
          {ymd(card.fecha)} · {card.de || "—"} → {card.para || "—"}
        </Typography>
        <Chip size="small" color={card.redeemed_line ? "success" : "default"} variant="outlined"
          label={card.redeemed_line ? t("cardLine") : t("cardNoLine")} />
        {card.shop_gift && <Chip size="small" color="secondary" variant="outlined" label={t("cardShopGift")} />}
        {card.confidence !== "high" && <Chip size="small" color="warning" variant="outlined" label={t("cardUnsure")} />}
        {item.status === "deferred" && <Chip size="small" color="warning" label={t("deferredChip")} />}
      </Box>

      <Stack spacing={0.5}>
        <Field label={t("cardTreatment")}>
          {card.tratamiento_raw || "—"}{card.service && card.service !== card.tratamiento_raw ? ` (${card.service})` : ""}
        </Field>
        <Field label={t("cardDuration")}>
          {card.duracion_raw || "—"}{card.people > 1 ? ` · ${t("cardPeople", { count: card.people })}` : ""}
        </Field>
        <Field label={t("cardDates")}>{t("cardDatesValue", { sold: card.fecha_raw || "—", expiry: card.expiracion_raw || "—" })}</Field>
        {card.code && <Field label={t("cardCode")}>{card.code}</Field>}
        {card.notes && <Field label={t("cardNotes")}>{card.notes}</Field>}
        <Field label={t("cardFile")}>{`${card.card}.jpg`}</Field>
      </Stack>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t("cardWhatIsIt")}</Typography>

        <FormControlLabel
          control={<Radio size="small" checked={link === "system"} onChange={() => setLink("system")} />}
          label={p.by_code ? t("linkSystemByCode") : t("linkSystem")}
        />
        <Stack spacing={1} sx={{ pl: 4, mb: 1 }}>
          {p.candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary">{t("noCandidates")}</Typography>
          )}
          {p.candidates.map((c) => (
            <Box key={c.id} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
              <Checkbox
                size="small"
                sx={{ p: 0.25 }}
                checked={ids.includes(c.id)}
                onChange={() => { toggle(c.id); setLink("system"); }}
              />
              <SystemVoucherLine v={c} why={c.why} />
            </Box>
          ))}
        </Stack>

        <FormControlLabel
          disabled={!p.online_orders.length}
          control={<Radio size="small" checked={link === "online_order"} onChange={() => setLink("online_order")} />}
          label={p.online_orders.length ? t("linkOnline") : t("linkOnlineNone")}
        />
        {p.online_orders.length > 0 && (
          <Stack spacing={0.5} sx={{ pl: 4, mb: 1 }}>
            {p.online_orders.map((o) => (
              <FormControlLabel
                key={o.invoice}
                control={<Radio size="small" checked={invoice === o.invoice} onChange={() => { setInvoice(o.invoice); setLink("online_order"); }} />}
                label={
                  <Typography variant="body2">
                    #{o.invoice} · {ymd(o.date)} · {o.buyer} · {t("orderVouchers", { count: o.vouchers })} · {formatMoney(o.total)}
                    <Typography component="span" variant="caption" color="text.secondary"> · {o.names.slice(1).join(" / ")}</Typography>
                  </Typography>
                }
              />
            ))}
          </Stack>
        )}

        <FormControlLabel
          control={<Radio size="small" checked={link === "missing"} onChange={() => setLink("missing")} />}
          label={t("linkMissing")}
        />
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <TextField select size="small" label={t("usageLabel")} value={used} onChange={(e) => setUsed(e.target.value as CardUsage)} sx={{ minWidth: 280 }}>
          {USAGES.map((u) => <MenuItem key={u} value={u}>{t(`usage.${u}`)}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Checkbox size="small" checked={gift} onChange={(e) => setGift(e.target.checked)} />} label={t("cardGiftCheck")} />
      </Stack>

      <TextField
        size="small"
        multiline
        label={t("note")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={busy || !valid}
          onClick={() => onDecide("apply", {
            values: { link, voucher_ids: link === "system" ? ids : [], invoice: link === "online_order" ? invoice : null, used, shop_gift: gift },
            note,
          })}
        >
          {t("confirm")}
        </Button>
        {item.status !== "deferred" && (
          <Button disabled={busy} onClick={() => onDecide("later", { note })}>{t("later")}</Button>
        )}
      </Stack>
    </Paper>
  );
};

export default VoucherCardReview;
