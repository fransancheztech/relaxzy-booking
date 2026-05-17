"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import GroupsIcon from "@mui/icons-material/Groups";
import FunctionsIcon from "@mui/icons-material/Functions";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useTranslations } from "next-intl";
import { useTherapists } from "@/hooks/useTherapists";

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "neutral" | "min" | "max";
};

const STAT_VARIANT_STYLES = {
  neutral: { borderColor: "divider", bgcolor: "transparent", valueColor: "text.primary" },
  min: { borderColor: "rgba(211,47,47,0.4)", bgcolor: "rgba(244,67,54,0.08)", valueColor: "error.dark" },
  max: { borderColor: "rgba(46,125,50,0.4)", bgcolor: "rgba(76,175,80,0.08)", valueColor: "success.dark" },
} as const;

const StatCard = ({ icon, label, value, sublabel, variant = "neutral" }: StatCardProps) => {
  const styles = STAT_VARIANT_STYLES[variant];
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 130,
        p: 1.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: styles.borderColor,
        bgcolor: styles.bgcolor,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.25, color: "text.secondary" }}>
        {icon}
        <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, color: styles.valueColor }}>
          {value}
        </Typography>
        {sublabel && (
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
            {sublabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DOW_KEYS: Record<number, string> = {
  1: "dowMon",
  2: "dowTue",
  3: "dowWed",
  4: "dowThu",
  5: "dowFri",
  6: "dowSat",
  7: "dowSun",
};

const TherapistsWeeklySchedule = ({ open, onClose }: Props) => {
  const t = useTranslations("Therapists");
  const tCommon = useTranslations("Common");
  const therapists = useTherapists();

  const isWorking = (off_days: number[] | undefined, day: number) =>
    !(off_days ?? []).includes(day);

  const workingPerDay: Record<number, number> = {};
  WEEKDAYS.forEach((d) => {
    workingPerDay[d] = therapists.filter((th) => isWorking(th.off_days, d)).length;
  });

  const counts = WEEKDAYS.map((d) => workingPerDay[d]);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const allEqual = min === max;

  const minDays = WEEKDAYS.filter((d) => workingPerDay[d] === min);
  const maxDays = WEEKDAYS.filter((d) => workingPerDay[d] === max);

  const minDayLabels = minDays.map((d) => t(DOW_KEYS[d] as Parameters<typeof t>[0])).join(", ");
  const maxDayLabels = maxDays.map((d) => t(DOW_KEYS[d] as Parameters<typeof t>[0])).join(", ");

  const dayCellSx = {
    width: 48,
    px: 0.5,
    py: 0.75,
    textAlign: "center" as const,
    borderLeft: "1px solid",
    borderColor: "divider",
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("weeklyOverview")}</DialogTitle>
      <DialogContent>
        {therapists.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("noActiveTherapists")}
          </Typography>
        ) : (
          <>
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <StatCard
            icon={<GroupsIcon fontSize="small" />}
            label={t("statActive")}
            value={therapists.length}
          />
          <StatCard
            icon={<FunctionsIcon fontSize="small" />}
            label={t("statAvgPerDay")}
            value={avg.toFixed(1)}
          />
          <StatCard
            icon={<TrendingDownIcon fontSize="small" />}
            label={t("statLowest")}
            value={min}
            sublabel={minDayLabels}
            variant={allEqual ? "neutral" : "min"}
          />
          <StatCard
            icon={<TrendingUpIcon fontSize="small" />}
            label={t("statHighest")}
            value={max}
            sublabel={maxDayLabels}
            variant={allEqual ? "neutral" : "max"}
          />
        </Box>

        <TableContainer>
        <Table size="small" sx={{ "& td, & th": { fontSize: "0.8rem" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t("fullName")}</TableCell>
              {WEEKDAYS.map((d) => (
                <TableCell key={d} sx={{ ...dayCellSx, fontWeight: 700 }}>
                  {t(DOW_KEYS[d] as Parameters<typeof t>[0])}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {therapists.map((th) => (
              <TableRow key={th.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{th.full_name}</TableCell>
                {WEEKDAYS.map((d) => {
                  const working = isWorking(th.off_days, d);
                  return (
                    <TableCell
                      key={d}
                      sx={{
                        ...dayCellSx,
                        bgcolor: working ? "rgba(76,175,80,0.08)" : "rgba(244,67,54,0.10)",
                      }}
                    >
                      {working ? (
                        <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
                      ) : (
                        <CloseIcon fontSize="small" sx={{ color: "error.main" }} />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            <TableRow sx={{ "& td": { borderTop: "2px solid", borderTopColor: "divider" } }}>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                {t("workingCount")}
              </TableCell>
              {WEEKDAYS.map((d) => {
                const c = workingPerDay[d];
                const isMin = !allEqual && c === min;
                const isMax = !allEqual && c === max;
                const cell = (
                  <TableCell
                    key={d}
                    sx={{
                      ...dayCellSx,
                      fontWeight: 700,
                      color: isMin ? "error.dark" : isMax ? "success.dark" : "text.primary",
                      bgcolor: isMin
                        ? "rgba(244,67,54,0.18)"
                        : isMax
                          ? "rgba(76,175,80,0.18)"
                          : "transparent",
                    }}
                  >
                    {c}
                  </TableCell>
                );
                if (isMin) {
                  return (
                    <Tooltip key={d} title={t("fewestStaff")}>
                      {cell}
                    </Tooltip>
                  );
                }
                if (isMax) {
                  return (
                    <Tooltip key={d} title={t("mostStaff")}>
                      {cell}
                    </Tooltip>
                  );
                }
                return cell;
              })}
            </TableRow>
          </TableBody>
        </Table>
        </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TherapistsWeeklySchedule;
