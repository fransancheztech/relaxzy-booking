import {
  Container,
  Paper,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import { FETCH_LIMIT } from "@/constants";
import { clients as ClientType } from "generated/prisma/client";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";

interface Props {
  setSelectedClientId: (id: string) => void;
  setIsOpenEditClientDialog: (open: boolean) => void;
  clients: ClientType[];
  rowCount: number;
  page: number;
  loadClients: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
    search?: string,
  ) => void;
  searchTerm: string;
  setSearchTerm: (text: string) => void;
  debouncedSearch: (text: string) => void;
  loading: boolean;
  fetchError: string | null;
}

export const ClientsTable = ({
  setSelectedClientId,
  setIsOpenEditClientDialog,
  clients,
  rowCount,
  page,
  loadClients,
  loading,
  fetchError,
}: Props) => {
  const columns: GridColDef[] = [
    { field: "client_name", headerName: "Name", flex: 1 },
    { field: "client_surname", headerName: "Surname", flex: 1 },
    { field: "client_email", headerName: "Email", flex: 1 },
    { field: "client_phone", headerName: "Phone", flex: 1 },
    { field: "client_notes", headerName: "Notes", flex: 1 },
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
          rows={clients}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          sortingMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadClients(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            if (model.length === 0) return;

            const sortItem = model[0];

            if (!sortItem.sort) return; // guard against undefined

            loadClients(0, {
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
