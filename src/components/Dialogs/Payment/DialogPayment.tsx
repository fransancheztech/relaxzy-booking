import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";
import DialogRefund from "./DialogRefund";
import { useEffect, useState } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { payment_events as PaymentEventType } from "generated/prisma";

interface Props {
  open: boolean;
  onClose: () => void;
  paymentId: string | null;
  setPaymentId: (paymentId: string | null) => void;
  loadPayments: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" }
  ) => void;
}

const LoadingOverlay = () => (
  <Box
    sx={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CircularProgress />
  </Box>
);

const NoRowsOverlay = ({ error }: { error: string | null }) => (
  <Box
    sx={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: error ? "error.main" : "text.secondary",
    }}
  >
    {error ? `Error loading payments: ${error}` : "No payments found"}
  </Box>
);

const DialogPayment = ({ open, onClose, paymentId, setPaymentId, loadPayments }: Props) => {
  const [isOpenRefundPaymentDialog, setIsOpenRefundPaymentDialog] =
    useState(false);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const closeRefundPaymentDialog = () => {
    setIsOpenRefundPaymentDialog(false);
    setPaymentId(null);
  };

  // -------------------------------
  // Load paginated payments normally
  // -------------------------------
  async function loadPaymentEvents(paymentId: string) {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/payments/${paymentId}/events`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        console.error("Failed to load payment events");
        return;
      }

      const data = await res.json();
      setPaymentEvents(data);
    } catch (err) {
      console.error(err);
      setPaymentEvents([]);
      setFetchError("Error loading payment events");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef[] = [
    { field: "type", headerName: "Type", flex: 1 },
    { field: "method", headerName: "Method", flex: 1 },
    { field: "amount", headerName: "Amount", flex: 1 },
    {
      field: "created_at",
      headerName: "Created at",
      type: "dateTime",
      flex: 1,
      valueGetter: (_, row) =>
        row.created_at ? new Date(row.created_at) : null,
      valueFormatter: (value: Date | null) =>
        value
          ? value.toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })
          : "",
    },
    { field: "performed_by", headerName: "Performed by", flex: 1 },
  ];

  useEffect(() => {
    if (open && paymentId && paymentEvents.length === 0) {
      loadPaymentEvents(paymentId);
    }
  }, [open, paymentId]);

  useEffect(() => {
    if (!open) {
      setPaymentEvents([]);
    }
  }, [open]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              height: "70vh", // FIXED dialog height
              maxHeight: "70vh",
            },
          },
        }}
      >
        <DialogTitle>View Payment</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden", // critical
          }}
        >
          <Paper
            elevation={2}
            sx={{
              minHeight: 0, // VERY important for flex + scrolling
              display: "flex",
              flex: 1,
            }}
          >
            <DataGrid
              rows={paymentEvents}
              columns={columns}
              getRowId={(row) => row.id}
              hideFooter
              loading={loading}
              initialState={{
                sorting: {
                  sortModel: [{ field: "created_at", sort: "desc" }],
                },
              }}
              slots={{
                loadingOverlay: LoadingOverlay,
                noRowsOverlay: () => <NoRowsOverlay error={fetchError} />,
              }}
              sx={{
                flex: 1,
                opacity: loading ? "0.5" : "1",
                backgroundColor: loading ? "#ddd" : "",
              }}
            />
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} color="error" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<UndoIcon />}
            color="warning"
            onClick={() => setIsOpenRefundPaymentDialog(true)}
          >
            Refund
          </Button>
        </DialogActions>
      </Dialog>

      {/*Inner Dialog for refunds*/}
      <DialogRefund
        open={isOpenRefundPaymentDialog}
        onClose={closeRefundPaymentDialog}
        paymentId={paymentId}
        loadPayments={loadPayments}
        loadPaymentEvents={loadPaymentEvents}
      />
    </>
  );
};

export default DialogPayment;
