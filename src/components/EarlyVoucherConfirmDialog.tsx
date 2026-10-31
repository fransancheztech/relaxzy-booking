"use client";

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslations } from "next-intl";
import { formatBusinessDate } from "@/utils/businessTime";
import type { EarlyVoucherUse } from "@/lib/vouchers/firstUsableDay";

type Props = {
  uses: EarlyVoucherUse[];
  onGoBack: () => void;
  onProceed: () => void;
  submitting?: boolean;
};

/**
 * Last check before saving a payment with a voucher used before its first permitted day (7-day
 * rule). Doesn't block — the receptionist can go ahead — but can't be clicked through by accident.
 */
export default function EarlyVoucherConfirmDialog({ uses, onGoBack, onProceed, submitting }: Props) {
  const t = useTranslations("BookingPayment");
  return (
    <Dialog open={uses.length > 0} onClose={submitting ? undefined : onGoBack} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WarningAmberIcon color="warning" />
        {t("earlyConfirmTitle")}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>{t("earlyConfirmIntro")}</Typography>
        {uses.map((u) => (
          <Alert key={u.code} severity="warning" sx={{ mb: 1 }}>
            {t("earlyConfirmItem", {
              code: u.code,
              sold: formatBusinessDate(u.soldAt),
              from: formatBusinessDate(u.usableFrom),
              appointment: formatBusinessDate(u.appointment),
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
