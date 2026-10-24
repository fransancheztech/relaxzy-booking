"use client";

import {
  Box,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ClientSummary } from "@/lib/clients/duplicates";
import { formatPhone } from "@/utils/phone";
import { formatBusinessDate } from "@/utils/businessTime";
import { fullName } from "./DuplicateGroupCard";

export type MergeDecision = {
  keeperId: string;
  otherId: string;
  name: string;
  surname: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  clients: [ClientSummary, ClientSummary];
  /** The record kept unless the reviewer picks the other one. */
  defaultKeeperId: string;
  busy?: boolean;
  /** The decision as currently filled in, or null while it can't be applied (empty name). */
  onChange: (decision: MergeDecision | null) => void;
};

const trimmed = (s: string | null | undefined) => s?.trim() || "";

/** Defaults for a keeper: its own values, falling back to the other record's where it has none. */
function defaultsFor(keeper: ClientSummary, other: ClientSummary) {
  return {
    name: trimmed(keeper.client_name) || trimmed(other.client_name),
    surname: trimmed(keeper.client_surname) || trimmed(other.client_surname),
    phone: keeper.client_phone || other.client_phone || null,
    email: keeper.client_email || other.client_email || null,
  };
}

/**
 * Merging two clients: which record stays, and what the merged client's name, phone and email are.
 * Phone and email are picked from what the two records hold, never typed. Shared by the "Voucher
 * recipients" review tab and "Merge into another client…" on the Clients page.
 */
const ClientMergeForm = ({ clients, defaultKeeperId, busy, onChange }: Props) => {
  const t = useTranslations("ClientDuplicates");
  const [keeperId, setKeeperId] = useState(defaultKeeperId);
  const keeper = clients.find((c) => c.id === keeperId) ?? clients[0];
  const other = clients.find((c) => c.id !== keeper.id)!;

  const [values, setValues] = useState(() => defaultsFor(keeper, other));

  const changeKeeper = (id: string) => {
    setKeeperId(id);
    const k = clients.find((c) => c.id === id)!;
    const o = clients.find((c) => c.id !== id)!;
    setValues(defaultsFor(k, o));
  };

  useEffect(() => {
    const name = values.name.trim();
    onChange(
      name
        ? {
            keeperId: keeper.id,
            otherId: other.id,
            name,
            surname: values.surname.trim() || null,
            phone: values.phone,
            email: values.email,
          }
        : null,
    );
    // onChange is a callback from the parent; re-run only when the decision itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keeper.id, other.id, values]);

  const phones = [...new Set(clients.map((c) => c.client_phone).filter((p): p is string => !!p))];
  const emails = [...new Set(clients.map((c) => c.client_email).filter((e): e is string => !!e))];
  const fullNames = [...new Set(clients.map((c) => fullName(c)).filter(Boolean))];
  const resultName = [values.name.trim(), values.surname.trim()].filter(Boolean).join(" ");
  const contact = [values.phone && formatPhone(values.phone), values.email].filter(Boolean).join(" · ");

  const choiceRow = (label: string, options: string[], value: string | null, set: (v: string) => void, format = (v: string) => v) => (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {options.length > 1 ? (
        <RadioGroup row value={value ?? ""} onChange={(e) => set(e.target.value)}>
          {options.map((o) => (
            <FormControlLabel
              key={o}
              value={o}
              control={<Radio size="small" disabled={busy} />}
              label={<Typography variant="body2">{format(o)}</Typography>}
            />
          ))}
        </RadioGroup>
      ) : (
        <Typography variant="body2">{options[0] ? format(options[0]) : "—"}</Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 64 }}>{t("colKeep")}</TableCell>
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
            {clients.map((c) => (
              <TableRow key={c.id} selected={c.id === keeper.id}>
                <TableCell>
                  <Radio size="small" checked={c.id === keeper.id} onChange={() => changeKeeper(c.id)} disabled={busy} />
                </TableCell>
                <TableCell>{fullName(c) || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{c.client_phone ? formatPhone(c.client_phone) : "—"}</TableCell>
                <TableCell>{c.client_email || "—"}</TableCell>
                <TableCell align="right">{c.bookings}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(c.first_visit)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(c.last_visit)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(c.created_at)}</TableCell>
                <TableCell align="right">{c.vouchers || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          size="small"
          label={t("nameToKeep")}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          disabled={busy}
          error={!values.name.trim()}
          sx={{ minWidth: 180 }}
        />
        <TextField
          size="small"
          label={t("surnameToKeep")}
          value={values.surname}
          onChange={(e) => setValues((v) => ({ ...v, surname: e.target.value }))}
          disabled={busy}
          sx={{ minWidth: 180 }}
        />
      </Box>
      {fullNames.length > 1 && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: -0.5 }}>
          <Typography variant="caption" color="text.secondary">{t("useNameFrom")}</Typography>
          {clients.map((c) => (
            <Chip
              key={c.id}
              size="small"
              variant="outlined"
              label={fullName(c)}
              disabled={busy || !fullName(c)}
              onClick={() => setValues((v) => ({ ...v, name: trimmed(c.client_name), surname: trimmed(c.client_surname) }))}
            />
          ))}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>{t("nameToKeepHint")}</Typography>

      {phones.length > 0 &&
        choiceRow(t("phoneToKeep"), phones, values.phone, (p) => setValues((v) => ({ ...v, phone: p })), formatPhone)}
      {emails.length > 0 &&
        choiceRow(t("emailToKeep"), emails, values.email, (e) => setValues((v) => ({ ...v, email: e })))}

      <Box>
        <Typography variant="body2" fontWeight={600}>
          {t("mergeResult", {
            name: resultName || "—",
            contact: contact || t("noContact"),
            bookings: keeper.bookings + other.bookings,
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("mergeResultDetail", { other: fullName(other) || "—" })}
        </Typography>
      </Box>
    </Box>
  );
};

export default ClientMergeForm;
