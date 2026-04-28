"use client";

import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import { Paper, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
import { therapists } from "generated/prisma/client";

interface Props {
  therapists: therapists[];
  rowCount: number;
  page: number;
  pageSize: number;
  loading: boolean;
  fetchError: string | null;
  loadTherapists: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
    limit?: number
  ) => void;
  onEdit: (id: string) => void;
}

const TherapistsTable = ({
  therapists,
  rowCount,
  page,
  pageSize,
  loading,
  fetchError,
  loadTherapists,
  onEdit,
}: Props) => {
  const columns: GridColDef<therapists>[] = [
    { field: "full_name", headerName: "Full Name", flex: 1, valueFormatter: formatNullable },
    { field: "email", headerName: "Email", flex: 1, valueFormatter: formatNullable },
    { field: "phone", headerName: "Phone", flex: 1, valueFormatter: formatNullable },
    { field: "notes", headerName: "Notes", flex: 1, valueFormatter: formatNullable },
    {
      field: "active",
      headerName: "Active",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) =>
        value
          ? <CheckCircleIcon fontSize="small" sx={{ color: "success.main" }} />
          : <CancelIcon fontSize="small" sx={{ color: "error.main" }} />,
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
      <DataGrid
        loading={loading}
        rows={therapists}
        columns={columns}
        getRowId={(row) => row.id}
        rowCount={rowCount}
        pagination
        paginationMode="server"
        sortingMode="server"
        pageSizeOptions={[5, 10, 25]}
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(model) => loadTherapists(model.page, undefined, model.pageSize)}
        onSortModelChange={(model) => {
          if (!model.length) return;
          const sortItem = model[0];
          if (!sortItem.sort) return;
          loadTherapists(0, { field: sortItem.field, sort: sortItem.sort }, pageSize);
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
