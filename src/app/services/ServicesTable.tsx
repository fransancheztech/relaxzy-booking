"use client";

import { FETCH_LIMIT } from "@/constants";
import { services_names } from "generated/prisma/client";
import { Container, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useTranslations } from "next-intl";

interface Props {
  setSelectedServiceId: (id: string) => void;
  setIsOpenEditServiceDialog: (open: boolean) => void;
  setIsOpenConfirmDelete: (open: boolean) => void;
  services: services_names[];
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
  services,
  rowCount,
  page,
  loadServices,
  loading,
  fetchError,
}: Props) => {
  const t = useTranslations("Services");
  const tCommon = useTranslations("Common");

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef<services_names>[] = [
    {
      field: "name",
      headerName: t("serviceName"),
      flex: 1,
    },
    {
      field: "short_name",
      headerName: t("shortName"),
      flex: 1,
    },
    {
      field: "created_at",
      headerName: tCommon("created"),
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
      headerName: tCommon("actions"),
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title={tCommon("edit")}>
              <EditIcon color="primary" />
            </Tooltip>
          }
          label={tCommon("edit")}
          onClick={() => {
            setSelectedServiceId(params.row.id);
            setIsOpenEditServiceDialog(true);
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
