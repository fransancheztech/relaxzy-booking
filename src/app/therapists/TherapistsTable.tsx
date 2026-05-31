"use client";

import { useState } from "react";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import RestoreFromTrashIcon from "@mui/icons-material/RestoreFromTrash";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import LoadingOverlay from "@/components/LoadingOverlay";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
import { therapists } from "generated/prisma/client";
import { useTranslations } from "next-intl";

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
  archived: boolean;
  onRestore: (id: string) => void;
}

const DOW_KEYS: Record<number, string> = {
  1: "dowMon",
  2: "dowTue",
  3: "dowWed",
  4: "dowThu",
  5: "dowFri",
  6: "dowSat",
  7: "dowSun",
};

const TherapistsTable = ({
  therapists,
  rowCount,
  page,
  pageSize,
  loading,
  fetchError,
  loadTherapists,
  onEdit,
  archived,
  onRestore,
}: Props) => {
  const t = useTranslations("Therapists");
  const tCommon = useTranslations("Common");

  // Restore is intentionally gated behind a confirm, so it isn't as casual as
  // toggling a therapist active.
  const [restoreTarget, setRestoreTarget] = useState<therapists | null>(null);

  const formatOffDays = (days: number[] | null | undefined) => {
    if (!days || days.length === 0) return "—";
    return [...days]
      .sort((a, b) => a - b)
      .map((d) => t(DOW_KEYS[d] as Parameters<typeof t>[0]))
      .join(", ");
  };

  const columns: GridColDef<therapists>[] = [
    { field: "full_name", headerName: t("fullName"), flex: 1, valueFormatter: formatNullable },
    { field: "email", headerName: tCommon("email"), flex: 1, valueFormatter: formatNullable },
    { field: "phone", headerName: tCommon("phone"), flex: 1, valueFormatter: formatNullable },
    { field: "notes", headerName: tCommon("notes"), flex: 1, valueFormatter: formatNullable },
    {
      field: "off_days",
      headerName: t("daysOff"),
      width: 140,
      sortable: false,
      valueGetter: (_, row) => formatOffDays(row.off_days as unknown as number[]),
    },
    {
      field: "active",
      headerName: t("active"),
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
      headerName: tCommon("created"),
      type: "dateTime",
      flex: 1,
      valueGetter: (_, row) =>
        row.created_at ? new Date(row.created_at) : null,
      valueFormatter: formatDateTime,
    },
    {
      field: "actions",
      type: "actions",
      headerName: tCommon("actions"),
      getActions: (params) =>
        archived
          ? [
              <GridActionsCellItem
                key="restore"
                icon={
                  <Tooltip title={t("restore")}>
                    <RestoreFromTrashIcon color="success" />
                  </Tooltip>
                }
                label={t("restore")}
                onClick={() => setRestoreTarget(params.row)}
              />,
            ]
          : [
              <GridActionsCellItem
                key="edit"
                icon={
                  <Tooltip title={tCommon("edit")}>
                    <EditIcon color="primary" />
                  </Tooltip>
                }
                label={tCommon("edit")}
                onClick={() => onEdit(params.row.id)}
              />,
            ],
      sortable: false,
      filterable: false,
    },
  ];

  return (
    <>
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

    <Dialog open={!!restoreTarget} onClose={() => setRestoreTarget(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{t("restoreTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("restoreMessage", { name: restoreTarget?.full_name ?? "" })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRestoreTarget(null)}>{tCommon("cancel")}</Button>
        <Button
          color="success"
          variant="contained"
          startIcon={<RestoreFromTrashIcon />}
          onClick={() => {
            if (restoreTarget) onRestore(restoreTarget.id);
            setRestoreTarget(null);
          }}
        >
          {t("restore")}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default TherapistsTable;
