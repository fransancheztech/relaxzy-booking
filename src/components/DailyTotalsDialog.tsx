"use client";

import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import type { SxProps, Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/utils/formatMoney";

/** Summary row — tinted, bold, separated from the itemized rows by a top border. */
const TOTAL_ROW_SX: SxProps<Theme> = {
  bgcolor: "action.selected",
  "& td": {
    fontWeight: 700,
    borderTop: "2px solid",
    borderTopColor: "divider",
    borderBottom: 0,
  },
};

/** Column-header row — tinted and bold so it reads as labels, not data. */
const HEADER_ROW_SX: SxProps<Theme> = {
  bgcolor: "action.hover",
  "& th": { fontWeight: 700 },
};

/** Sections that include tips — visually flagged as NOT standard accounting. */
const TIPS_ACCENT_SX: SxProps<Theme> = {
  borderLeft: "3px solid",
  borderColor: "warning.main",
  bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
  borderRadius: 1,
  px: 2,
  py: 1.5,
};

/** Neutral total box — the accounting figure (bookings + vouchers, no tips). */
const TOTAL_BOX_SX: SxProps<Theme> = {
  bgcolor: "action.selected",
  borderRadius: 1,
  px: 2,
  py: 1.5,
};

interface TherapistTips {
  therapist_id: string;
  therapist_name: string;
  cash: number;
  card: number;
  total: number;
}

interface DailyTotalsData {
  payments: { cash: number; card: number; total: number };
  voucher_sales: { cash: number; card: number; total: number };
  tips: { cash: number; card: number; total: number; by_therapist: TherapistTips[] };
  combined: { cash: number; card: number; total: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  start: Date | null;
  end: Date | null;
}

const DailyTotalsDialog = ({ open, onClose, start, end }: Props) => {
  const t = useTranslations("DailyTotals");
  const locale = useLocale();
  const [data, setData] = useState<DailyTotalsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !start || !end) return;
    setLoading(true);
    setData(null);
    setError(false);
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    fetch(`/api/calendar/daily-totals?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, start, end]);

  const dateLabel = start
    ? start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {t("title")}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {dateLabel}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ position: "absolute", top: 10, right: 10 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && error && (
          <Typography color="error" variant="body2" sx={{ py: 2 }}>
            {t("loadError")}
          </Typography>
        )}

        {!loading && data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

            {/* Booking payments */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t("paymentsSection")}
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>{t("cash")}</TableCell>
                    <TableCell align="right"><strong>{formatMoney(data.payments.cash)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>{t("card")}</TableCell>
                    <TableCell align="right"><strong>{formatMoney(data.payments.card)}</strong></TableCell>
                  </TableRow>
                  <TableRow sx={TOTAL_ROW_SX}>
                    <TableCell>{t("total")}</TableCell>
                    <TableCell align="right">{formatMoney(data.payments.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            <Divider />

            {/* Voucher sales */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t("voucherSalesSection")}
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>{t("cash")}</TableCell>
                    <TableCell align="right"><strong>{formatMoney(data.voucher_sales.cash)}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary" }}>{t("card")}</TableCell>
                    <TableCell align="right"><strong>{formatMoney(data.voucher_sales.card)}</strong></TableCell>
                  </TableRow>
                  <TableRow sx={TOTAL_ROW_SX}>
                    <TableCell>{t("total")}</TableCell>
                    <TableCell align="right">{formatMoney(data.voucher_sales.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>

            <Divider />

            {/* Total — bookings + vouchers, EXCLUDES tips (the accounting figure) */}
            <Box sx={TOTAL_BOX_SX}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t("totalsSection")}
              </Typography>
              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("totalsCash")}</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatMoney(data.payments.cash + data.voucher_sales.cash)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("totalsCard")}</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatMoney(data.payments.card + data.voucher_sales.card)}</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">{t("total")}</Typography>
                <Typography variant="h5" fontWeight={800}>{formatMoney(data.payments.total + data.voucher_sales.total)}</Typography>
              </Box>
            </Box>

            {/* Tips — NOT standard accounting; accented */}
            <Box sx={TIPS_ACCENT_SX}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {t("tipsSection")}
              </Typography>
              {data.tips.by_therapist.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t("noTips")}</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={HEADER_ROW_SX}>
                      <TableCell>{t("therapist")}</TableCell>
                      <TableCell align="right">{t("cash")}</TableCell>
                      <TableCell align="right">{t("card")}</TableCell>
                      <TableCell align="right">{t("total")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.tips.by_therapist.map((th) => (
                      <TableRow key={th.therapist_id}>
                        <TableCell>{th.therapist_name}</TableCell>
                        <TableCell align="right">{th.cash > 0 ? formatMoney(th.cash) : "—"}</TableCell>
                        <TableCell align="right">{th.card > 0 ? formatMoney(th.card) : "—"}</TableCell>
                        <TableCell align="right"><strong>{formatMoney(th.total)}</strong></TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={TOTAL_ROW_SX}>
                      <TableCell>{t("total")}</TableCell>
                      <TableCell align="right">{formatMoney(data.tips.cash)}</TableCell>
                      <TableCell align="right">{formatMoney(data.tips.card)}</TableCell>
                      <TableCell align="right">{formatMoney(data.tips.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </Box>

            {/* End of day grand totals — INCLUDES tips; accented + flagged */}
            <Box sx={TIPS_ACCENT_SX}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {t("endOfDaySection")}
                </Typography>
                <Typography variant="caption" sx={{ color: "warning.main", fontStyle: "italic" }}>
                  {t("includesTips")}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("totalCash")}</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatMoney(data.combined.cash)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("totalCard")}</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatMoney(data.combined.card)}</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">{t("grandTotal")}</Typography>
                <Typography variant="h5" fontWeight={800} color="primary">{formatMoney(data.combined.total)}</Typography>
              </Box>
            </Box>

          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DailyTotalsDialog;
