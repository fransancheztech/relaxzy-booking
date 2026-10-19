"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPhone } from "@/utils/phone";
import { formatBusinessDate } from "@/utils/businessTime";
import { fullName, type DuplicateMember } from "./DuplicateGroupCard";

export type TypoMember = DuplicateMember & { number: string; first_visit: string | null };
export type TypoPair = { a: TypoMember; b: TypoMember };

export type TypoMergeDecision = { keeperId: string; otherId: string; phone: string; name: string };

type Decision = "merge" | "different";

/**
 * A number in display format with the digit that differs from `other` highlighted, so the typo is
 * visible at a glance ("+34 629 25 6 1 70" vs "+34 629 25 0 1 70").
 */
function NumberWithDiff({ number, other }: { number: string; other: string }) {
  const display = formatPhone(number);
  const at = [...number].findIndex((ch, i) => ch !== other[i]);
  if (at < 0) return <>{display}</>;
  // Which digit (counting digits only) differs, then where that digit sits in the display string.
  const digitIndex = number.slice(0, at).replace(/\D/g, "").length;
  let seen = -1;
  const pos = [...display].findIndex((ch) => /\d/.test(ch) && ++seen === digitIndex);
  if (pos < 0) return <>{display}</>;
  return (
    <>
      {display.slice(0, pos)}
      <Box component="span" sx={{ color: "warning.main", fontWeight: 800, textDecoration: "underline" }}>
        {display[pos]}
      </Box>
      {display.slice(pos + 1)}
    </>
  );
}

type Props = {
  pair: TypoPair;
  busy: boolean;
  onMerge: (decision: TypoMergeDecision) => void;
  onDismiss: () => void;
};

const TypoPairCard = ({ pair, busy, onMerge, onDismiss }: Props) => {
  const t = useTranslations("ClientDuplicates");
  const members = [pair.a, pair.b];

  // No default decision: two numbers a digit apart can belong to two real people.
  const [decision, setDecision] = useState<Decision | undefined>(undefined);
  const [keeperId, setKeeperId] = useState(pair.a.id);
  const keeper = members.find((m) => m.id === keeperId)!;
  const other = members.find((m) => m.id !== keeperId)!;

  // The correct number follows the kept record until the reviewer picks one explicitly: the record
  // kept is usually the one whose number is in use, but not always.
  const [phone, setPhone] = useState(pair.a.number);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const effectivePhone = phoneTouched ? phone : keeper.number;

  const nameOptions = [
    ...new Set([keeper, other].map((m) => m.client_name?.trim()).filter((n): n is string => !!n)),
  ];
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const effectiveName = (nameEdited ? name : keeper.client_name?.trim() || nameOptions[0] || "").trim();
  const pickName = (value: string) => {
    setName(value);
    setNameEdited(true);
  };

  const changeKeeper = (id: string) => {
    setKeeperId(id);
    setNameEdited(false);
  };

  const ready = decision === "different" || (decision === "merge" && !!effectiveName);

  const apply = () => {
    if (decision === "different") onDismiss();
    else if (decision === "merge") {
      onMerge({ keeperId, otherId: other.id, phone: effectivePhone, name: effectiveName });
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, opacity: busy ? 0.6 : 1 }}>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {decision === "merge" && <TableCell sx={{ fontWeight: 600, width: 64 }}>{t("colKeep")}</TableCell>}
              <TableCell sx={{ fontWeight: 600 }}>{t("colName")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colNumber")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colEmail")}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{t("colBookings")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colFirstVisit")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colLastVisit")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colCreated")}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{t("colVouchers")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => {
              const counterpart = m.id === pair.a.id ? pair.b : pair.a;
              return (
                <TableRow key={m.id} selected={decision === "merge" && m.id === keeperId}>
                  {decision === "merge" && (
                    <TableCell>
                      <Radio size="small" checked={m.id === keeperId} onChange={() => changeKeeper(m.id)} disabled={busy} />
                    </TableCell>
                  )}
                  <TableCell>{fullName(m) || "—"}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    <NumberWithDiff number={m.number} other={counterpart.number} />
                  </TableCell>
                  <TableCell>{m.client_email || "—"}</TableCell>
                  <TableCell align="right">{m.bookings}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(m.first_visit)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(m.last_visit)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(m.created_at)}</TableCell>
                  <TableCell align="right">{m.vouchers || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={decision ?? null}
          disabled={busy}
          onChange={(_, v: Decision | null) => { if (v) setDecision(v); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1.25, fontSize: "0.75rem" } }}
        >
          <ToggleButton value="merge">{t("samePerson")}</ToggleButton>
          <ToggleButton value="different">{t("differentPeople")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {decision === "merge" && (
        <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t("correctNumber")}</Typography>
            <RadioGroup
              row
              value={effectivePhone}
              onChange={(e) => { setPhone(e.target.value); setPhoneTouched(true); }}
            >
              {members.map((m) => (
                <FormControlLabel
                  key={m.number}
                  value={m.number}
                  control={<Radio size="small" disabled={busy} />}
                  label={
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      <NumberWithDiff number={m.number} other={m.id === pair.a.id ? pair.b.number : pair.a.number} />
                    </Typography>
                  }
                />
              ))}
            </RadioGroup>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <TextField
              size="small"
              label={t("nameToKeep")}
              value={nameEdited ? name : effectiveName}
              onChange={(e) => pickName(e.target.value)}
              disabled={busy}
              error={!effectiveName}
              helperText={t("nameToKeepHint")}
              sx={{ minWidth: 220 }}
            />
            {nameOptions.length > 1 &&
              nameOptions.map((n) => (
                <Chip
                  key={n}
                  size="small"
                  label={n}
                  variant={effectiveName === n ? "filled" : "outlined"}
                  color={effectiveName === n ? "primary" : "default"}
                  onClick={() => pickName(n)}
                  disabled={busy}
                />
              ))}
          </Box>
        </Box>
      )}

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          {!decision ? (
            <Alert severity="warning" sx={{ py: 0 }}>{t("chooseTypoDecision")}</Alert>
          ) : decision === "merge" ? (
            <Typography variant="body2" fontWeight={600}>
              {t("previewMerge", {
                name: effectiveName || "—",
                phone: formatPhone(effectivePhone),
                bookings: pair.a.bookings + pair.b.bookings,
              })}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("previewDifferent", { a: fullName(pair.a) || "—", b: fullName(pair.b) || "—" })}
            </Typography>
          )}
        </Box>
        <Button variant="contained" size="small" disabled={!ready || busy} onClick={apply}>
          {t("apply")}
        </Button>
      </Box>
    </Paper>
  );
};

export default TypoPairCard;
