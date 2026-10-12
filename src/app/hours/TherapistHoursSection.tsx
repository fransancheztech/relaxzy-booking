"use client";

import {
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

interface HoursRow {
  therapist_id: string;
  full_name: string;
  booking_count: number;
  total_hours: number;
}

function formatHours(h: number) {
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export default function TherapistHoursSection({
  isTherapist = false,
  from,
  to,
}: {
  isTherapist?: boolean;
  from: Date;
  to: Date;
}) {
  const t = useTranslations("Stats");

  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stats/therapist-hours?from=${fromIso}&to=${toIso}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load therapist hours");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fromIso, toIso]);

  // Default to all therapists; reset only when the set changes (period change).
  const optionKey = rows.map((r) => r.therapist_id).join(",");
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setSelected(optionKey ? optionKey.split(",") : []);
  }, [optionKey]);
  const selectedSet = new Set(selected);

  const visibleRows = rows.filter((r) => selectedSet.has(r.therapist_id));

  const totalHours = visibleRows.reduce((s, r) => s + r.total_hours, 0);
  const totalBookings = visibleRows.reduce((s, r) => s + r.booking_count, 0);

  return (
    <Box>
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <AccessTimeIcon fontSize="small" color="action" />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          {t("therapistHoursTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("therapistHoursSubtitle")}
        </Typography>
      </Box>

      {/* Therapist filter (multi-select) */}
      {rows.length > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t("tipsTherapistsLabel")}</InputLabel>
            <Select
              multiple
              value={selected}
              label={t("tipsTherapistsLabel")}
              onChange={(e) =>
                setSelected(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)
              }
              renderValue={(sel) =>
                (sel as string[]).length === rows.length
                  ? t("allTherapists")
                  : t("therapistsSelected", { count: (sel as string[]).length })
              }
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
            >
              {rows.map((r) => (
                <MenuItem key={r.therapist_id} value={r.therapist_id}>
                  <Checkbox checked={selectedSet.has(r.therapist_id)} size="small" />
                  <ListItemText primary={r.full_name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : visibleRows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          {t("noHoursData")}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 600 }}>{t("therapistCol")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("bookingsCol")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("hoursCol")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((r) => (
                <TableRow key={r.therapist_id} hover>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell align="right">{r.booking_count}</TableCell>
                  <TableCell align="right">{formatHours(r.total_hours)}</TableCell>
                </TableRow>
              ))}
              {!isTherapist && visibleRows.length > 1 && (
                <>
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Divider />
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 600 }}>{t("totalRow")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{totalBookings}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatHours(totalHours)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
