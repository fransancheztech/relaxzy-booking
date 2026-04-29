import {
  Alert,
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
  TextField,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookingPaymentSchema,
  BookingPaymentFormInput,
  BookingPaymentFormOutput,
} from "@/schemas/bookingPayment.schema";
import handleSubmitPayBooking from "@/handlers/handleSubmitPayBooking";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";
import VoucherPickerField from "./VoucherPickerField";

interface DialogFormProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  price: number;
  paidCash: number;
  paidCard: number;
  onPaymentSuccess: () => void;
}

const PayBookingDialogForm = ({
  open,
  onClose,
  bookingId,
  price,
  paidCash,
  paidCard,
  onPaymentSuccess,
}: DialogFormProps) => {
  const defaultValues = {
    cashPayment: "0",
    cardPayment: "0",
    voucherPayment: "0",
    voucherCode: "",
    price: price ?? 0,
    paidCash,
    paidCard,
  };
  const [loading, setLoading] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
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

  const onSubmit = async (data: BookingPaymentFormOutput) => {
    if (!bookingId) return;
    setLoading(true);

    const success = await handleSubmitPayBooking({
      ...data,
      id: bookingId,
    });

    if (success) {
      onPaymentSuccess();
      onClose();
    }

    setLoading(false);
  };

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>Pay Booking</DialogTitle>
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
                    <TextField
                      {...field}
                      value={field.value === "0" ? "" : field.value}
                      label="Cash"
                      fullWidth
                      size="small"
                      variant="outlined"
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
                    <TextField
                      {...field}
                      value={field.value === "0" ? "" : field.value}
                      label="Credit card"
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
                    Voucher
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
                        setValue={methods.setValue}
                        remainingAmount={Math.max(0, price - paidCash - paidCard)}
                      />
                    </Grid>
                    <Grid size={6}>
                      <Controller
                        name="voucherPayment"
                        control={methods.control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            value={field.value === "0" ? "" : field.value}
                            label="Voucher Amount"
                            fullWidth
                            size="small"
                            variant="outlined"
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
            <Button onClick={onCancel} startIcon={<CloseIcon />}>
              Cancel
            </Button>
            <Button color="success" type="submit" startIcon={<AddCircleIcon />}>
              Add Payment
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {loading && (
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
