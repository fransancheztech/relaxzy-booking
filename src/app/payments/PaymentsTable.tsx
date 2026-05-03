import { Container, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridColDef, GridFilterModel } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { FETCH_LIMIT } from "@/constants";
import { payments as PaymentsType } from "generated/prisma/client";
import LoadingOverlay from "@/components/LoadingOverlay";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import { formatMoney } from "@/utils/formatMoney";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
import { GridFilterItem } from "@mui/x-data-grid";

interface Props {
  setSelectedPaymentId: (id: string) => void;
  setSelectedPaymentAmount: (amount: number | null) => void;
  setIsOpenViewPaymentDialog: (open: boolean) => void;
  payments: PaymentsType[];
  rowCount: number;
  page: number;
  loadPayments: (
    pageToLoad: number,
    sort?: { field: string; sort: "asc" | "desc" },
    filters?: GridFilterItem[],
  ) => void;
  onFilterModelChange: (model: GridFilterModel) => void;
  loading: boolean;
  fetchError: string | null;
}

export const PaymentsTable = ({
  setSelectedPaymentId,
  setSelectedPaymentAmount,
  setIsOpenViewPaymentDialog,
  payments,
  rowCount,
  page,
  loadPayments,
  onFilterModelChange,
  loading,
  fetchError,
}: Props) => {
  const columns: GridColDef[] = [
    { field: "booking_id", headerName: "Booking ID", flex: 1, filterable: false, valueFormatter: formatNullable },
    { field: "voucher_id", headerName: "Voucher ID", flex: 1, filterable: false, valueFormatter: formatNullable },
    {
      field: "amount",
      headerName: "Amount",
      flex: 1,
      type: "number",
      valueFormatter: (value) => formatMoney(value),
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
          icon={
            <Tooltip title="View">
              <VisibilityIcon color="primary" />
            </Tooltip>
          }
          label="View"
          onClick={() => {
            setSelectedPaymentId(params.row.id);
            setSelectedPaymentAmount(params.row.amount);
            setIsOpenViewPaymentDialog(true);
          }}
          key="view"
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
          rows={payments}
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
          onPaginationModelChange={(model) => loadPayments(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            const sortItem = model[0];
            loadPayments(0, sortItem?.sort
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
