import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { payment_methods } from "generated/prisma";

import {
  PaymentRefundSchema,
  PaymentRefundFormInput,
  PaymentRefundFormOutput,
} from "@/schemas/paymentRefund.schema";
import handleSubmitRefund from "@/handlers/handleSubmitRefund";
import { normalizeMoneyInput } from "@/utils/normalizeMoney";

interface Props {
  open: boolean;
  onClose: () => void;
  paymentId: string | null;
  loadPayments: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
  ) => void;
  loadPaymentEvents: (paymentId: string) => void;
}

const DialogRefund = ({
  open,
  onClose,
  paymentId,
  loadPayments,
  loadPaymentEvents,
}: Props) => {
  const [loading, setLoading] = useState(false);

  const methods = useForm<PaymentRefundFormInput, any, PaymentRefundFormOutput>(
    {
      resolver: zodResolver(PaymentRefundSchema),
      defaultValues: {
        amount: "0",
        method: "cash",
        notes: "",
      },
    },
  );

  useEffect(() => {
    if (!open) return;
    methods.reset({
      amount: "0",
      method: "cash",
      notes: "",
    });
  }, [open]);

  const onSubmit = async (data: PaymentRefundFormOutput) => {
    if (!paymentId) return;
    setLoading(true);
    const { success, error } = await handleSubmitRefund({
      paymentId,
      ...data,
    });

    setLoading(false);

    if (success) {
      loadPaymentEvents(paymentId);
      loadPayments(0);
      onClose();
    } else {
      methods.setError("root", {
        message: error,
      });
    }
  };

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Refund Payment</DialogTitle>

      <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={12}>
              <Controller
                name="amount"
                control={methods.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value === "0" ? "" : field.value}
                    label="Refund amount"
                    fullWidth
                    size="small"
                    variant="outlined"
                    error={!!methods.formState.errors.amount}
                    helperText={methods.formState.errors.amount?.message}
                    slotProps={{ htmlInput: { inputMode: "decimal" } }}
                    onChange={(e) => {
                      field.onChange(normalizeMoneyInput(e.target.value));
                    }}
                  />
                )}
              />
            </Grid>

            <Grid size={12}>
              <Controller
                name="method"
                control={methods.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Method"
                    fullWidth
                    size="small"
                    error={!!methods.formState.errors.method}
                  >
                    {Object.values(payment_methods).map((method) => (
                      <MenuItem key={method} value={method}>
                        {method}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid size={12}>
              <Controller
                name="notes"
                control={methods.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notes"
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                  />
                )}
              />
            </Grid>

            {methods.formState.errors.root?.message && (
              <Grid size={12}>
                <Alert severity="error">
                  {methods.formState.errors.root.message}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button
            color="error"
            onClick={onCancel}
            startIcon={<CloseIcon />}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            color="warning"
            type="submit"
            startIcon={<UndoIcon />}
            disabled={loading}
            variant="contained"
          >
            Refund
          </Button>
        </DialogActions>
      </form>

      {loading && (
        <CircularProgress
          size={48}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </Dialog>
  );
};

export default DialogRefund;
