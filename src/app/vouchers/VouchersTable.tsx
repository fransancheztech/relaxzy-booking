"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Container, IconButton, Paper, Tooltip } from "@mui/material";
import { DataGrid, GridColDef, GridFilterItem, GridFilterModel } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VoucherDetailDialog from "./VoucherDetailDialog";
import { FETCH_LIMIT } from "@/constants/index";
import { formatMoney } from "@/utils/formatMoney";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
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

const baseColumns: GridColDef<VoucherRow>[] = [
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
    type: "number",
    valueGetter: (_, row) => (row.balance != null ? Number(row.balance) : null),
    valueFormatter: (value: number | null) => (value != null ? formatMoney(value) : "—"),
  },
  {
    field: "expiration_date",
    headerName: "Expires",
    flex: 1,
    type: "date",
    valueGetter: (_, row) => (row.expiration_date ? new Date(row.expiration_date) : null),
    valueFormatter: (value: Date | null) =>
      value
        ? value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "",
  },
  {
    field: "notes",
    headerName: "Notes",
    flex: 1.5,
    valueFormatter: formatNullable,
  },
  {
    field: "created_at",
    headerName: "Created",
    flex: 1,
    type: "dateTime",
    valueGetter: (_value, row) => (row.created_at ? new Date(row.created_at) : null),
    valueFormatter: formatDateTime,
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
  const [filterItems, setFilterItems] = useState<GridFilterItem[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const allColumns = useMemo<GridColDef<VoucherRow>[]>(
    () => [
      ...baseColumns,
      {
        field: "actions",
        headerName: "Actions",
        width: 80,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Tooltip title="View details">
            <IconButton
              size="small"
              onClick={() => {
                setSelectedVoucherId(params.row.id);
                setDetailOpen(true);
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const loadVouchers = useCallback(
    async (pageToLoad: number, sort = sortModel, filters = filterItems) => {
      try {
        setLoading(true);
        setFetchError(null);

        const res = await fetch("/api/vouchers/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: pageToLoad, limit: FETCH_LIMIT, sort, filterItems: filters }),
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
    [sortModel, filterItems],
  );

  const handleFilterModelChange = (model: GridFilterModel) => {
    const activeItems = model.items.filter(
      (item) => item.value !== undefined && item.value !== null && item.value !== ""
    );
    setFilterItems(activeItems);
    loadVouchers(0, sortModel, activeItems);
  };

  // Stable refs so event handlers never go stale
  const loadVouchersRef = useRef(loadVouchers);
  loadVouchersRef.current = loadVouchers;
  const pageRef = useRef(page);
  pageRef.current = page;
  const sortModelRef = useRef(sortModel);
  sortModelRef.current = sortModel;
  const filterItemsRef = useRef(filterItems);
  filterItemsRef.current = filterItems;

  useEffect(() => {
    loadVouchers(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () =>
      loadVouchersRef.current(pageRef.current, sortModelRef.current, filterItemsRef.current);
    window.addEventListener("refreshVouchersData", handler);
    return () => window.removeEventListener("refreshVouchersData", handler);
  }, []);

  return (
    <>
      <Container sx={{ py: 3 }} disableGutters>
        <Paper
          elevation={2}
          sx={{ maxHeight: "calc(100vh - 144px)", display: "flex", flexDirection: "column" }}
        >
          <DataGrid
            rows={rows}
            columns={allColumns}
            getRowId={(row) => row.id}
            rowCount={rowCount}
            pageSizeOptions={[FETCH_LIMIT]}
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            onFilterModelChange={handleFilterModelChange}
            pagination
            paginationModel={{ page, pageSize: FETCH_LIMIT }}
            onPaginationModelChange={(model) => loadVouchers(model.page)}
            loading={loading}
            onSortModelChange={(model) => {
              const sortItem = model[0];
              loadVouchers(0, sortItem?.sort
                ? { field: sortItem.field, sort: sortItem.sort }
                : { field: "created_at", sort: "desc" }
              );
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

      {selectedVoucherId && (
        <VoucherDetailDialog
          voucherId={selectedVoucherId}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
};

export default VouchersTable;
