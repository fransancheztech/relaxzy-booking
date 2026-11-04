"use client";

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslations } from "next-intl";
import { formatBusinessDate } from "@/utils/businessTime";
import type { VoucherUseWarning } from "@/lib/vouchers/useWarnings";

type Props = {
  warnings: VoucherUseWarning[];
  onGoBack: () => void;
  onProceed: () => void;
  submitting?: boolean;
};

/**
 * Last check before saving a payment with a voucher used before its first permitted day (7-day
 * rule) or after its expiry. Doesn't block — the receptionist can go ahead — but can't be clicked
 * through by accident.
 */
export default function VoucherUseConfirmDialog({ warnings, onGoBack, onProceed, submitting }: Props) {
  const t = useTranslations("BookingPayment");
  const hasEarly = warnings.some((w) => w.kind === "early");
  const hasExpired = warnings.some((w) => w.kind === "expired");
  return (
    <Dialog open={warnings.length > 0} onClose={submitting ? undefined : onGoBack} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WarningAmberIcon color="warning" />
        {hasExpired ? t("expiredConfirmTitle") : t("earlyConfirmTitle")}
      </DialogTitle>
      <DialogContent>
        {hasEarly && <Typography variant="body2" sx={{ mb: 1.5 }}>{t("earlyConfirmIntro")}</Typography>}
        {hasExpired && <Typography variant="body2" sx={{ mb: 1.5 }}>{t("expiredConfirmIntro")}</Typography>}
        {warnings.map((w) => (
          <Alert key={`${w.kind}-${w.code}`} severity="warning" sx={{ mb: 1 }}>
            {w.kind === "early"
              ? t("earlyConfirmItem", {
                  code: w.code,
                  sold: formatBusinessDate(w.soldAt),
                  from: formatBusinessDate(w.usableFrom),
                  appointment: formatBusinessDate(w.appointment),
                })
              : t("expiredConfirmItem", {
                  code: w.code,
                  expired: formatBusinessDate(w.expiredOn),
                  appointment: formatBusinessDate(w.appointment),
                })}
          </Alert>
        ))}
        <Typography variant="body2" color="text.secondary">{t("earlyConfirmQuestion")}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onGoBack} disabled={submitting}>{t("earlyConfirmGoBack")}</Button>
        <Button variant="contained" color="warning" onClick={onProceed} disabled={submitting}>
          {t("earlyConfirmProceed")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
