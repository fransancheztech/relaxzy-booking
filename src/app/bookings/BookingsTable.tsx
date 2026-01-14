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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { FETCH_LIMIT } from "@/constants";
import { bookings as BookingType } from "generated/prisma/client";
import { BookingListItem } from "@/types/bookings";

interface Props {
  setSelectedBookingId: (id: string) => void;
  setIsOpenEditBookingDialog: (open: boolean) => void;
  setIsOpenConfirmDelete: (open: boolean) => void;
  bookings: BookingListItem[];
  rowCount: number;
  page: number;
  loadBookings: (pageToLoad: number) => void;
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
    {error ? `Error loading bookings: ${error}` : "No bookings found"}
  </Box>
);

export const BookingsTable = ({
  setSelectedBookingId,
  setIsOpenEditBookingDialog,
  setIsOpenConfirmDelete,
  bookings,
  rowCount,
  page,
  loadBookings,
  searchTerm,
  setSearchTerm,
  debouncedSearch,
  loading,
  fetchError,
}: Props) => {
  const handleSearch = (text: string) => {
    setSearchTerm(text);
    debouncedSearch(text);
  };

  const confirmDeleteBooking = (id: string) => {
    setSelectedBookingId(id);
    setIsOpenConfirmDelete(true);
  };

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef[] = [
    {
      field: "customer_name",
      headerName: "Customer",
      flex: 1,
      valueGetter: (_, row) =>
        row.client
          ? `${row.client.name ?? ""} ${row.client.surname ?? ""}`.trim()
          : "",
    },
    {
      field: "customer_phone",
      headerName: "Phone",
      flex: 1,
      valueGetter: (_, row) =>
        row.client ? `${row.client.phone ?? ""}`.trim() : "",
    },
    {
      field: "service",
      headerName: "Service",
      flex: 1,
      valueGetter: (_, row) =>
        row.service?.short_name ?? row.service?.name ?? "",
    },
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      valueGetter: (_, row) =>
        row.start_time
          ? new Date(row.start_time).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
    },
    {
      field: "time",
      headerName: "Time",
      flex: 1,
      valueGetter: (_, row) =>
        row.start_time
          ? `${new Date(row.start_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "",
    },
    {
      field: "duration",
      headerName: "Duration",
      flex: 1,
      valueGetter: (_, row) => {
        if (row.start_time && row.end_time) {
          const start = new Date(row.start_time).getTime();
          const end = new Date(row.end_time).getTime();
          const diffMinutes = Math.round((end - start) / 60000); // 60000 ms = 1 min
          return `${diffMinutes} min`;
        }
        return ""; // if either date is missing
      },
    },
    {
      field: "price",
      headerName: "Price",
      flex: 1,
      valueGetter: (_, row) => {
        if (!row.price) return "";
        const priceNumber = Number(row.price);
        return (
          new Intl.NumberFormat("es-ES", {
            minimumFractionDigits: priceNumber % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
          }).format(priceNumber) + " €"
        );
      },
    },
    {
      field: "paid",
      headerName: "Paid",
      flex: 1,
      valueGetter: (_, row) => {
        const payments: { amount: string }[] = row.payments;
        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        return (
          new Intl.NumberFormat("es-ES", {
            minimumFractionDigits: total % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
          }).format(total) + " €"
        );
      },
    },

    { field: "notes", headerName: "Notes", flex: 1 },

    // Actions column
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title="Edit">
              <EditIcon color="primary" />
            </Tooltip>
          }
          label="Edit"
          onClick={() => {
            setSelectedBookingId(params.row.id);
            setIsOpenEditBookingDialog(true);
          }}
          key="edit"
        />,
        <GridActionsCellItem
          icon={
            <Tooltip title="Delete">
              <DeleteIcon color="error" />
            </Tooltip>
          }
          label="Delete"
          onClick={() => confirmDeleteBooking(params.row.id)}
          key="delete"
        />,
      ],
    },
  ];

  return (
    <Container sx={{ py: 3 }} disableGutters>
      {/* Search */}
      <Stack spacing={2} mb={2}>
        <TextField
          label="Search bookings"
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
          rows={bookings}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadBookings(model.page)}
          loading={loading}
          slots={{
            loadingOverlay: LoadingOverlay,
            noRowsOverlay: () => <NoRowsOverlay error={fetchError} />,
          }}
          sx={{ opacity: loading ? "0.5" : "1", backgroundColor: loading ? "#ddd" : "" }}
        />
      </Paper>
    </Container>
  );
};
