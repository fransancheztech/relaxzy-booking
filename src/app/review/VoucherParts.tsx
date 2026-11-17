"use client";

import { Box, Chip, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/utils/formatMoney";
import type { SystemVoucherSummary } from "@/lib/review/types";

/** "2025-12-22" or "2025-12-22T14:05" → "22/12/2025" (or "22/12/2025 14:05"), without time-zone shifts. */
export function ymd(value: string | null | undefined): string {
  if (!value) return "—";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}` : ""}`;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 130 }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, wordBreak: "break-word", flex: 1, minWidth: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

/** One system voucher on a line: code, day sold, buyer → recipient, money, balance and uses. */
export function SystemVoucherLine({ v, why }: { v: SystemVoucherSummary; why?: string[] }) {
  const t = useTranslations("Review");
  const uses = v.uses.length
    ? t("vUses", { count: v.uses.length, dates: v.uses.map((u) => ymd(u.date)).join(", ") })
    : t("vNoUses");
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, opacity: v.deleted ? 0.6 : 1 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="body2" fontWeight={700}>{v.code}</Typography>
        <Typography variant="body2" color="text.secondary">{ymd(v.sold)}</Typography>
        <Typography variant="body2">{v.buyer || "—"} → {v.recipient || "—"}</Typography>
        {v.deleted && <Chip size="small" color="error" variant="outlined" label={t("vDeleted")} />}
        {v.source === "online" && <Chip size="small" variant="outlined" label={t("vOnline", { ref: v.external_reference ?? "" })} />}
        {(why ?? []).map((w) => (
          <Chip key={w} size="small" variant="outlined" color="primary" label={t(`why.${w.startsWith("days_") ? "days" : w}`, { days: Number(w.split("_")[1] ?? 0) })} />
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t("vMoney", { paid: formatMoney(v.paid), balance: v.balance == null ? "—" : formatMoney(v.balance) })} · {uses}
        {v.notes ? ` · ${v.notes}` : ""}
      </Typography>
    </Box>
  );
}
