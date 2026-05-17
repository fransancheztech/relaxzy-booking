"use client";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UndoIcon from "@mui/icons-material/Undo";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/utils/formatMoney";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

interface PaymentRow {
  id: string;
  charged: number;
  refunded: number;
  net: number;
  method: string;
  created_at: string;
}

interface VoucherUseRow {
  id: string;
  amount: number;
  voucher_code: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  onPaymentChanged: () => void;
}

export default function ManagePaymentsDialog({
  open,
  onClose,
  bookingId,
  onPaymentChanged,
}: Props) {
  const t = useTranslations("ManagePayments");
  const tCommon = useTranslations("Common");

  const [loading, setLoading] = useState(false);
  const { submitting: actionLoading, guard } = useSubmitGuard();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [voucherUses, setVoucherUses] = useState<VoucherUseRow[]>([]);

  const [activeRefundId, setActiveRefundId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundNotes, setRefundNotes] = useState("");

  const [activeRemoveId, setActiveRemoveId] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments-detail`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPayments(data.payments ?? []);
      setVoucherUses(data.voucher_uses ?? []);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !bookingId) return;
    setActiveRefundId(null);
    setActiveRemoveId(null);
    loadDetail();
  }, [open, bookingId]);

  const openRefund = (p: PaymentRow) => {
    setActiveRefundId(p.id);
    setRefundAmount(p.net > 0 ? String(p.net) : "");
    setRefundMethod(p.method === "credit_card" ? "credit_card" : "cash");
    setRefundNotes("");
    setActiveRemoveId(null);
  };

  const handleRefund = (paymentId: string) =>
    guard(async () => {
      const amount = parseFloat(refundAmount.replace(",", "."));
      if (!amount || amount <= 0) {
        toast.error(t("refundAmountInvalid"));
        return;
      }
      try {
        const res = await fetch(`/api/payments/${paymentId}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, method: refundMethod, notes: refundNotes || null }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "");
        }
        toast.success(t("refundSuccess"));
        setActiveRefundId(null);
        onPaymentChanged();
        await loadDetail();
      } catch (err: any) {
        toast.error(err.message || t("refundError"));
      }
    });

  const handleRemoveVoucherUse = (id: string) =>
    guard(async () => {
      try {
        const res = await fetch(`/api/voucher-uses/${id}/delete`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "");
        }
        toast.success(t("removeSuccess"));
        setActiveRemoveId(null);
        onPaymentChanged();
        await loadDetail();
      } catch (err: any) {
        toast.error(err.message || t("removeError"));
      }
    });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const methodLabel = (method: string) =>
    method === "credit_card" ? t("card") : t("cash");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        {t("title")}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {/* Payments */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
              {t("paymentsSection")}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("noPayments")}
              </Typography>
            ) : (
              payments.map((p) => (
                <Box key={p.id} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {formatMoney(p.net)}
                        {p.refunded > 0 && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({t("charged")} {formatMoney(p.charged)}, {t("refunded")} {formatMoney(p.refunded)})
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {methodLabel(p.method)} · {formatDate(p.created_at)}
                      </Typography>
                    </Box>
                    {p.net > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<UndoIcon fontSize="small" />}
                        onClick={() => activeRefundId === p.id ? setActiveRefundId(null) : openRefund(p)}
                        disabled={actionLoading}
                      >
                        {tCommon("refund")}
                      </Button>
                    )}
                  </Box>

                  {activeRefundId === p.id && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField
                          size="small"
                          label={t("refundAmountLabel")}
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(normalizeMoneyInput(e.target.value))}
                          slotProps={{ htmlInput: { inputMode: "decimal" } }}
                          sx={{ flex: 1 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>{t("refundMethodLabel")}</InputLabel>
                          <Select
                            value={refundMethod}
                            label={t("refundMethodLabel")}
                            onChange={(e) => setRefundMethod(e.target.value)}
                          >
                            <MenuItem value="cash">{t("cash")}</MenuItem>
                            <MenuItem value="credit_card">{t("card")}</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                      <TextField
                        size="small"
                        label={t("notesOptional")}
                        value={refundNotes}
                        onChange={(e) => setRefundNotes(e.target.value)}
                        fullWidth
                      />
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <Button size="small" onClick={() => setActiveRefundId(null)} disabled={actionLoading}>
                          {tCommon("cancel")}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          onClick={() => handleRefund(p.id)}
                          disabled={actionLoading}
                        >
                          {t("confirmRefund")}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))
            )}

            {/* Voucher Uses */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>
              {t("voucherUsesSection")}
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {voucherUses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("noVoucherUses")}
              </Typography>
            ) : (
              voucherUses.map((vu) => (
                <Box key={vu.id} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {formatMoney(vu.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("voucherCode")}: {vu.voucher_code ?? t("voucherCodeUnknown")} · {formatDate(vu.created_at)}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => setActiveRemoveId(activeRemoveId === vu.id ? null : vu.id)}
                      disabled={actionLoading}
                    >
                      {t("removeAction")}
                    </Button>
                  </Box>

                  {activeRemoveId === vu.id && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>{t("confirmRemoveText")}</Typography>
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <Button size="small" onClick={() => setActiveRemoveId(null)} disabled={actionLoading}>
                          {tCommon("cancel")}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          onClick={() => handleRemoveVoucherUse(vu.id)}
                          disabled={actionLoading}
                        >
                          {t("confirmRemove")}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
