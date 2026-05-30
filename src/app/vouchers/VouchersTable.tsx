"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Container, IconButton, Paper, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid, GridColDef, GridFilterItem, GridFilterModel } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import VoucherDetailDialog from "./VoucherDetailDialog";
import { FETCH_LIMIT } from "@/constants/index";
import { formatMoney } from "@/utils/formatMoney";
import { formatNullable } from "@/utils/formatNullable";
import { formatDateTime } from "@/utils/formatDateTime";
import LoadingOverlay from "@/components/LoadingOverlay";
import NoRowsOverlay from "@/components/NoRowsOverlay";
import { useTranslations } from "next-intl";

type VoucherRow = {
  id: string;
  code: string;
  balance: string | null;
  expiration_date: string;
  created_at: string | null;
  notes: string | null;
  source: "physical" | "online";
  external_reference: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  recipient_id: string | null;
  buyer_id: string;
  recipient_name: string | null;
  recipient_surname: string | null;
};

// "Breakage": the voucher has expired but the client still has unused balance.
// Flag these so reception can spot them and raise the alert with the client.
const isExpiredWithBalance = (row: VoucherRow): boolean =>
  !!row.expiration_date &&
  new Date(row.expiration_date) < new Date() &&
  row.balance != null &&
  Number(row.balance) > 0;

const VouchersTable = () => {
  const t = useTranslations("Vouchers");
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
      {
        field: "code",
        headerName: t("code"),
        flex: 1,
        minWidth: 130,
      },
      {
        field: "source",
        headerName: t("source"),
        flex: 0.7,
        minWidth: 100,
        type: "singleSelect",
        valueOptions: [
          { value: "physical", label: t("sourcePhysical") },
          { value: "online", label: t("sourceOnline") },
        ],
        renderCell: (params) => (
          <Chip
            label={params.row.source === "online" ? t("sourceOnline") : t("sourcePhysical")}
            color={params.row.source === "online" ? "info" : "default"}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: "external_reference",
        headerName: t("externalReference"),
        flex: 1,
        minWidth: 120,
        valueFormatter: formatNullable,
      },
      {
        field: "buyer_name",
        headerName: t("buyer"),
        flex: 1.5,
        sortable: false,
        valueGetter: (_value, row) =>
          [row.buyer_name, row.buyer_surname].filter(Boolean).join(" ") || "—",
      },
      {
        field: "recipient_name",
        headerName: t("recipient"),
        flex: 1.5,
        sortable: false,
        valueGetter: (_value, row) => {
          if (!row.recipient_id || row.recipient_id === row.buyer_id) return t("sameAsBuyer");
          return [row.recipient_name, row.recipient_surname].filter(Boolean).join(" ") || "—";
        },
      },
      {
        field: "balance",
        headerName: t("balance"),
        flex: 0.8,
        type: "number",
        valueGetter: (_, row) => (row.balance != null ? Number(row.balance) : null),
        valueFormatter: (value: number | null) => (value != null ? formatMoney(value) : "—"),
      },
      {
        field: "expiration_date",
        headerName: t("expires"),
        flex: 1,
        type: "date",
        valueGetter: (_, row) => (row.expiration_date ? new Date(row.expiration_date) : null),
        renderCell: (params) => {
          const value = params.value as Date | null;
          const label = value
            ? value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "";
          if (!isExpiredWithBalance(params.row)) return label;
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "warning.main", fontWeight: 600 }}>
              <Tooltip title={t("expiredWithBalance")}>
                <WarningAmberIcon fontSize="small" />
              </Tooltip>
              {label}
            </Box>
          );
        },
      },
      {
        field: "notes",
        headerName: t("notes"),
        flex: 1.5,
        valueFormatter: formatNullable,
      },
      {
        field: "created_at",
        headerName: t("created"),
        flex: 1,
        type: "dateTime",
        valueGetter: (_value, row) => (row.created_at ? new Date(row.created_at) : null),
        valueFormatter: formatDateTime,
      },
      {
        field: "actions",
        headerName: t("actions"),
        width: 80,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Tooltip title={t("viewDetails")}>
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
    [t],
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
          setFetchError(t("errorLoadingVouchers"));
          return;
        }

        const data = await res.json();
        setRows(data.rows);
        setRowCount(data.total);
        setPage(pageToLoad);
        setSortModel(sort);
      } catch {
        setFetchError(t("errorLoadingVouchers"));
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
            getRowClassName={(params) =>
              isExpiredWithBalance(params.row) ? "voucher-row--expired-balance" : ""
            }
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
            sx={{
              opacity: loading ? 0.5 : 1,
              backgroundColor: loading ? "#ddd" : "",
              "& .voucher-row--expired-balance": {
                backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.12),
                "&:hover": {
                  backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.2),
                },
              },
            }}
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
