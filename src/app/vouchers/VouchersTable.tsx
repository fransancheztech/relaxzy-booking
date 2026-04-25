"use client";

import { useCallback, useEffect, useState } from "react";
import { Container, Paper } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { FETCH_LIMIT } from "@/constants/index";
import { formatMoney } from "@/utils/formatMoney";
import LoadingOverlay from "@/components/LoadingOverlay";
import NoRowsOverlay from "@/components/NoRowsOverlay";

type VoucherRow = {
  id: string;
  code: string;
  balance: string | null;
  expiration_date: string;
  created_at: string | null;
  notes: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  recipient_id: string | null;
  buyer_id: string;
  recipient_name: string | null;
  recipient_surname: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const columns: GridColDef<VoucherRow>[] = [
  {
    field: "code",
    headerName: "Code",
    flex: 1,
    minWidth: 130,
  },
  {
    field: "buyer_name",
    headerName: "Buyer",
    flex: 1.5,
    sortable: false,
    valueGetter: (_value, row) =>
      [row.buyer_name, row.buyer_surname].filter(Boolean).join(" ") || "—",
  },
  {
    field: "recipient_name",
    headerName: "Recipient",
    flex: 1.5,
    sortable: false,
    valueGetter: (_value, row) => {
      if (!row.recipient_id || row.recipient_id === row.buyer_id) return "Same as buyer";
      return [row.recipient_name, row.recipient_surname].filter(Boolean).join(" ") || "—";
    },
  },
  {
    field: "balance",
    headerName: "Balance",
    flex: 0.8,
    valueFormatter: (value) => (value != null ? formatMoney(Number(value)) : "—"),
  },
  {
    field: "expiration_date",
    headerName: "Expires",
    flex: 1,
    valueFormatter: (value) => formatDate(value),
  },
  {
    field: "notes",
    headerName: "Notes",
    flex: 1.5,
    sortable: false,
    valueFormatter: (value) => value ?? "",
  },
  {
    field: "created_at",
    headerName: "Created",
    flex: 1,
    type: "dateTime",
    valueGetter: (_value, row) => (row.created_at ? new Date(row.created_at) : null),
    valueFormatter: (value: Date | null) =>
      value
        ? value.toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
  },
];

const VouchersTable = () => {
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortModel, setSortModel] = useState<{ field: string; sort: "asc" | "desc" }>({
    field: "created_at",
    sort: "desc",
  });

  const loadVouchers = useCallback(
    async (pageToLoad: number, sort = sortModel) => {
      try {
        setLoading(true);
        setFetchError(null);

        const res = await fetch("/api/vouchers/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: pageToLoad, limit: FETCH_LIMIT, sort }),
        });

        if (!res.ok) {
          setFetchError("Error loading vouchers");
          return;
        }

        const data = await res.json();
        setRows(data.rows);
        setRowCount(data.total);
        setPage(pageToLoad);
        setSortModel(sort);
      } catch {
        setFetchError("Error loading vouchers");
        setRows([]);
        setRowCount(0);
      } finally {
        setLoading(false);
      }
    },
    [sortModel],
  );

  useEffect(() => {
    loadVouchers(0);
  }, []);

  useEffect(() => {
    const handler = () => loadVouchers(0);
    window.addEventListener("refreshVouchersData", handler);
    return () => window.removeEventListener("refreshVouchersData", handler);
  }, [loadVouchers]);

  return (
    <Container sx={{ py: 3 }} disableGutters>
      <Paper
        elevation={2}
        sx={{ maxHeight: "calc(100vh - 144px)", display: "flex", flexDirection: "column" }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={rowCount}
          pageSizeOptions={[FETCH_LIMIT]}
          paginationMode="server"
          sortingMode="server"
          pagination
          paginationModel={{ page, pageSize: FETCH_LIMIT }}
          onPaginationModelChange={(model) => loadVouchers(model.page)}
          loading={loading}
          onSortModelChange={(model) => {
            if (!model.length || !model[0].sort) return;
            loadVouchers(0, { field: model[0].field, sort: model[0].sort });
          }}
          initialState={{
            sorting: { sortModel: [{ field: "created_at", sort: "desc" }] },
          }}
          slots={{
            loadingOverlay: LoadingOverlay,
            noRowsOverlay: () => <NoRowsOverlay error={fetchError} />,
          }}
          sx={{ opacity: loading ? 0.5 : 1, backgroundColor: loading ? "#ddd" : "" }}
        />
      </Paper>
    </Container>
  );
};

export default VouchersTable;
