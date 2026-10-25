"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  // Still owed on the service itself, so this form can name the ONE amount to charge the
  // client (service + tip). The mirror of the tip banner in the Pay Booking dialog: the
  // receptionist may do these two steps in either order, and whichever she opens first
  // has to tell her the real total. Computed by the parent, which already tracks it.
  serviceRemaining?: number;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatShortDate(iso: string): string {
  return formatBusinessDate(iso);
}

const TipSection = ({ bookingId, defaultTherapistId, readOnly, serviceRemaining }: Props) => {
  const t = useTranslations("Tips");
  const tCommon = useTranslations("Common");
  const therapists = useTherapists();
  const [tips, setTips] = useState<Tip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { submitting, guard } = useSubmitGuard();
  // The tip awaiting confirmation, and the reason typed for removing it.
  const [pendingDelete, setPendingDelete] = useState<Tip | null>(null);
  const [deleteNote, setDeleteNote] = useState("");
  const { submitting: deleting, guard: deleteGuard } = useSubmitGuard();

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
  // Live with the typed amount, so the total updates as she types.
  const typedTipAmount = (() => {
    const raw = methods.watch("amount");
    if (raw == null || raw === "") return 0;
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const owed = serviceRemaining ?? 0;

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

  // Removing a tip is confirmed and needs a reason (kept in the tip's notes): it used to vanish on
  // a single click of the bin icon, with no record of why.
  const openDelete = (tip: Tip) => {
    setDeleteNote("");
    setPendingDelete(tip);
  };

  const confirmDelete = () =>
    deleteGuard(async () => {
      if (!pendingDelete || !deleteNote.trim()) return;
      try {
        const res = await fetch(`/api/tips/${pendingDelete.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: deleteNote.trim() }),
        });
        if (!res.ok) {
          toast.error(t("failedDeleteTip"));
          return;
        }
        toast.success(t("tipRemoved"));
        setPendingDelete(null);
        fetchTips();
      } catch {
        toast.error(t("failedDeleteTip"));
      }
    });

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
              <IconButton size="small" color="error" onClick={() => openDelete(tip)}>
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

            {/* Payment method — cash is shown but permanently disabled. Kept visible
                rather than removed so the rule reads as "closed", not "missing": a
                receptionist who cannot find cash at all is liable to record a cash tip as
                a card tip, which is worse than not recording it. The notice below is the
                primary channel; the tooltip needs the <span> because a disabled MUI
                control has pointer-events: none and would never fire it. */}
            <Grid size={12}>
              <Controller
                name="payment_method"
                control={methods.control}
                render={({ field }) => (
                  <RadioGroup row {...field}>
                    <Tooltip title={tCommon("cashTipsProhibited")} arrow enterTouchDelay={0}>
                      <span>
                        <FormControlLabel
                          value="cash"
                          disabled
                          control={<Radio size="small" />}
                          label={t("cash")}
                        />
                      </span>
                    </Tooltip>
                    <FormControlLabel value="credit_card" control={<Radio size="small" />} label={t("creditCard")} />
                  </RadioGroup>
                )}
              />
              <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: -0.5 }}>
                {tCommon("cashTipsProhibited")}
              </Typography>
            </Grid>

            {/* The single amount to charge. Three states, because the arithmetic differs:
                the service may still be owed, or already collected, and she may not have
                typed a tip amount yet. */}
            {serviceRemaining !== undefined && (typedTipAmount > 0 || owed > 0) && (
              <Grid size={12}>
                <Typography variant="caption" color="info.main" sx={{ display: "block" }}>
                  {typedTipAmount > 0 && owed > 0
                    ? t("tipChargeTotal", {
                        total: formatMoney(owed + typedTipAmount),
                        service: formatMoney(owed),
                        tip: formatMoney(typedTipAmount),
                      })
                    : typedTipAmount > 0
                      ? t("tipChargeTipOnly", { tip: formatMoney(typedTipAmount) })
                      : t("tipServiceRemaining", { service: formatMoney(owed) })}
                </Typography>
              </Grid>
            )}

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

      <Dialog open={!!pendingDelete} onClose={() => !deleting && setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("removeTipTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete &&
              t("removeTipConfirm", {
                amount: formatMoney(Number(pendingDelete.amount)),
                therapist: therapistDisplayName(pendingDelete.therapists),
              })}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            size="small"
            required
            label={t("removeTipReasonLabel")}
            helperText={t("removeTipReasonHelper")}
            value={deleteNote}
            onChange={(e) => setDeleteNote(e.target.value.slice(0, 500))}
            disabled={deleting}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} disabled={deleting}>{tCommon("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            onClick={confirmDelete}
            disabled={deleting || !deleteNote.trim()}
          >
            {t("removeTip")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TipSection;
