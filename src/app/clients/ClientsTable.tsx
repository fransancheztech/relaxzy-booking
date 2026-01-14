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
import { clients as ClientType } from "generated/prisma/client";

interface Props {
  setSelectedClientId: (id: string) => void;
  setIsOpenEditClientDialog: (open: boolean) => void;
  setConfirmDeleteOpen: (open: boolean) => void;
  clients: ClientType[];
  rowCount: number;
  page: number;
  loadClients: (pageToLoad: number) => void;
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

export const ClientsTable = ({
  setSelectedClientId,
  setIsOpenEditClientDialog,
  setConfirmDeleteOpen,
  clients,
  rowCount,
  page,
  loadClients,
  searchTerm,
  setSearchTerm,
  debouncedSearch,
  loading,
  fetchError,
}: Props) => {
  const confirmDeleteClient = (id: string) => {
    setSelectedClientId(id);
    setConfirmDeleteOpen(true);
  };

  function handleSearch(text: string) {
    setSearchTerm(text);
    debouncedSearch(text);
  }

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef[] = [
    { field: "client_name", headerName: "Name", flex: 1 },
    { field: "client_surname", headerName: "Surname", flex: 1 },
    { field: "client_email", headerName: "Email", flex: 1 },
    { field: "client_phone", headerName: "Phone", flex: 1 },
    { field: "client_notes", headerName: "Notes", flex: 1 },

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
            setSelectedClientId(params.row.id);
            setIsOpenEditClientDialog(true);
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
          onClick={() => confirmDeleteClient(params.row.id)}
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
          label="Search clients"
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
          rows={clients}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadClients(model.page)}
          loading={loading}
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
