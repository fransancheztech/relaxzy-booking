"use client";

import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import { Paper, Tooltip, CircularProgress } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";
import { therapists } from "generated/prisma/client";

interface Props {
  therapists: therapists[];
  rowCount: number;
  page: number;
  loading: boolean;
  fetchError: string | null;
  loadTherapists: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" }
  ) => void;
  onEdit: (id: string) => void;
}

const TherapistsTable = ({
  therapists,
  rowCount,
  page,
  loading,
  fetchError,
  loadTherapists,
  onEdit,
}: Props) => {
  const columns: GridColDef<therapists>[] = [
    { field: "full_name", headerName: "Full Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    { field: "notes", headerName: "Notes", flex: 1 },
    { field: "active", headerName: "Active", flex: 1 },
    {
      field: "created_at",
      headerName: "Created",
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
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={
            <Tooltip title="Edit">
              <EditIcon color="primary" />
            </Tooltip>
          }
          label="Edit"
          onClick={() => onEdit(params.row.id)}
        />,
      ],
      sortable: false,
      filterable: false,
    },
  ];

  return (
    <Paper
      elevation={2}
      sx={{
        maxHeight: "calc(100vh - 144px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {loading && <CircularProgress sx={{ alignSelf: "center", m: 2 }} />}
      <DataGrid
        rows={therapists}
        columns={columns}
        getRowId={(row) => row.id}
        rowCount={rowCount}
        pagination
        paginationMode="server"
        sortingMode="server"
        pageSizeOptions={[5, 10, 25]}
        paginationModel={{ page, pageSize: 5 }}
        onPaginationModelChange={(model) => loadTherapists(model.page)}
        onSortModelChange={(model) => {
          if (!model.length) return;
          const sortItem = model[0];
          if (!sortItem.sort) return;
          loadTherapists(0, { field: sortItem.field, sort: sortItem.sort });
        }}
        slots={{
          loadingOverlay: LoadingOverlay,
          noRowsOverlay: () => <NoRowsOverlay error={fetchError} />,
        }}
        sx={{ opacity: loading ? 0.5 : 1, backgroundColor: loading ? "#ddd" : "" }}
      />
    </Paper>
  );
};

export default TherapistsTable;
