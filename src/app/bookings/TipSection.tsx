"use client";

import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { TipSchema, TipFormInput, TipFormOutput } from "@/schemas/tip.schema";
import { formatBusinessDate } from "@/utils/businessTime";
import { useTherapists } from "@/hooks/useTherapists";
import { therapistDisplayName } from "@/utils/therapistName";
import { ivaAppliesForTipMethod } from "@/utils/tipIva";
import { formatMoney } from "@/utils/formatMoney";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

interface Tip {
  id: string;
  therapist_id: string;
  amount: string | number;
  payment_method: "cash" | "credit_card";
  iva_applies: boolean;
  notes: string | null;
  received_at: string;
  therapists: { id: string; nickname: string | null; name: string | null; surname: string | null };
}

interface Props {
  bookingId: string;
  defaultTherapistId?: string;
  readOnly?: boolean;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatShortDate(iso: string): string {
  return formatBusinessDate(iso);
}

const TipSection = ({ bookingId, defaultTherapistId, readOnly }: Props) => {
  const t = useTranslations("Tips");
  const tCommon = useTranslations("Common");
  const therapists = useTherapists();
  const [tips, setTips] = useState<Tip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<TipFormInput, any, TipFormOutput>({
    resolver: zodResolver(TipSchema),
    defaultValues: {
      therapist_id: defaultTherapistId ?? "",
      amount: "",
      payment_method: "credit_card",
      notes: "",
    },
  });

  const paymentMethod = methods.watch("payment_method");

  const fetchTips = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/tips?bookingId=${bookingId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTips(data.tips ?? []);
    } catch {
      // silently ignore
    }
  }, [bookingId]);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  const methodLabel = (method: string) =>
    ({ cash: t("cash"), credit_card: t("creditCard") }[method] ?? method);

  const onSubmit = (data: TipFormOutput) =>
    guard(async () => {
      try {
        const res = await fetch("/api/tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: bookingId,
            therapist_id: data.therapist_id,
            amount: data.amount,
            payment_method: data.payment_method,
            notes: data.notes,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? t("failedAddTip"));
          return;
        }

        toast.success(t("tipAdded"));
        methods.reset({
          therapist_id: defaultTherapistId ?? "",
          amount: "",
          payment_method: "credit_card",
          notes: "",
        });
        setShowForm(false);
        fetchTips();
      } catch {
        toast.error(t("failedAddTip"));
      }
    });

  const handleDelete = async (tipId: string) => {
    try {
      const res = await fetch(`/api/tips/${tipId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? t("failedDeleteTip"));
        return;
      }
      toast.success(t("tipRemoved"));
      fetchTips();
    } catch {
      toast.error(t("failedDeleteTip"));
    }
  };

  return (
    <Box>
      {/* Section header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t("sectionHeader")}
        </Typography>
        <Divider sx={{ flex: 1 }} />
        {!readOnly && (
          <Tooltip title={t("recordTip")}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowForm((v) => !v)}
            >
              {t("add")}
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* Existing tips */}
      {tips.length === 0 && !showForm && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.5 }}>
          {t("noTips")}
        </Typography>
      )}

      {tips.map((tip) => (
        <Box
          key={tip.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 0.5,
            px: 1,
            borderRadius: 1,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {therapistDisplayName(tip.therapists)}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {formatMoney(Number(tip.amount))}
          </Typography>
          <Chip
            label={methodLabel(tip.payment_method)}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.7rem" }}
          />
          {tip.iva_applies && (
            <Chip label="IVA" size="small" color="warning" sx={{ fontSize: "0.7rem" }} />
          )}
          {!isToday(tip.received_at) && (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {formatShortDate(tip.received_at)}
            </Typography>
          )}
          {tip.notes && (
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tip.notes}
            </Typography>
          )}
          {!readOnly && (
            <Tooltip title={t("removeTip")}>
              <IconButton size="small" color="error" onClick={() => handleDelete(tip.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}

      {/* Add tip form */}
      {showForm && (
        <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
          <Grid container spacing={1}>
            {/* Therapist */}
            <Grid size={6}>
              <Controller
                name="therapist_id"
                control={methods.control}
                render={({ field }) => (
                  <FormControl fullWidth size="small" required error={!!methods.formState.errors.therapist_id}>
                    <InputLabel>{tCommon("therapist")}</InputLabel>
                    <Select {...field} value={field.value ?? ""} label={tCommon("therapist")}>
                      <MenuItem value=""><em>{tCommon("none")}</em></MenuItem>
                      {therapists.map((th) => (
                        <MenuItem key={th.id} value={th.id}>{th.full_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Amount */}
            <Grid size={6}>
              <Controller
                name="amount"
                control={methods.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={tCommon("amount")}
                    required
                    size="small"
                    fullWidth
                    error={!!methods.formState.errors.amount}
                    helperText={methods.formState.errors.amount?.message}
                    slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  />
                )}
              />
            </Grid>

            {/* Payment method */}
            <Grid size={12}>
              <Controller
                name="payment_method"
                control={methods.control}
                render={({ field }) => (
                  <RadioGroup row {...field}>
                    <FormControlLabel value="cash" control={<Radio size="small" />} label={t("cash")} />
                    <FormControlLabel value="credit_card" control={<Radio size="small" />} label={t("creditCard")} />
                  </RadioGroup>
                )}
              />
            </Grid>

            {/* IVA is derived from the payment method — shown read-only */}
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={ivaAppliesForTipMethod(paymentMethod)} disabled size="small" />}
                label={<Typography variant="caption">{t("ivaApplies")}</Typography>}
              />
            </Grid>

            {/* Notes — the tip's date is the booking's appointment date, not entered here */}
            <Grid size={12}>
              <Controller
                name="notes"
                control={methods.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t("notesOptional")}
                    size="small"
                    fullWidth
                    multiline
                    rows={1}
                  />
                )}
              />
            </Grid>

            {/* Actions */}
            <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button size="small" onClick={() => { setShowForm(false); methods.reset(); }}>
                {tCommon("cancel")}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="success"
                type="button"
                disabled={submitting}
                onClick={methods.handleSubmit(onSubmit)}
                startIcon={<AddIcon />}
              >
                {t("saveTip")}
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default TipSection;
