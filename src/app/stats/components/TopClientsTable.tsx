"use client";

import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StatsTopClient } from "@/types/stats";
import { formatMoney } from "@/utils/formatMoney";

type Metric = "spend" | "bookings";
type Method = "all" | "cash" | "card";

const LIMITS = [10, 25, 50, 100] as const;

/** The API returns the top 100 under every ranking, so all four controls work in place. */
const TOP_LIMIT = 100;

interface Props {
  clients: StatsTopClient[];
}

const TopClientsTable = ({ clients }: Props) => {
  const t = useTranslations("Stats");

  const [metric, setMetric] = useState<Metric>("spend");
  const [method, setMethod] = useState<Method>("all");
  // Counting a group as one visit is the default: 93% of booking groups hold two bookings
  // for the SAME client (the "same client as primary" companion path), so the raw row
  // count would say a one-off couples client visited twice.
  const [groupAsOne, setGroupAsOne] = useState(true);
  const [limit, setLimit] = useState<number>(10);

  const spendOf = (c: StatsTopClient) =>
    method === "cash" ? c.spend_cash : method === "card" ? c.spend_card : c.spend_all;
  const visitsOf = (c: StatsTopClient) =>
    groupAsOne ? c.bookings_grouped : c.bookings_individual;

  const rows = useMemo(() => {
    const sorted = [...clients];
    if (metric === "spend") {
      // A client with nothing in the selected method is not "top by" that method.
      return sorted
        .filter((c) => spendOf(c) > 0)
        .sort((a, b) => spendOf(b) - spendOf(a))
        .slice(0, limit);
    }
    return sorted
      .filter((c) => visitsOf(c) > 0)
      .sort((a, b) => visitsOf(b) - visitsOf(a))
      .slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, metric, method, groupAsOne, limit]);

  const displayName = (c: StatsTopClient) =>
    [c.client_name, c.client_surname].filter(Boolean).join(" ").trim() || "—";
  // Two different clients can share a first name with no surname recorded, so always show
  // a contact detail next to the name.
  const contact = (c: StatsTopClient) => c.client_phone || c.client_email || null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t("topClientsTitle")}
        </Typography>
        <Tooltip title={t("topClientsAttribution")} arrow enterTouchDelay={0}>
          <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
        </Tooltip>
      </Box>

      {/* Controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <ToggleButtonGroup
          value={metric}
          exclusive
          size="small"
          onChange={(_, v: Metric | null) => { if (v) setMetric(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          <ToggleButton value="spend">{t("topBySpending")}</ToggleButton>
          <ToggleButton value="bookings">{t("topByBookings")}</ToggleButton>
        </ToggleButtonGroup>

        {/* Narrows the money column only — the visit count always stays whole, so a client
            who alternates cash and card still shows all of her visits. */}
        <ToggleButtonGroup
          value={method}
          exclusive
          size="small"
          onChange={(_, v: Method | null) => { if (v) setMethod(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem" } }}
        >
          <ToggleButton value="all">{t("all")}</ToggleButton>
          <ToggleButton value="cash">{t("cash")}</ToggleButton>
          <ToggleButton value="card">{t("card")}</ToggleButton>
        </ToggleButtonGroup>

        {/* Visible whichever metric sorts, because the Visits column is always on screen. */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={groupAsOne}
              onChange={(e) => setGroupAsOne(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              {t("groupAsOneVisit")}
            </Typography>
          }
        />

        <FormControl size="small" sx={{ minWidth: 96 }}>
          <InputLabel>{t("topNLabel")}</InputLabel>
          <Select
            value={limit}
            label={t("topNLabel")}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {LIMITS.map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
          {t("noDataForPeriod")}
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t("topColClient")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("topColVisits")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("topColSpend")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{t("topColAvg")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c, i) => {
                const visits = visitsOf(c);
                const spend = spendOf(c);
                return (
                  <TableRow key={c.client_id} hover>
                    <TableCell sx={{ color: "text.disabled" }}>{i + 1}</TableCell>
                    <TableCell>
                      {displayName(c)}
                      {contact(c) && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                          {contact(c)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{visits}</TableCell>
                    <TableCell align="right">{formatMoney(spend)}</TableCell>
                    <TableCell align="right">
                      {visits > 0 ? formatMoney(spend / visits) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Stated on screen, not just in a tooltip: both caveats change how the numbers read. */}
      <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
        {t("topClientsFootnote", { limit: TOP_LIMIT })}
      </Typography>
    </Box>
  );
};

export default TopClientsTable;
