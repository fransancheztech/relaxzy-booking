"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import { formatMoney } from "@/utils/formatMoney";
import { toast } from "react-toastify";
import VoucherPaymentEventDialog from "./VoucherPaymentEventDialog";

type PaymentEvent = {
  id: string;
  amount: string | null;
  type: "CHARGE" | "REFUND" | null;
  method: "cash" | "credit_card" | null;
  notes: string | null;
  created_at: string;
};

type VoucherUse = {
  id: string;
  amount: string;
  notes: string | null;
  booking_id: string | null;
  created_at: string | null;
};

type Details = {
  voucher: {
    id: string;
    code: string;
    balance: string | null;
    expiration_date: string;
    notes: string | null;
  };
  paymentEvents: PaymentEvent[];
  voucherUses: VoucherUse[];
};

type Props = {
  voucherId: string;
  open: boolean;
  onClose: () => void;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const VoucherDetailDialog = ({ voucherId, open, onClose }: Props) => {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogMode, setPaymentDialogMode] = useState<"charge" | "refund">("charge");
  const [selectedEvent, setSelectedEvent] = useState<PaymentEvent | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/vouchers/${voucherId}/details`);
      if (!res.ok) {
        setFetchError("Error loading voucher details");
        return;
      }
      setDetails(await res.json());
    } catch {
      setFetchError("Error loading voucher details");
    } finally {
      setLoading(false);
    }
  }, [voucherId]);

  useEffect(() => {
    if (open && voucherId) loadDetails();
  }, [open, voucherId, loadDetails]);

  const handlePaymentSuccess = useCallback(() => {
    loadDetails();
    window.dispatchEvent(new CustomEvent("refreshVouchersData"));
  }, [loadDetails]);

  const handleDeleteUse = async (use: VoucherUse) => {
    if (!window.confirm(`Delete voucher use of ${formatMoney(Number(use.amount))}? This will restore the balance.`)) return;
    setDeletingId(use.id);
    try {
      const res = await fetch(`/api/voucher-uses/${use.id}/delete`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error || "Error deleting voucher use");
        return;
      }
      toast.success("Voucher use deleted");
      loadDetails();
      window.dispatchEvent(new CustomEvent("refreshVouchersData"));
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  const openRefund = (event: PaymentEvent) => {
    setSelectedEvent(event);
    setPaymentDialogMode("refund");
    setPaymentDialogOpen(true);
  };

  const openAddBalance = () => {
    setSelectedEvent(null);
    setPaymentDialogMode("charge");
    setPaymentDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <span>Voucher {details?.voucher.code ?? ""}</span>
            {details?.voucher.balance != null && (
              <Chip
                label={`Balance: ${formatMoney(Number(details.voucher.balance))}`}
                color="success"
                size="small"
              />
            )}
          </Box>
          <Button
            startIcon={<AddCircleIcon />}
            onClick={openAddBalance}
            variant="contained"
            color="success"
            size="small"
            disabled={loading}
          >
            Add Balance
          </Button>
        </DialogTitle>

        <DialogContent>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {fetchError && <Alert severity="error">{fetchError}</Alert>}

          {details && !loading && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Payment Events
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.paymentEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                        No payment events
                      </TableCell>
                    </TableRow>
                  )}
                  {details.paymentEvents.map((pe) => (
                    <TableRow key={pe.id}>
                      <TableCell>
                        {pe.amount != null ? formatMoney(Number(pe.amount)) : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pe.type ?? "—"}
                          color={pe.type === "CHARGE" ? "success" : "warning"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {pe.method === "cash"
                          ? "Cash"
                          : pe.method === "credit_card"
                            ? "Credit Card"
                            : "—"}
                      </TableCell>
                      <TableCell>{pe.notes ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(pe.created_at)}</TableCell>
                      <TableCell align="center">
                        {pe.type === "CHARGE" && (
                          <Tooltip title="Refund">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => openRefund(pe)}
                            >
                              <CurrencyExchangeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                Voucher Uses
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Booking</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.voucherUses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                        No voucher uses
                      </TableCell>
                    </TableRow>
                  )}
                  {details.voucherUses.map((vu) => (
                    <TableRow key={vu.id}>
                      <TableCell>{formatMoney(Number(vu.amount))}</TableCell>
                      <TableCell>{vu.booking_id ?? "—"}</TableCell>
                      <TableCell>{vu.notes ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(vu.created_at)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Delete">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteUse(vu)}
                              disabled={deletingId === vu.id}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <VoucherPaymentEventDialog
        open={paymentDialogOpen}
        mode={paymentDialogMode}
        voucherId={voucherId}
        defaultAmount={
          selectedEvent?.amount != null ? Number(selectedEvent.amount) : undefined
        }
        defaultMethod={selectedEvent?.method ?? undefined}
        onClose={() => setPaymentDialogOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
};

export default VoucherDetailDialog;
