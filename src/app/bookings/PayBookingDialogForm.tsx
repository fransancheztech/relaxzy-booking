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
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
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
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

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
  }, [price, open]);

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
      const success = await handleSubmitPayBooking({
        ...data,
        id: bookingId,
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
              sx={{ paddingTop: "1rem" }}
              spacing={{ xs: 1, xl: 2 }}
            >
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
