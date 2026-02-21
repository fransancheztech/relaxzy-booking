import { Container, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import { FETCH_LIMIT } from "@/constants";
import { BookingListItem } from "@/types/bookings";
import LoadingOverlay from "@/components/LoadingOverlay";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import { formatMoney } from "@/utils/formatMoney";

interface Props {
  setSelectedBookingId: (id: string) => void;
  setIsOpenEditBookingDialog: (open: boolean) => void;
  bookings: BookingListItem[];
  rowCount: number;
  page: number;
  loadBookings: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
  ) => void;
  debouncedSearch: (text: string) => void;
  loading: boolean;
  fetchError: string | null;
}

export const BookingsTable = ({
  setSelectedBookingId,
  setIsOpenEditBookingDialog,
  bookings,
  rowCount,
  page,
  loadBookings,
  loading,
  fetchError,
}: Props) => {
  const columns: GridColDef<BookingListItem>[] = [
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
        row.start_time ? new Date(row.start_time) : null,

      valueFormatter: (value: Date | null) =>
        value
          ? value.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",

      sortComparator: (a, b) => a.getTime() - b.getTime(),
    },
    {
      field: "time",
      headerName: "Time",
      flex: 1,

      valueGetter: (_, row) =>
        row.start_time ? new Date(row.start_time) : null,

      valueFormatter: (value: Date | null) =>
        value
          ? value.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",

      sortComparator: (a, b) => a.getTime() - b.getTime(),
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
      valueFormatter: (value) => formatMoney(value),
    },
    {
      field: "paid",
      headerName: "Paid",
      flex: 1,
      valueGetter: (_, row) => {
        const payments: { amount: string }[] = row.payments;
        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return total;
      },
      valueFormatter: (value) => formatMoney(value),
    },

    { field: "notes", headerName: "Notes", flex: 1 },
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
    {
      field: "start_time",
      headerName: "Start time",
      type: "dateTime",
      valueGetter: (_, row) =>
        row.start_time ? new Date(row.start_time) : null,
    },

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
      ],
    },
  ];

  return (
    <Container sx={{ py: 3 }} disableGutters>
      <Paper
        elevation={2}
        sx={{
          maxHeight: "calc(100vh - 144px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DataGrid
          rows={bookings}
          columns={columns}
          columnVisibilityModel={{
            start_time: false,
          }}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          sortingMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadBookings(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            if (model.length === 0) return;

            const sortItem = model[0];

            if (!sortItem.sort) return; // guard against undefined

            loadBookings(0, {
              field: sortItem.field,
              sort: sortItem.sort,
            });
          }}
          initialState={{
            sorting: {
              sortModel: [{ field: "start_time", sort: "desc" }],
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
