import { FETCH_LIMIT } from "@/constants";
import { ServiceListItem } from "@/types/services";
import { Box, CircularProgress, Container, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

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
    {error ? `Error loading services: ${error}` : "No services found"}
  </Box>
);

interface Props {
  setSelectedServiceId: (id: string) => void;
  setIsOpenEditServiceDialog: (open: boolean) => void;
  setIsOpenConfirmDelete: (open: boolean) => void;
  services: ServiceListItem[];
  rowCount: number;
  page: number;
  loadServices: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
  ) => void;
  debouncedSearch: (text: string) => void;
  loading: boolean;
  fetchError: string | null;
}

const ServicesTable = ({
  setSelectedServiceId,
  setIsOpenEditServiceDialog,
  setIsOpenConfirmDelete,
  services,
  rowCount,
  page,
  loadServices,
  loading,
  fetchError,
}: Props) => {

  const openDeleteService = (id: string) => {
    setSelectedServiceId(id);
    setIsOpenConfirmDelete(true);
  };

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef<ServiceListItem>[] = [
    {
      field: "name",
      headerName: "Service Name",
      flex: 1,
    },
    {
      field: "short_name",
      headerName: "Short Name",
      flex: 1,
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
            setSelectedServiceId(params.row.id);
            setIsOpenEditServiceDialog(true);
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
          onClick={() => openDeleteService(params.row.id)}
          key="delete"
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
          rows={services}
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
          onPaginationModelChange={(model) => loadServices(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            if (model.length === 0) return;

            const sortItem = model[0];

            if (!sortItem.sort) return; // guard against undefined

            loadServices(0, {
              field: sortItem.field,
              sort: sortItem.sort,
            });
          }}
          initialState={{
            sorting: {
              sortModel: [{ field: "name", sort: "desc" }],
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

export default ServicesTable;
