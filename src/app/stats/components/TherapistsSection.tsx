"use client";

import {
  Alert,
  Box,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TodayIcon from "@mui/icons-material/Today";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BalanceIcon from "@mui/icons-material/Balance";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DateTime } from "luxon";
import { useLocale, useTranslations } from "next-intl";
import { StatsResponse, StatsTherapistRow, StatsTherapistRuleIncident, StatsTherapistRules } from "@/types/stats";
import { BUSINESS_TIMEZONE } from "@/constants";
import { formatMoney } from "@/utils/formatMoney";
import { formatHours } from "@/utils/formatHours";
import { formatBusinessBucketLabel, formatBusinessDate } from "@/utils/businessTime";
import KpiCard from "./KpiCard";

type Bucket = StatsResponse["meta"]["date_bucket"];

// Categorical slots in fixed order (validated for colour-vision deficiency on a white surface).
// A therapist's slot comes from the API, so she keeps the same colour in every chart and period.
const THERAPIST_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const colorOf = (row: StatsTherapistRow) => THERAPIST_COLORS[row.color_slot % THERAPIST_COLORS.length];

// The booking rules guideline's daily limit, drawn on the charts. Reference lines are neutral
// ink, so they never read as one of the therapists' colours.
const DAY_LIMIT_HOURS = 7;
const LIMIT_COLOR = "#2b2b2b";
const AVERAGE_COLOR = "#8a8985";
const REFERENCE_TEXT = "#52514e";
const SERVICE_SHADE = "#60a561";

// A rule's hover list shows this many times it was broken, then "and N more".
const INCIDENTS_SHOWN = 12;

interface Props {
  therapists: StatsResponse["therapists"];
  bucket: Bucket;
}

const TherapistsSection = ({ therapists, bucket }: Props) => {
  const t = useTranslations("Stats");
  const locale = useLocale();
  const { team, services } = therapists;
  const rows = therapists.therapists;

  const empty = (
    <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
      {t("noDataForPeriod")}
    </Typography>
  );

  const requestedShare = team.assigned_bookings ? (team.requested / team.assigned_bookings) * 100 : 0;
  // The line chart shows at most eight therapists (one per colour); the table lists everyone.
  const charted = rows.slice(0, THERAPIST_COLORS.length);
  const lineData = therapists.over_time.map((p) => ({
    label: formatBusinessBucketLabel(p.period, bucket, locale),
    ...p.by_therapist,
  }));
  const lineMax = Math.max(DAY_LIMIT_HOURS + 1, ...therapists.over_time.flatMap((p) => Object.values(p.by_therapist)));
  const perDayData = rows.map((r) => ({ name: r.therapist_name, value: r.avg_hours_per_day, color: colorOf(r) }));

  const day = (iso: string, format: string) =>
    DateTime.fromISO(iso, { zone: BUSINESS_TIMEZONE }).setLocale(locale).toFormat(format);

  // One line per time the rule was broken: when, and what happened.
  const describe = (rule: keyof StatsTherapistRules, i: StatsTherapistRuleIncident) => {
    const date = day(i.day, "ccc dd/MM/yyyy");
    switch (rule) {
      case "days_over_limit":
        return t("thIncidentOverLimit", { date, hours: formatHours(i.hours) });
      case "extended_over_allowance":
        return t("thIncidentExtended", {
          date,
          hours: formatHours(i.hours),
          others: (i.other_days ?? []).map((d) => day(d, "ccc dd/MM")).join(", "),
        });
      case "long_chains":
        return t("thIncidentChain", { date, start: i.start ?? "", end: i.end ?? "", hours: formatHours(i.hours) });
      case "late_starts":
        return t("thIncidentLate", { date, start: i.start ?? "" });
    }
  };

  const ruleCell = (r: StatsTherapistRow, rule: keyof StatsTherapistRules) => {
    const incidents = r.rules[rule];
    if (incidents.length === 0) {
      return <Typography component="span" variant="body2" color="text.disabled">0</Typography>;
    }
    const details = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, py: 0.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{r.therapist_name}</Typography>
        {incidents.slice(0, INCIDENTS_SHOWN).map((i, k) => (
          <Typography key={k} variant="caption" sx={{ display: "block", lineHeight: 1.4 }}>{describe(rule, i)}</Typography>
        ))}
        {incidents.length > INCIDENTS_SHOWN && (
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {t("thIncidentMore", { count: incidents.length - INCIDENTS_SHOWN })}
          </Typography>
        )}
      </Box>
    );
    return (
      <MuiTooltip title={details} arrow placement="left" enterTouchDelay={0}>
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          icon={<WarningAmberIcon />}
          label={incidents.length}
          tabIndex={0}
          sx={{ height: 22, fontWeight: 600, cursor: "help", "& .MuiChip-icon": { fontSize: 15 } }}
        />
      </MuiTooltip>
    );
  };

  const nameCell = (r: StatsTherapistRow) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorOf(r), flexShrink: 0 }} />
      {r.therapist_name}
      {!r.active && (
        <Chip size="small" label={t("therapistInactive")} sx={{ height: 18, fontSize: "0.65rem" }} />
      )}
    </Box>
  );

  const head = { fontWeight: 600, whiteSpace: "nowrap" } as const;
  // Narrow cards: short column headers may wrap onto two lines instead of clipping the table.
  const headWrap = { fontWeight: 600, fontSize: "0.75rem", lineHeight: 1.25, verticalAlign: "bottom" } as const;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>{t("therapistsSectionTitle")}</Typography>
        <Typography variant="caption" color="text.secondary">{t("therapistsSectionIntro")}</Typography>
      </Box>

      {team.unassigned_bookings > 0 && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          {t("therapistsUnassigned", { count: team.unassigned_bookings })}
        </Alert>
      )}

      {rows.length === 0 ? (
        <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>{empty}</Paper>
      ) : (
        <Grid container spacing={2}>
          {/* Team figures */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label={t("thBookedHours")}
              value={formatHours(team.booked_hours)}
              secondary={t("thTherapistDays", { count: team.therapist_days })}
              icon={<AccessTimeIcon fontSize="small" />}
              tooltip={t("thBookedHoursTooltip")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label={t("thHoursPerDay")}
              value={formatHours(team.avg_hours_per_day)}
              secondary={t("thDailyLimit", { limit: DAY_LIMIT_HOURS })}
              icon={<TodayIcon fontSize="small" />}
              tooltip={t("thHoursPerDayTooltip")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label={t("thRequests")}
              value={`${requestedShare.toFixed(0)}%`}
              secondary={t("thRequestsOf", { requested: team.requested, total: team.assigned_bookings })}
              icon={<FavoriteBorderIcon fontSize="small" />}
              tooltip={t("thRequestsTooltip")}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label={t("thBalance")}
              value={team.balance_days ? formatHours(team.avg_balance_gap) : "—"}
              secondary={team.balance_days ? t("thBigGapDays", { days: team.big_gap_days, total: team.balance_days }) : undefined}
              icon={<BalanceIcon fontSize="small" />}
              tooltip={t("thBalanceTooltip")}
            />
          </Grid>

          {/* Per therapist: the summary everything else breaks down */}
          <Grid size={12}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{t("thSummary")}</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ "& td, & th": { fontVariantNumeric: "tabular-nums" } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={head}>{t("thColTherapist")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColDays")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColBookings")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColHours")}</TableCell>
                      <TableCell sx={{ ...head, minWidth: 150 }}>{t("thColHoursPerDay")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColRequested")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColClients")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColRevenue")}</TableCell>
                      <TableCell align="right" sx={head}>{t("thColRevenuePerHour")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.therapist_id} hover>
                        <TableCell>{nameCell(r)}</TableCell>
                        <TableCell align="right">{r.days_worked}</TableCell>
                        <TableCell align="right">{r.bookings}</TableCell>
                        <TableCell align="right">{formatHours(r.booked_hours)}</TableCell>
                        <TableCell>
                          {/* The day's average against the 7 h limit. */}
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ position: "relative", flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover", minWidth: 60 }}>
                              <Box
                                sx={{
                                  position: "absolute", inset: 0, borderRadius: 4, bgcolor: colorOf(r),
                                  width: `${Math.min(100, (r.avg_hours_per_day / DAY_LIMIT_HOURS) * 100)}%`,
                                }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ minWidth: 76, textAlign: "right", whiteSpace: "nowrap" }}>{formatHours(r.avg_hours_per_day)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {r.requested}
                          <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                            ({r.bookings ? Math.round((r.requested / r.bookings) * 100) : 0}%)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{r.distinct_clients}</TableCell>
                        <TableCell align="right">{formatMoney(r.revenue)}</TableCell>
                        <TableCell align="right">{r.booked_hours ? formatMoney(r.revenue / r.booked_hours) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                {t("thSummaryFootnote")}
              </Typography>
            </Paper>
          </Grid>

          {/* Daily load over time */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {bucket === "day" ? t("thLoadPerDay") : t("thLoadAverage")}
              </Typography>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData} margin={{ top: 10, right: 64, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, Math.ceil(lineMax)]} tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip formatter={(v) => formatHours(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine
                      y={DAY_LIMIT_HOURS}
                      stroke={LIMIT_COLOR}
                      strokeDasharray="6 4"
                      label={{ value: t("thLimitLabel", { limit: DAY_LIMIT_HOURS }), position: "right", fontSize: 11, fill: REFERENCE_TEXT }}
                    />
                    {charted.map((r) => (
                      <Line
                        key={r.therapist_id}
                        dataKey={r.therapist_id}
                        name={r.therapist_name}
                        stroke={colorOf(r)}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: colorOf(r) }}
                        activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : empty}
            </Paper>
          </Grid>

          {/* Average per working day, against the team average and the limit */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{t("thAveragePerTherapist")}</Typography>
              <ResponsiveContainer width="100%" height={Math.max(180, perDayData.length * 40 + 60)}>
                <BarChart data={perDayData} layout="vertical" margin={{ top: 18, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, DAY_LIMIT_HOURS + 1]} tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => formatHours(Number(v ?? 0))} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <ReferenceLine
                    x={team.avg_hours_per_day}
                    stroke={AVERAGE_COLOR}
                    strokeDasharray="3 3"
                    label={{ value: t("thTeamAverage"), position: "top", fontSize: 10, fill: REFERENCE_TEXT }}
                  />
                  <ReferenceLine
                    x={DAY_LIMIT_HOURS}
                    stroke={LIMIT_COLOR}
                    strokeDasharray="6 4"
                    label={{ value: t("thLimitLabel", { limit: DAY_LIMIT_HOURS }), position: "top", fontSize: 10, fill: REFERENCE_TEXT }}
                  />
                  <Bar dataKey="value" name={t("thColHoursPerDay")} radius={[0, 4, 4, 0]} barSize={18}>
                    {perDayData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* What each therapist's time goes into */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{t("thServiceMix")}</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ "& td, & th": { fontVariantNumeric: "tabular-nums" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={head}>{t("thColTherapist")}</TableCell>
                      {services.map((s) => (
                        <TableCell key={s} align="center" sx={headWrap}>{s}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.therapist_id}>
                        <TableCell>{nameCell(r)}</TableCell>
                        {services.map((s) => {
                          const h = r.hours_by_service[s] ?? 0;
                          const share = r.booked_hours ? h / Object.values(r.hours_by_service).reduce((a, b) => a + b, 0) : 0;
                          return (
                            <MuiTooltip key={s} title={`${r.therapist_name} · ${s}: ${formatHours(h)}`} arrow>
                              <TableCell
                                align="center"
                                sx={{
                                  // One hue, lighter to darker with the share; capped so dark text stays readable.
                                  bgcolor: share > 0 ? alpha(SERVICE_SHADE, 0.08 + share * 0.72) : undefined,
                                  color: share > 0 ? "text.primary" : "text.disabled",
                                  border: "2px solid", borderColor: "background.paper",
                                }}
                              >
                                {share > 0 ? `${Math.round(share * 100)}%` : "—"}
                              </TableCell>
                            </MuiTooltip>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                {t("thServiceMixFootnote")}
              </Typography>
            </Paper>
          </Grid>

          {/* The booking rules guideline, checked */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{t("thRulesTitle")}</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={head}>{t("thColTherapist")}</TableCell>
                      <MuiTooltip title={t("thRuleOverLimitHelp")} arrow><TableCell align="center" sx={{ ...headWrap, cursor: "help" }}>{t("thRuleOverLimit")}</TableCell></MuiTooltip>
                      <MuiTooltip title={t("thRuleExtendedHelp")} arrow><TableCell align="center" sx={{ ...headWrap, cursor: "help" }}>{t("thRuleExtended")}</TableCell></MuiTooltip>
                      <MuiTooltip title={t("thRuleChainHelp")} arrow><TableCell align="center" sx={{ ...headWrap, cursor: "help" }}>{t("thRuleChain")}</TableCell></MuiTooltip>
                      <MuiTooltip title={t("thRuleLateHelp")} arrow><TableCell align="center" sx={{ ...headWrap, cursor: "help" }}>{t("thRuleLate")}</TableCell></MuiTooltip>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.therapist_id}>
                        <TableCell>{nameCell(r)}</TableCell>
                        <TableCell align="center">{ruleCell(r, "days_over_limit")}</TableCell>
                        <TableCell align="center">{ruleCell(r, "extended_over_allowance")}</TableCell>
                        <TableCell align="center">{ruleCell(r, "long_chains")}</TableCell>
                        <TableCell align="center">{ruleCell(r, "late_starts")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {/* The guideline's staffing signal: 7 days in a row with every therapist over 6 h. */}
              <Alert
                severity={team.all_over_six_streak >= 7 ? "warning" : "info"}
                variant="outlined"
                sx={{ mt: 1.5, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}
              >
                {team.all_over_six_streak > 0
                  ? t("thStaffingStreak", {
                      days: team.all_over_six_streak,
                      date: formatBusinessDate(team.all_over_six_streak_end),
                    })
                  : t("thStaffingNone")}
              </Alert>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default TherapistsSection;
