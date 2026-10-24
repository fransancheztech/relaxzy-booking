"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Usage = { bookings: number; vouchers: number; voucherUses: number; deletable: boolean };

type Props = {
  open: boolean;
  clientId: string | null;
  onClose: () => void;
  /** Receives the reason, which the server stores in the client's notes. */
  onConfirm: (note: string) => void | Promise<void>;
  clientName?: string;
};

/**
 * Deleting a client: refused while the client still has bookings, vouchers or voucher uses (they'd
 * point at a hidden client; a duplicate is merged instead), and otherwise only with a reason.
 */
export default function ConfirmDeleteClientDialog({ open, clientId, onClose, onConfirm, clientName }: Props) {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();
  const [note, setNote] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;
    setNote("");
    setUsage(null);
    setChecking(true);
    let cancelled = false;
    fetch(`/api/clients/${clientId}/usage`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: Usage) => { if (!cancelled) setUsage(u); })
      // If the check itself fails, let the server decide on delete (it checks again).
      .catch(() => { if (!cancelled) setUsage(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  const blocked = usage !== null && !usage.deletable;
  const reason = note.trim();

  const handleConfirm = () => guard(async () => {
    await onConfirm(reason);
    onClose();
  });

  const historyParts = usage
    ? [
        usage.bookings > 0 && t("bookingsCount", { count: usage.bookings }),
        usage.vouchers > 0 && t("vouchersCount", { count: usage.vouchers }),
        usage.voucherUses > 0 && t("voucherUsesCount", { count: usage.voucherUses }),
      ].filter(Boolean).join(", ")
    : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("deleteTitle")}</DialogTitle>
      <DialogContent>
        {checking ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : blocked ? (
          <Alert severity="warning">{t("deleteBlockedHistory", { details: historyParts })}</Alert>
        ) : (
          <>
            <DialogContentText>
              {clientName ? t("deleteWithName", { name: clientName }) : t("deleteWithoutName")}
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={2}
              size="small"
              label={t("deleteNoteLabel")}
              helperText={t("deleteNoteHelper")}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              disabled={submitting}
              required
              sx={{ mt: 2 }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>{blocked ? tCommon("close") : tCommon("cancel")}</Button>
        {!blocked && (
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            onClick={handleConfirm}
            disabled={submitting || checking || !reason}
          >
            {tCommon("delete")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
