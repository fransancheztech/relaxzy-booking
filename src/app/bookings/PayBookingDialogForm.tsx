"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookingPaymentSchema,
  BookingPaymentFormInput,
  BookingPaymentFormOutput,
} from "@/schemas/bookingPayment.schema";
import handleSubmitPayBooking from "@/handlers/handleSubmitPayBooking";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";
import { formatMoney } from "@/utils/formatMoney";
import VoucherPickerField from "./VoucherPickerField";
import MethodAmountField, { METHOD_COLORS } from "@/components/payments/MethodAmountField";
import { BusinessDatePicker } from "@/components/BusinessDatePickers";
import { BUSINESS_TIMEZONE } from "@/constants";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

// Today's calendar day in the business timezone, as a plain JS Date (midnight Madrid).
const todayBusiness = () =>
  DateTime.now().setZone(BUSINESS_TIMEZONE).startOf("day").toJSDate();

interface DialogFormProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  price: number;
  paidCash: number;
  paidCard: number;
  paidVoucher?: number;
  onPaymentSuccess: () => void;
}

const PayBookingDialogForm = ({
  open,
  onClose,
  bookingId,
  price,
  paidCash,
  paidCard,
  paidVoucher = 0,
  onPaymentSuccess,
}: DialogFormProps) => {
  const t = useTranslations("BookingPayment");
  const tCommon = useTranslations("Common");

  const defaultValues = {
    cashPayment: "0",
    cardPayment: "0",
    voucherPayment: "0",
    voucherCode: "",
    price: price ?? 0,
    paidCash,
    paidCard,
  };
  const [voucherOpen, setVoucherOpen] = useState(false);
  // Payment date (payment_events.created_at). Defaults to today; a receptionist may back-date
  // a payment collected earlier but entered late. Kept tucked behind a small icon (rarely used,
  // delicate). New Booking / companions never touch this.
  const [paymentDate, setPaymentDate] = useState<Date | null>(() => todayBusiness());
  const [dateOpen, setDateOpen] = useState(false);
  const { submitting, guard } = useSubmitGuard();
  const methods = useForm<
    BookingPaymentFormInput,
    any,
    BookingPaymentFormOutput
  >({
    resolver: zodResolver(BookingPaymentSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    methods.reset(defaultValues);
    setVoucherOpen(false);
    setPaymentDate(todayBusiness());
    setDateOpen(false);
  }, [price, open]);

  // Is the picked day before today (Madrid)? Drives the escalated back-dating warning.
  const pickedDay = paymentDate
    ? DateTime.fromJSDate(paymentDate).setZone(BUSINESS_TIMEZONE).startOf("day")
    : null;
  const isBackdated = pickedDay
    ? pickedDay < DateTime.now().setZone(BUSINESS_TIMEZONE).startOf("day")
    : false;

  // Live preview of what the receptionist is about to record — drives the dynamic
  // Save button label so the method(s) are the last thing they read before commit.
  const [watchedCash, watchedCard, watchedVoucher] = useWatch({
    control: methods.control,
    name: ["cashPayment", "cardPayment", "voucherPayment"],
  });

  const parseAmount = (v: unknown): number => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const cashN    = parseAmount(watchedCash);
  const cardN    = parseAmount(watchedCard);
  const voucherN = parseAmount(watchedVoucher);

  const methodSegments: { color: string; text: string; key: string }[] = [];
  if (cashN > 0)    methodSegments.push({ color: METHOD_COLORS.cash,    text: `${formatMoney(cashN)} ${t("cash")}`,       key: "cash" });
  if (cardN > 0)    methodSegments.push({ color: METHOD_COLORS.card,    text: `${formatMoney(cardN)} ${t("card")}`,       key: "card" });
  if (voucherN > 0) methodSegments.push({ color: METHOD_COLORS.voucher, text: `${formatMoney(voucherN)} ${t("voucher")}`, key: "voucher" });

  const onSubmit = (data: BookingPaymentFormOutput) =>
    guard(async () => {
      if (!bookingId) return;
      // Record the payment on the picked calendar day, at the current time-of-day (Madrid),
      // so a same-day entry matches now() and a back-dated one lands on that day's totals.
      let paymentDateIso: string | undefined;
      if (paymentDate) {
        const nowMad = DateTime.now().setZone(BUSINESS_TIMEZONE);
        paymentDateIso =
          DateTime.fromJSDate(paymentDate)
            .setZone(BUSINESS_TIMEZONE)
            .set({
              hour: nowMad.hour,
              minute: nowMad.minute,
              second: nowMad.second,
              millisecond: nowMad.millisecond,
            })
            .toISO() ?? undefined;
      }
      const success = await handleSubmitPayBooking({
        ...data,
        id: bookingId,
        paymentDate: paymentDateIso,
      });
      if (success) {
        onPaymentSuccess();
        onClose();
      }
    });

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>{t("payBooking")}</DialogTitle>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent>
            <Grid
              container
              spacing={{ xs: 1, xl: 2 }}
            >
              <Grid size={12}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    {tCommon("atLeastOnePaymentRequired")}
                  </Typography>
                  <Tooltip title={t("paymentDateAction")}>
                    <IconButton
                      size="small"
                      onClick={() => setDateOpen((prev) => !prev)}
                      color={isBackdated ? "warning" : "default"}
                      sx={{ p: 0.25, opacity: isBackdated ? 1 : 0.5 }}
                    >
                      <EditCalendarIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                {/* Never hide an armed back-date silently: flag it even while the panel is closed. */}
                {!dateOpen && isBackdated && (
                  <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.25 }}>
                    {t("paymentDateArmed", { date: pickedDay?.toFormat("dd/MM/yyyy") ?? "" })}
                  </Typography>
                )}
                <Collapse in={dateOpen} unmountOnExit>
                  <Box
                    sx={{
                      mt: 1,
                      p: 1.5,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    {isBackdated ? (
                      <Alert
                        severity="warning"
                        sx={{ py: 0, fontSize: "0.72rem", "& .MuiAlert-message": { py: 0.75 } }}
                      >
                        {t("paymentDateBackdatedWarning", {
                          date: pickedDay?.toFormat("dd/MM/yyyy") ?? "",
                        })}
                      </Alert>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        {t("paymentDateTodayHint")}
                      </Typography>
                    )}
                    <BusinessDatePicker
                      value={paymentDate}
                      onChange={setPaymentDate}
                      disableFuture
                      slotProps={{
                        textField: { size: "small", label: t("paymentDateLabel"), fullWidth: true },
                      }}
                    />
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setPaymentDate(todayBusiness());
                          setDateOpen(false);
                        }}
                      >
                        {t("paymentDateReset")}
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </Grid>
              <Grid size={6}>
                <Controller
                  name="cashPayment"
                  control={methods.control}
                  render={({ field }) => (
                    <MethodAmountField
                      {...field}
                      kind="cash"
                      value={field.value === "0" ? "" : field.value}
                      label={t("cash")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.cashPayment}
                      helperText={methods.formState.errors.cashPayment?.message}
                      slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      onChange={(e) => {
                        field.onChange(normalizeMoneyInput(e.target.value));
                      }}
                    />
                  )}
                ></Controller>
              </Grid>
              <Grid size={6}>
                <Controller
                  name="cardPayment"
                  control={methods.control}
                  render={({ field }) => (
                    <MethodAmountField
                      {...field}
                      kind="card"
                      value={field.value === "0" ? "" : field.value}
                      label={t("card")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.cardPayment}
                      helperText={methods.formState.errors.cardPayment?.message}
                      slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      onChange={(e) => {
                        field.onChange(normalizeMoneyInput(e.target.value));
                      }}
                    />
                  )}
                ></Controller>
              </Grid>
              <Grid size={12}>
                <Divider
                  onClick={() => {
                    if (voucherOpen) {
                      methods.setValue("voucherCode", "");
                      methods.setValue("voucherPayment", "0");
                    }
                    setVoucherOpen((prev) => !prev);
                  }}
                  sx={{ cursor: "pointer", userSelect: "none" }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                  >
                    {voucherOpen ? <ExpandLessIcon fontSize="inherit" /> : <ExpandMoreIcon fontSize="inherit" />}
                    {t("voucher")}
                  </Typography>
                </Divider>
              </Grid>
              <Grid size={12}>
                <Collapse in={voucherOpen} unmountOnExit>
                  <Grid container spacing={{ xs: 1, xl: 2 }}>
                    <Grid size={6}>
                      <VoucherPickerField
                        key={String(open) + String(voucherOpen)}
                        control={methods.control}
                        voucherCodeName="voucherCode"
                        remainingAmount={Math.max(0, price - paidCash - paidCard - paidVoucher)}
                        onSetVoucherPayment={(val) => methods.setValue("voucherPayment", val)}
                      />
                    </Grid>
                    <Grid size={6}>
                      <Controller
                        name="voucherPayment"
                        control={methods.control}
                        render={({ field }) => (
                          <MethodAmountField
                            {...field}
                            kind="voucher"
                            value={field.value === "0" ? "" : field.value}
                            label={t("voucherAmount")}
                            fullWidth
                            size="small"
                            error={!!methods.formState.errors.voucherPayment}
                            helperText={methods.formState.errors.voucherPayment?.message}
                            slotProps={{ htmlInput: { inputMode: "decimal" } }}
                            onChange={(e) => {
                              field.onChange(normalizeMoneyInput(e.target.value));
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Collapse>
              </Grid>
              <input type="hidden" {...methods.register("price")} />
              <input type="hidden" {...methods.register("paidCash")} />
              <input type="hidden" {...methods.register("paidCard")} />

              {(methods.formState.errors as any).payment_form?.message && (
                <Container sx={{ marginBottom: 2 }}>
                  <Alert severity="error" variant="standard">
                    {(methods.formState.errors as any).payment_form.message}
                  </Alert>
                </Container>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} startIcon={<CloseIcon />} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button color="success" type="submit" startIcon={<AddCircleIcon />} disabled={submitting}>
              {t("addPayment")}
              {methodSegments.length > 0 && (
                <>
                  <Box component="span" sx={{ mx: 0.75 }}>·</Box>
                  {methodSegments.map((seg, i) => (
                    <Box key={seg.key} component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                      {i > 0 && <Box component="span" sx={{ mx: 0.5 }}>+</Box>}
                      <Box component="span" sx={{ color: seg.color, fontWeight: 700 }}>{seg.text}</Box>
                    </Box>
                  ))}
                </>
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {submitting && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <CircularProgress />
        </div>
      )}
    </>
  );
};

export default PayBookingDialogForm;
