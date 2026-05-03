import { Chip, Container, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef, GridFilterModel, GridRenderCellParams } from "@mui/x-data-grid";
import { booking_status } from "generated/prisma";
import EditIcon from "@mui/icons-material/Edit";
import { FETCH_LIMIT } from "@/constants";
import { BookingListItem } from "@/types/bookings";
import LoadingOverlay from "@/components/LoadingOverlay";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import { formatMoney } from "@/utils/formatMoney";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";

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
  onFilterModelChange: (model: GridFilterModel) => void;
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
  onFilterModelChange,
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
      field: "therapist",
      headerName: "Therapist",
      flex: 1,
      valueGetter: (_, row) => row.therapist?.full_name ?? "",
      valueFormatter: formatNullable,
    },
    {
      field: "start_time",
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
      sortable: false,
      filterable: false,
      valueGetter: (_, row) =>
        row.start_time
          ? new Date(row.start_time).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
    },
    {
      field: "duration",
      headerName: "Duration",
      flex: 1,
      sortable: false,
      filterable: false,
      valueGetter: (_, row) => {
        if (row.start_time && row.end_time) {
          const start = new Date(row.start_time).getTime();
          const end = new Date(row.end_time).getTime();
          const diffMinutes = Math.round((end - start) / 60000);
          return `${diffMinutes} min`;
        }
        return "";
      },
    },
    {
      field: "status",
      headerName: "State",
      flex: 1,
      type: "singleSelect",
      valueOptions: [
        { value: "pending",   label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ],
      renderCell: (params: GridRenderCellParams<BookingListItem, booking_status>) => {
        const colorMap: Record<booking_status, "default" | "warning" | "info" | "success" | "error"> = {
          pending:   "warning",
          confirmed: "info",
          completed: "success",
          cancelled: "error",
        };
        const s = params.value;
        if (!s) return null;
        return (
          <Chip
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            color={colorMap[s] ?? "default"}
            size="small"
            variant="outlined"
          />
        );
      },
    },
    {
      field: "price",
      headerName: "Price",
      flex: 1,
      type: "number",
      valueFormatter: (value) => formatMoney(value),
    },
    {
      field: "paid",
      headerName: "Paid",
      flex: 1,
      sortable: false,
      filterable: false,
      valueGetter: (_, row) => {
        const payments: { amount: string }[] = row.payments;
        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return total;
      },
      valueFormatter: (value) => formatMoney(value),
    },
    {
      field: "notes",
      headerName: "Notes",
      flex: 1,
      valueFormatter: formatNullable,
    },
    {
      field: "created_at",
      headerName: "Created",
      type: "dateTime",
      flex: 1,
      valueGetter: (_, row) =>
        row.created_at ? new Date(row.created_at) : null,
      valueFormatter: formatDateTime,
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
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          onFilterModelChange={onFilterModelChange}
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadBookings(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            const sortItem = model[0];
            loadBookings(0, sortItem?.sort
              ? { field: sortItem.field, sort: sortItem.sort }
              : { field: "start_time", sort: "desc" }
            );
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
