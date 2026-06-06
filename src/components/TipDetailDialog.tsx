"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useTherapists } from "@/hooks/useTherapists";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { ivaAppliesForTipMethod } from "@/utils/tipIva";

interface TipRow {
  id: string;
  therapist_id: string;
  therapist_name: string;
  iva_applies: boolean;
  payment_method: "cash" | "credit_card";
  notes: string | null;
  received_at: string;
  payout_id: string | null;
}

interface Props {
  tip: TipRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  therapist_id: string;
  received_at: Date | null;
  payment_method: "cash" | "credit_card";
  iva_applies: boolean;
  notes: string;
}

const TipDetailDialog = ({ tip, onClose, onSaved }: Props) => {
  const t = useTranslations("TipsPage");
  const tCommon = useTranslations("Common");
  const therapists = useTherapists();
  const [form, setForm] = useState<FormState | null>(null);
  const { submitting: saving, guard } = useSubmitGuard();

  const isReleased = tip?.payout_id !== null;

  useEffect(() => {
    if (tip) {
      setForm({
        therapist_id: tip.therapist_id,
        received_at: new Date(tip.received_at),
        payment_method: tip.payment_method,
        iva_applies: tip.iva_applies,
        notes: tip.notes ?? "",
      });
    }
  }, [tip]);

  const handleSave = () =>
    guard(async () => {
      if (!tip || !form) return;
      try {
        const res = await fetch(`/api/tips/${tip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            received_at: form.received_at?.toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? t("errorSavingTip"));
          return;
        }
        toast.success(t("tipSaved"));
        onSaved();
        onClose();
      } catch {
        toast.error(t("errorSavingTip"));
      }
    });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => prev && ({ ...prev, [key]: value }));

  return (
    <Dialog open={!!tip} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {isReleased ? t("viewTip") : t("editTip")}
          <Chip
            size="small"
            label={isReleased ? t("statusReleased") : t("statusPending")}
            color={isReleased ? "success" : "warning"}
            sx={{ fontSize: "0.7rem" }}
          />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        {form && (
          <>
            <FormControl size="small" fullWidth disabled={isReleased}>
              <InputLabel>{t("colTherapist")}</InputLabel>
              <Select
                value={form.therapist_id}
                label={t("colTherapist")}
                onChange={(e) => set("therapist_id", e.target.value)}
              >
                {therapists.map((th) => (
                  <MenuItem key={th.id} value={th.id}>{th.full_name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
              <DatePicker
                label={t("colReceivedOn")}
                value={form.received_at}
                onChange={(d) => set("received_at", d)}
                format="dd/MM/yyyy"
                disabled={isReleased}
                disableFuture
                slotProps={{ textField: { size: "small", fullWidth: true } }}
              />
            </LocalizationProvider>

            <FormControl size="small" fullWidth disabled={isReleased}>
              <InputLabel>{t("colMethod")}</InputLabel>
              <Select
                value={form.payment_method}
                label={t("colMethod")}
                onChange={(e) => set("payment_method", e.target.value as FormState["payment_method"])}
              >
                <MenuItem value="cash">{t("methodCash")}</MenuItem>
                <MenuItem value="credit_card">{t("methodCard")}</MenuItem>
              </Select>
            </FormControl>

            {/* IVA is derived from the payment method — shown read-only */}
            <FormControlLabel
              control={
                <Switch
                  checked={ivaAppliesForTipMethod(form.payment_method)}
                  disabled
                  size="small"
                />
              }
              label={
                <Typography variant="body2">{t("ivaApplies")}</Typography>
              }
            />

            <TextField
              size="small"
              fullWidth
              label={tCommon("notes")}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={isReleased}
              multiline
              minRows={2}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">{tCommon("close")}</Button>
        {!isReleased && (
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TipDetailDialog;
