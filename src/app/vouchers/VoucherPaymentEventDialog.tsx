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
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!amount || !Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    setError(null);
    setSubmitting(true);
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
        toast.error(result?.error || "Error processing payment");
        return;
      }
      toast.success(
        mode === "charge" ? "Balance added successfully" : "Refund registered",
      );
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {mode === "charge" ? "Add Balance" : "Refund Payment"}
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "1rem !important" }}
      >
        <TextField
          label="Amount (€) *"
          type="number"
          size="small"
          fullWidth
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <FormControl fullWidth size="small">
          <InputLabel>Payment Method *</InputLabel>
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            label="Payment Method *"
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="credit_card">Credit Card</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          size="small"
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <FormHelperText error>{error}</FormHelperText>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} color="success" disabled={submitting}>
          {mode === "charge" ? "Add Balance" : "Refund"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VoucherPaymentEventDialog;
