"use client";

import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import { useCallback, useEffect, useState } from "react";
import { useLayout } from "@/app/context/LayoutContext";
import { formatMoney } from "@/utils/formatMoney";
import { toast } from "react-toastify";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PendingGroup {
  therapist_id: string;
  therapist_name: string;
  period_year: number;
  period_month: number;
  tip_count: number;
  gross_amount: number;
  iva_amount: number;
  net_amount: number;
  tip_ids: string[];
}

const TipsPageContent = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tips/pending");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch {
      toast.error("Failed to load pending tips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, []);

  const handleRelease = async (group: PendingGroup) => {
    const key = `${group.therapist_id}_${group.period_year}_${group.period_month}`;
    setReleasing(key);
    try {
      const res = await fetch("/api/tip-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: group.therapist_id,
          period_year: group.period_year,
          period_month: group.period_month,
          tip_ids: group.tip_ids,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to release tips");
        return;
      }

      toast.success(
        `Tips released for ${group.therapist_name} — ${MONTH_NAMES[group.period_month - 1]} ${group.period_year}`
      );
      loadPending();
    } catch {
      toast.error("Failed to release tips");
    } finally {
      setReleasing(null);
    }
  };

  return (
    <Box sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <PaymentsIcon color="action" />
        <Typography variant="h6" fontWeight={600}>
          Pending Tips
        </Typography>
        {!loading && (
          <Chip
            label={groups.length === 0 ? "All clear" : `${groups.length} group${groups.length !== 1 ? "s" : ""}`}
            size="small"
            color={groups.length === 0 ? "success" : "warning"}
          />
        )}
      </Box>

      {groups.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary">
          No pending tips — all tips have been paid out.
        </Typography>
      )}

      {groups.length > 0 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Therapist</strong></TableCell>
                <TableCell><strong>Period</strong></TableCell>
                <TableCell align="right"><strong>Tips</strong></TableCell>
                <TableCell align="right"><strong>Gross</strong></TableCell>
                <TableCell align="right"><strong>IVA (21%)</strong></TableCell>
                <TableCell align="right"><strong>Net</strong></TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => {
                const key = `${group.therapist_id}_${group.period_year}_${group.period_month}`;
                return (
                  <TableRow key={key} hover>
                    <TableCell>{group.therapist_name}</TableCell>
                    <TableCell>
                      {MONTH_NAMES[group.period_month - 1]} {group.period_year}
                    </TableCell>
                    <TableCell align="right">{group.tip_count}</TableCell>
                    <TableCell align="right">{formatMoney(group.gross_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: "warning.main" }}>
                      − {formatMoney(group.iva_amount)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatMoney(group.net_amount)}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={releasing === key}
                        onClick={() => handleRelease(group)}
                      >
                        Release
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TipsPageContent;
