import {
  Box,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { FETCH_LIMIT } from "@/constants";
import { payments as PaymentsType } from "generated/prisma/client";

interface Props {
  setSelectedPaymentId: (id: string) => void;
  setIsOpenViewPaymentDialog: (open: boolean) => void;
  setIsOpenRefundPaymentDialog: (open: boolean) => void;
  setConfirmRefundOpen: (open: boolean) => void;
  payments: PaymentsType[];
  rowCount: number;
  page: number;
  loadPayments: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" }
  ) => void;
  searchTerm: string;
  setSearchTerm: (text: string) => void;
  debouncedSearch: (text: string) => void;
  loading: boolean;
  fetchError: string | null;
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
    {error ? `Error loading payments: ${error}` : "No payment events found"}
  </Box>
);

export const PaymentsTable = ({
  setSelectedPaymentId,
  setIsOpenViewPaymentDialog,
  setIsOpenRefundPaymentDialog,
  setConfirmRefundOpen,
  payments,
  rowCount,
  page,
  loadPayments,
  searchTerm,
  setSearchTerm,
  debouncedSearch,
  loading,
  fetchError,
}: Props) => {
  function handleSearch(text: string) {
    setSearchTerm(text);
    debouncedSearch(text);
  }

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef[] = [
    { field: "booking_id", headerName: "Bookind ID", flex: 1 },
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
    // { field: "paid_at", headerName: "Date", flex: 1 },
    // { field: "refunded", headerName: "Amount Refunded", flex: 1 },
    // { field: "refunded_at", headerName: "Date Refund", flex: 1 },
    // { field: "client_data", headerName: "Client", flex: 1 },
    // { field: "booking_data", headerName: "Booking", flex: 1 },
    // { field: "notes", headerName: "Notes", flex: 1 },

    // Actions column
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title="View">
              <VisibilityIcon color="primary" />
            </Tooltip>
          }
          label="View"
          onClick={() => {
            setSelectedPaymentId(params.row.id);
            setIsOpenViewPaymentDialog(true);
          }}
          key="view"
        />,
      ],
    },
  ];

  return (
    <Container sx={{ py: 3 }} disableGutters>
      {/* Search */}
      <Stack spacing={2} mb={2}>
        <TextField
          label="Search payments"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          fullWidth
        />
      </Stack>
      <Paper
        elevation={2}
        sx={{
          maxHeight: "calc(100vh - 186px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DataGrid
          rows={payments}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          sortingMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadPayments(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            if (model.length === 0) return;

            const sortItem = model[0];

            if (!sortItem.sort) return; // guard against undefined

            loadPayments(0, {
              field: sortItem.field,
              sort: sortItem.sort,
            });
          }}
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
            opacity: loading ? "0.5" : "1",
            backgroundColor: loading ? "#ddd" : "",
          }}
        />
      </Paper>
    </Container>
  );
};
