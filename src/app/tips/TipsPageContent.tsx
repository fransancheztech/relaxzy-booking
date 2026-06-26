"use client";

import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import PayoutIcon from "@mui/icons-material/AccountBalanceWallet";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { DataGrid, GridColDef, GridRowId } from "@mui/x-data-grid";
import TipDetailDialog from "@/components/TipDetailDialog";
import UpdateBookingDialogForm from "@/app/bookings/UpdateBookingDialogForm";
import { businessDayStartUtc, businessDayEndExclusiveUtc, formatBusinessDate, formatBusinessTime } from "@/utils/businessTime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useLayout } from "@/app/context/LayoutContext";
import { useTherapists } from "@/hooks/useTherapists";
import { useRole } from "@/hooks/useRole";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { formatMoney } from "@/utils/formatMoney";
import DateRangeFilter, { Preset, resolvePreset } from "@/app/stats/components/DateRangeFilter";

type StatusFilter = "all" | "pending" | "released";

interface TipRow {
  id: string;
  therapist_id: string;
  therapist_name: string;
  iva_applies: boolean;
  payment_method: "cash" | "credit_card";
  notes: string | null;
  date: string | null;
  payout_id: string | null;
  gross: number;
  iva: number;
  net: number;
  booking: {
    id: string;
    start_time: string | null;
    client_name: string | null;
    service_name: string | null;
    deleted: boolean;
  } | null;
}

const TipsPageContent = () => {
  const t = useTranslations("TipsPage");
  const tCommon = useTranslations("Common");
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const therapists = useTherapists();
  const { isAdmin, isTherapist } = useRole();
  // Admins and receptionists can edit individual tips; therapists are view-only.
  const canEdit = !isTherapist;

  const [tips, setTips] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { submitting: releasing, guard: releaseGuard } = useSubmitGuard();
  const [selectedIds, setSelectedIds] = useState<Set<GridRowId>>(new Set());

  const [detailTip, setDetailTip] = useState<TipRow | null>(null);
  const [bookingToView, setBookingToView] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("pending");
  const [therapistId, setTherapistId] = useState("");
  // Same date model as the Stats page: a preset plus an inclusive, date-only range.
  const [preset, setPreset] = useState<Preset>("month");
  const [pickFrom, setPickFrom] = useState<Date>(() => resolvePreset("month").from);
  const [pickTo, setPickTo] = useState<Date>(() => resolvePreset("month").to);

  const handlePresetChange = (newPreset: Preset) => {
    const { from, to } = resolvePreset(newPreset);
    setPreset(newPreset);
    setPickFrom(from);
    setPickTo(to);
  };
  const handleFromChange = (d: Date) => { setPreset("custom"); setPickFrom(d); };
  const handleToChange = (d: Date) => { setPreset("custom"); setPickTo(d); };

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

      // Half-open business-day (Europe/Madrid) range: [start of pickFrom's Madrid day,
      // start of the day after pickTo's Madrid day). The tips API filters on the booking's
      // start_time within these bounds.
      params.set("start_date", businessDayStartUtc(pickFrom)!.toISOString());
      params.set("end_date", businessDayEndExclusiveUtc(pickTo)!.toISOString());

      const res = await fetch(`/api/tips/list?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTips(data.tips ?? []);
    } catch {
      toast.error(t("failedLoadTips"));
    } finally {
      setLoading(false);
    }
  }, [status, therapistId, pickFrom, pickTo]);

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

  const handleRelease = () =>
    releaseGuard(async () => {
      if (selectedIds.size === 0) return;
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
      }
    });

  const methodLabel = (m: string) =>
    ({ cash: t("methodCash"), credit_card: t("methodCard") }[m] ?? m);

  const columns: GridColDef<TipRow>[] = [
    {
      field: "therapist_name",
      headerName: t("colTherapist"),
      flex: 1,
      minWidth: 130,
    },
    {
      field: "date",
      headerName: t("colDate"),
      width: 115,
      valueFormatter: (value: string | null) => formatBusinessDate(value),
    },
    {
      field: "booking",
      headerName: t("colBooking"),
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: ({ row }) => {
        const b = row.booking;
        if (!b) return "—";
        const time = b.start_time ? formatBusinessTime(b.start_time) : null;
        const label = [b.client_name, b.service_name, time].filter(Boolean).join(" · ") || tCommon("view");
        return (
          <Button
            variant="text"
            size="small"
            onClick={(e) => { e.stopPropagation(); setBookingToView(b.id); }}
            sx={{ textTransform: "none", p: 0, minWidth: 0, textAlign: "left", lineHeight: 1.3 }}
          >
            {label}{b.deleted ? ` (${t("bookingDeleted")})` : ""}
          </Button>
        );
      },
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
    {
      field: "actions",
      headerName: "",
      width: 48,
      sortable: false,
      renderCell: ({ row }) => {
        // Editable only for admin/receptionist and only while the tip is still pending.
        const editable = canEdit && row.payout_id === null;
        return (
          <Tooltip title={editable ? tCommon("edit") : tCommon("view")}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDetailTip(row); }}>
              {editable
                ? <EditIcon fontSize="small" />
                : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Box sx={{ py: 3, px: 2, display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
      {/* Filter bar */}
      <Paper variant="outlined" sx={{ px: 2, py: 1.5, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        {isAdmin && (
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
        )}

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

        <DateRangeFilter
          preset={preset}
          from={pickFrom}
          to={pickTo}
          onPresetChange={handlePresetChange}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
        />
      </Paper>

      {/* Selection summary — visible to all roles; the Release action is admin-only. */}
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
            {isAdmin && (
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
            )}
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

      <TipDetailDialog
        tip={detailTip}
        readOnly={!canEdit}
        onClose={() => setDetailTip(null)}
        onSaved={loadTips}
      />

      {/* Booking opened from a tip row — refetch on close in case the booking's
          appointment date (the tip's date) or therapist changed. */}
      {bookingToView && (
        <UpdateBookingDialogForm
          open={!!bookingToView}
          bookingId={bookingToView}
          onClose={() => { setBookingToView(null); loadTips(); }}
        />
      )}
    </Box>
  );
};

export default TipsPageContent;
