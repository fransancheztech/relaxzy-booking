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
import { useTranslations } from "next-intl";
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
  const t = useTranslations("TipsPage");
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
      toast.error(t("failedLoadTips"));
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
        toast.error(err.error ?? t("failedReleaseTips"));
        return;
      }

      toast.success(
        t("tipsReleasedFor", { name: group.therapist_name, month: MONTH_NAMES[group.period_month - 1], year: group.period_year })
      );
      loadPending();
    } catch {
      toast.error(t("failedReleaseTips"));
    } finally {
      setReleasing(null);
    }
  };

  return (
    <Box sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <PaymentsIcon color="action" />
        <Typography variant="h6" fontWeight={600}>
          {t("pendingTips")}
        </Typography>
        {!loading && (
          <Chip
            label={groups.length === 0 ? t("allClear") : groups.length === 1 ? t("groups", { count: groups.length }) : t("groupsPlural", { count: groups.length })}
            size="small"
            color={groups.length === 0 ? "success" : "warning"}
          />
        )}
      </Box>

      {groups.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary">
          {t("noPendingTips")}
        </Typography>
      )}

      {groups.length > 0 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>{t("therapist")}</strong></TableCell>
                <TableCell><strong>{t("period")}</strong></TableCell>
                <TableCell align="right"><strong>{t("tips")}</strong></TableCell>
                <TableCell align="right"><strong>{t("gross")}</strong></TableCell>
                <TableCell align="right"><strong>{t("iva")}</strong></TableCell>
                <TableCell align="right"><strong>{t("net")}</strong></TableCell>
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
                        {t("release")}
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
