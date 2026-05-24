"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";

type Props = {
  open: boolean;
  mode: "charge" | "refund";
  voucherId: string;
  defaultAmount?: number;
  defaultMethod?: "cash" | "credit_card";
  onClose: () => void;
  onSuccess: () => void;
};

const VoucherPaymentEventDialog = ({
  open,
  mode,
  voucherId,
  defaultAmount,
  defaultMethod,
  onClose,
  onSuccess,
}: Props) => {
  const t = useTranslations("Vouchers");
  const tCommon = useTranslations("Common");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, guard } = useSubmitGuard();

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount != null ? String(defaultAmount) : "");
      setMethod(defaultMethod ?? "cash");
      setNotes("");
      setError(null);
    }
  }, [open, defaultAmount, defaultMethod]);

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const handleSubmit = () =>
    guard(async () => {
      const numAmount = Number(amount);
      if (!amount || !Number.isFinite(numAmount) || numAmount <= 0) {
        setError(t("amountPositive"));
        return;
      }
      setError(null);
      try {
        const res = await fetch("/api/payments/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_type: mode === "charge" ? "CHARGE" : "REFUND",
            amount: numAmount,
            method,
            notes: notes.trim() || undefined,
            voucher_id: voucherId,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          toast.error(result?.error || t("errorProcessingPayment"));
          return;
        }
        toast.success(
          mode === "charge" ? t("balanceAddedSuccess") : t("refundRegistered"),
        );
        onSuccess();
        onClose();
      } catch {
        toast.error(t("networkError"));
      }
    });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {mode === "charge" ? t("addBalance") : t("refundPayment")}
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "1rem !important" }}
      >
        <TextField
          label={t("amountEur")}
          type="text"
          size="small"
          fullWidth
          value={amount}
          onChange={(e) => setAmount(normalizeMoneyInput(e.target.value))}
          slotProps={{ htmlInput: { inputMode: "decimal" } }}
        />
        <FormControl fullWidth size="small">
          <InputLabel>{t("paymentMethod")}</InputLabel>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            label={t("paymentMethod")}
          >
            <MenuItem value="cash">{t("cash")}</MenuItem>
            <MenuItem value="credit_card">{t("creditCard")}</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label={tCommon("notes")}
          size="small"
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <FormHelperText error>{error}</FormHelperText>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={handleSubmit} color="success" disabled={submitting}>
          {mode === "charge" ? t("addBalance") : tCommon("refund")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoucherPaymentEventDialog;
