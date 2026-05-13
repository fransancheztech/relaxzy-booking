"use client";

import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PayoutIcon from "@mui/icons-material/AccountBalanceWallet";
import { DataGrid, GridColDef, GridRowId } from "@mui/x-data-grid";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useLayout } from "@/app/context/LayoutContext";
import { useTherapists } from "@/hooks/useTherapists";
import { formatMoney } from "@/utils/formatMoney";

type StatusFilter = "all" | "pending" | "released";
type PeriodFilter =
  | "all"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "custom";

interface TipRow {
  id: string;
  therapist_id: string;
  therapist_name: string;
  iva_applies: boolean;
  payment_method: "cash" | "credit_card" | "voucher";
  notes: string | null;
  received_at: string;
  payout_id: string | null;
  gross: number;
  iva: number;
  net: number;
}

function getPeriodDates(
  period: PeriodFilter,
  customStart: Date | null,
  customEnd: Date | null,
): { start_date: string; end_date: string } | null {
  if (period === "all") return null;
  if (period === "custom") {
    if (!customStart && !customEnd) return null;
    const eod = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return {
      start_date: customStart
        ? new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate()).toISOString()
        : "",
      end_date: customEnd ? eod(customEnd).toISOString() : "",
    };
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString();
  const eod = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "this_month":
      return {
        start_date: iso(new Date(y, m, 1)),
        end_date: iso(eod(new Date(y, m + 1, 0))),
      };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return {
        start_date: iso(new Date(ly, lm, 1)),
        end_date: iso(eod(new Date(ly, lm + 1, 0))),
      };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return {
        start_date: iso(new Date(y, q * 3, 1)),
        end_date: iso(eod(new Date(y, q * 3 + 3, 0))),
      };
    }
    case "last_quarter": {
      let q = Math.floor(m / 3) - 1;
      let qy = y;
      if (q < 0) { q = 3; qy = y - 1; }
      return {
        start_date: iso(new Date(qy, q * 3, 1)),
        end_date: iso(eod(new Date(qy, q * 3 + 3, 0))),
      };
    }
    case "this_year":
      return {
        start_date: iso(new Date(y, 0, 1)),
        end_date: iso(eod(new Date(y, 11, 31))),
      };
    default:
      return null;
  }
}

const TipsPageContent = () => {
  const t = useTranslations("TipsPage");
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const therapists = useTherapists();

  const [tips, setTips] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<GridRowId>>(new Set());

  const [status, setStatus] = useState<StatusFilter>("pending");
  const [therapistId, setTherapistId] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => { setButtonLabel(""); setOnButtonClick(null); };
  }, []);

  const loadTips = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (therapistId) params.set("therapist_id", therapistId);

      const dates = getPeriodDates(period, customStart, customEnd);
      if (dates?.start_date) params.set("start_date", dates.start_date);
      if (dates?.end_date) params.set("end_date", dates.end_date);

      const res = await fetch(`/api/tips/list?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTips(data.tips ?? []);
    } catch {
      toast.error(t("failedLoadTips"));
    } finally {
      setLoading(false);
    }
  }, [status, therapistId, period, customStart, customEnd]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  const selectionSummary = useMemo(() => {
    if (selectedIds.size === 0) return null;
    let gross = 0;
    let iva = 0;
    for (const id of selectedIds) {
      const tip = tips.find((t) => t.id === id);
      if (tip) { gross += tip.gross; iva += tip.iva; }
    }
    return {
      count: selectedIds.size,
      gross: Math.round(gross * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      net: Math.round((gross - iva) * 100) / 100,
    };
  }, [selectedIds, tips]);

  const handleRelease = async () => {
    if (selectedIds.size === 0) return;
    setReleasing(true);
    try {
      const res = await fetch("/api/tip-payouts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tip_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? t("releaseError"));
        return;
      }
      const data = await res.json();
      toast.success(t("releaseSuccess", { count: data.tips_released }));
      setSelectedIds(new Set());
      loadTips();
    } catch {
      toast.error(t("releaseError"));
    } finally {
      setReleasing(false);
    }
  };

  const methodLabel = (m: string) =>
    ({ cash: t("methodCash"), credit_card: t("methodCard"), voucher: t("methodVoucher") }[m] ?? m);

  const columns: GridColDef<TipRow>[] = [
    {
      field: "therapist_name",
      headerName: t("colTherapist"),
      flex: 1,
      minWidth: 130,
    },
    {
      field: "received_at",
      headerName: t("colReceivedOn"),
      width: 115,
      valueFormatter: (value: string) =>
        new Date(value).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
    },
    {
      field: "payment_method",
      headerName: t("colMethod"),
      width: 100,
      renderCell: ({ value }) => (
        <Chip size="small" label={methodLabel(value)} variant="outlined" sx={{ fontSize: "0.7rem" }} />
      ),
    },
    {
      field: "gross",
      headerName: t("colGross"),
      width: 90,
      type: "number",
      valueFormatter: (v: number) => formatMoney(v),
    },
    {
      field: "iva",
      headerName: t("colIva"),
      width: 80,
      type: "number",
      valueFormatter: (v: number) => (v > 0 ? formatMoney(v) : "—"),
    },
    {
      field: "net",
      headerName: t("colNet"),
      width: 90,
      type: "number",
      valueFormatter: (v: number) => formatMoney(v),
    },
    {
      field: "payout_id",
      headerName: t("colStatus"),
      width: 105,
      sortable: false,
      renderCell: ({ value }) => (
        <Chip
          size="small"
          label={value ? t("statusReleased") : t("statusPending")}
          color={value ? "success" : "warning"}
          sx={{ fontSize: "0.7rem" }}
        />
      ),
    },
    {
      field: "notes",
      headerName: t("colNotes"),
      flex: 1,
      minWidth: 100,
      sortable: false,
      valueFormatter: (v: string | null) => v ?? "",
    },
  ];

  return (
    <Box sx={{ py: 3, px: 2, display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
      {/* Filter bar */}
      <Paper variant="outlined" sx={{ px: 2, py: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, v) => { if (v) setStatus(v); }}
        >
          <ToggleButton value="all">{t("filterAll")}</ToggleButton>
          <ToggleButton value="pending">{t("filterPending")}</ToggleButton>
          <ToggleButton value="released">{t("filterReleased")}</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("colTherapist")}</InputLabel>
          <Select
            value={therapistId}
            label={t("colTherapist")}
            onChange={(e) => setTherapistId(e.target.value)}
          >
            <MenuItem value=""><em>{t("allTherapists")}</em></MenuItem>
            {therapists.map((th) => (
              <MenuItem key={th.id} value={th.id}>{th.full_name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>{t("filterPeriod")}</InputLabel>
          <Select
            value={period}
            label={t("filterPeriod")}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          >
            <MenuItem value="all">{t("periodAll")}</MenuItem>
            <MenuItem value="this_month">{t("periodThisMonth")}</MenuItem>
            <MenuItem value="last_month">{t("periodLastMonth")}</MenuItem>
            <MenuItem value="this_quarter">{t("periodThisQuarter")}</MenuItem>
            <MenuItem value="last_quarter">{t("periodLastQuarter")}</MenuItem>
            <MenuItem value="this_year">{t("periodThisYear")}</MenuItem>
            <MenuItem value="custom">{t("periodCustom")}</MenuItem>
          </Select>
        </FormControl>

        {period === "custom" && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
            <DatePicker
              label={t("periodFrom")}
              value={customStart}
              onChange={setCustomStart}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
            />
            <DatePicker
              label={t("periodTo")}
              value={customEnd}
              onChange={setCustomEnd}
              format="dd/MM/yyyy"
              minDate={customStart ?? undefined}
              slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
            />
          </LocalizationProvider>
        )}
      </Paper>

      {/* Selection summary + release action — content always rendered to prevent layout shifts */}
      {(() => {
        const summary = selectionSummary ?? { count: 0, gross: 0, iva: 0, net: 0 };
        const visible = !!selectionSummary;
        return (
          <Paper
            variant="outlined"
            sx={{
              px: 2,
              py: 1,
              display: "flex",
              alignItems: "center",
              gap: 3,
              bgcolor: visible ? "action.selected" : "transparent",
              flexWrap: "wrap",
              transition: "background-color 0.15s",
              visibility: visible ? "visible" : "hidden",
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {t("selectedCount", { count: summary.count })}
            </Typography>
            <Box sx={{ display: "flex", gap: 2.5, flex: 1, flexWrap: "wrap" }}>
              <Typography variant="body2">
                {t("colGross")}: <strong>{formatMoney(summary.gross)}</strong>
              </Typography>
              <Typography variant="body2">
                {t("colIva")}: <strong>−{formatMoney(summary.iva)}</strong>
              </Typography>
              <Typography variant="body2">
                {t("colNet")}: <strong>{formatMoney(summary.net)}</strong>
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PayoutIcon fontSize="small" />}
              onClick={handleRelease}
              disabled={releasing}
            >
              {t("releaseSelected")}
            </Button>
          </Paper>
        );
      })()}

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 400 }}>
        <DataGrid
          rows={tips}
          columns={columns}
          loading={loading}
          checkboxSelection
          disableColumnFilter
          disableColumnMenu
          isRowSelectable={(p) => p.row.payout_id === null}
          rowSelectionModel={{ type: "include", ids: selectedIds }}
          onRowSelectionModelChange={(model) => setSelectedIds(model.ids as Set<GridRowId>)}
          sx={{ height: "100%", border: 0 }}
        />
      </Box>
    </Box>
  );
};

export default TipsPageContent;
