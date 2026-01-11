import { Container, Paper, Stack, TextField, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { FETCH_LIMIT } from "@/constants";
import { bookings as BookingType } from "generated/prisma/client";

interface Props {
  setSelectedBookingId: (id: string) => void;
  setIsOpenEditBookingDialog: (open: boolean) => void;
  setIsOpenConfirmDelete: (open: boolean) => void;
  bookings: BookingType[];
  rowCount: number;
  page: number;
  loadBookings: (pageToLoad: number) => void;
  searchTerm: string;
  setSearchTerm: (text: string) => void;
  debouncedSearch: (text: string) => void;
}

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
    { field: "customer_name", headerName: "Customer", flex: 1 },
    {
      field: "service",
      headerName: "Service",
      flex: 1,
      valueGetter: (params: any) => {
        console.log(JSON.stringify(params, null, 2));
        return params.name || "";
      },
    },
    { field: "date", headerName: "Date", flex: 1 },
    { field: "time", headerName: "Time", flex: 1 },
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
        />
      </Paper>
    </Container>
  );
};
