"use client";

import {
  Box,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
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

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("default", {
    month: "long",
    year: "numeric",
  });
}

export default function TherapistHoursSection() {
  const t = useTranslations("Stats");

  const currentMonthKey = toMonthKey(new Date());
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [filterTherapist, setFilterTherapist] = useState<string>("all");
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(false);

  const canGoNext = monthKey < currentMonthKey;

  const shiftMonth = (delta: number) => {
    const [year, month] = monthKey.split("-").map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const next = toMonthKey(d);
    if (next <= currentMonthKey) setMonthKey(next);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stats/therapist-hours?month=${monthKey}`)
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
  }, [monthKey]);

  const therapistOptions = rows.map((r) => ({
    id: r.therapist_id,
    name: r.full_name,
  }));

  const visibleRows =
    filterTherapist === "all"
      ? rows
      : rows.filter((r) => r.therapist_id === filterTherapist);

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

      {/* Controls: month nav + therapist filter */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" onClick={() => shiftMonth(-1)}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 140, textAlign: "center", fontWeight: 500 }}>
            {formatMonthLabel(monthKey)}
          </Typography>
          <IconButton size="small" onClick={() => shiftMonth(1)} disabled={!canGoNext}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {therapistOptions.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t("allTherapists")}</InputLabel>
            <Select
              value={filterTherapist}
              label={t("allTherapists")}
              onChange={(e) => setFilterTherapist(e.target.value)}
            >
              <MenuItem value="all">{t("allTherapists")}</MenuItem>
              {therapistOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

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
              {visibleRows.length > 1 && (
                <>
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Divider />
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
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
