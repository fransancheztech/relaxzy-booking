"use client";

import {
  Container,
  Paper,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef, GridFilterModel } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import { FETCH_LIMIT } from "@/constants";
import { clients as ClientType } from "generated/prisma/client";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
import { GridFilterItem } from "@mui/x-data-grid";
import { useTranslations } from "next-intl";

interface Props {
  setSelectedClientId: (id: string) => void;
  setIsOpenEditClientDialog: (open: boolean) => void;
  clients: ClientType[];
  rowCount: number;
  page: number;
  loadClients: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
    filters?: GridFilterItem[],
  ) => void;
  onFilterModelChange: (model: GridFilterModel) => void;
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
  onFilterModelChange,
  loading,
  fetchError,
}: Props) => {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");

  const columns: GridColDef[] = [
    { field: "client_name", headerName: t("name"), flex: 1, valueFormatter: formatNullable },
    { field: "client_surname", headerName: t("surname"), flex: 1, valueFormatter: formatNullable },
    { field: "client_email", headerName: t("email"), flex: 1, valueFormatter: formatNullable },
    { field: "client_phone", headerName: t("phone"), flex: 1, valueFormatter: formatNullable },
    { field: "client_notes", headerName: t("notes"), flex: 1, valueFormatter: formatNullable },
    {
      field: "created_at",
      headerName: t("created"),
      type: "dateTime",
      flex: 1,
      valueGetter: (_, row) =>
        row.created_at ? new Date(row.created_at) : null,
      valueFormatter: formatDateTime,
    },
    {
      field: "actions",
      type: "actions",
      headerName: t("actions"),
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title={tCommon("edit")}>
              <EditIcon color="primary" />
            </Tooltip>
          }
          label={tCommon("edit")}
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
          filterMode="server"
          onFilterModelChange={onFilterModelChange}
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadClients(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            const sortItem = model[0];
            loadClients(0, sortItem?.sort
              ? { field: sortItem.field, sort: sortItem.sort }
              : { field: "created_at", sort: "desc" }
            );
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
