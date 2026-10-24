"use client";

import { useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Divider, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { formatBusinessDate } from "@/utils/businessTime";
import { formatMoney } from "@/utils/formatMoney";
import { isVoucherExpired } from "@/lib/vouchers/expiry";
import VoucherDetailDialog from "@/app/vouchers/VoucherDetailDialog";

type VoucherRow = {
  id: string;
  code: string;
  role: "buyer" | "recipient" | "both";
  /** Who it was bought for (role "buyer") or who it came from (role "recipient"). */
  other: string | null;
  balance: number;
  created_at: string | null;
  expiration_date: string | null;
};

const ClientVouchersSection = ({ clientId, open }: { clientId: string | null; open: boolean }) => {
  const t = useTranslations("Clients");
  const [rows, setRows] = useState<VoucherRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [voucherToView, setVoucherToView] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clientId) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clients/${clientId}/vouchers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setRows(d.rows ?? []); })
      .catch(() => { if (!cancelled) setRows(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  const roleLabel = (r: VoucherRow) =>
    r.role === "both" ? t("voucherRoleBoth") : r.role === "buyer" ? t("voucherRoleBuyer") : t("voucherRoleRecipient");

  const statusChip = (r: VoucherRow) => {
    const expired = isVoucherExpired(r.expiration_date);
    const usedUp = r.balance <= 0;
    return (
      <Chip
        size="small"
        label={usedUp ? t("voucherUsedUp") : expired ? t("voucherExpired") : t("voucherBalance", { balance: formatMoney(r.balance) })}
        color={usedUp || expired ? "default" : "success"}
        sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600 }}
      />
    );
  };

  // What THIS client can still spend: vouchers they received (or bought for themselves) with
  // balance left and not expired. Balance on a voucher they bought for someone else isn't theirs.
  const withBalance = (rows ?? []).filter(
    (r) => r.role !== "buyer" && r.balance > 0 && !isVoucherExpired(r.expiration_date),
  );
  const totalLeft = withBalance.reduce((s, r) => s + r.balance, 0);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">{t("vouchersTitle")}</Typography>
      <Divider sx={{ mb: 1 }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : !rows || rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
          {t("noVouchers")}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
            {t("vouchersCount", { count: rows.length })}
            {withBalance.length > 0 && ` · ${t("vouchersUsable", { balance: formatMoney(totalLeft) })}`}
          </Typography>

          <Box sx={{ maxHeight: 220, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            {rows.map((r, i) => {
              const inactive = r.balance <= 0 || isVoucherExpired(r.expiration_date);
              return (
                <Box
                  key={r.id}
                  onClick={() => setVoucherToView(r.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    cursor: "pointer",
                    borderTop: i === 0 ? "none" : "1px solid",
                    borderColor: "divider",
                    opacity: inactive ? 0.6 : 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography variant="caption" sx={{ minWidth: 92, fontWeight: 600 }}>
                    {r.code}
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 80 }}>
                    {roleLabel(r)}
                    {r.other && (
                      <Box component="span" sx={{ color: "text.secondary" }}>
                        {" "}
                        {r.role === "buyer" ? t("voucherFor", { name: r.other }) : t("voucherFrom", { name: r.other })}
                      </Box>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 92 }}>
                    {t("voucherExpires", { date: formatBusinessDate(r.expiration_date) })}
                  </Typography>
                  {statusChip(r)}
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Vouchers opened from a client are read-only, like bookings opened from a client:
          balance, refunds, edits and deletions happen only from the Vouchers page. */}
      {voucherToView && (
        <VoucherDetailDialog
          open={!!voucherToView}
          voucherId={voucherToView}
          onClose={() => setVoucherToView(null)}
          readOnly
        />
      )}
    </Box>
  );
};

export default ClientVouchersSection;
