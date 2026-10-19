"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Radio,
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

export type DuplicateKind = "same" | "similar" | "different";

export type DuplicateMember = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_notes: string | null;
  created_at: string;
  bookings: number;
  last_visit: string | null;
  vouchers: number;
};

export type DuplicateGroup = {
  phone: string;
  kind: DuplicateKind;
  members: DuplicateMember[];
};

export type GroupDecision = {
  keeperId: string;
  mergeIds: string[];
  separateIds: string[];
  name: string;
  separationNote?: string;
};

type Action = "merge" | "separate";

export const fullName = (m: { client_name: string | null; client_surname: string | null }) =>
  [m.client_name, m.client_surname].map((s) => s?.trim()).filter(Boolean).join(" ");

/** The decision a "same name" group gets by default: keep the most-booked record, fold the rest in. */
export function defaultDecision(group: DuplicateGroup): GroupDecision {
  const [keeper, ...rest] = group.members;
  return {
    keeperId: keeper.id,
    mergeIds: rest.map((m) => m.id),
    separateIds: [],
    name: keeper.client_name?.trim() || fullName(keeper),
  };
}

const KIND_CHIP: Record<DuplicateKind, "success" | "info" | "warning"> = {
  same: "success",
  similar: "info",
  different: "warning",
};

type Props = {
  group: DuplicateGroup;
  busy: boolean;
  onApply: (decision: GroupDecision) => void;
};

const DuplicateGroupCard = ({ group, busy, onApply }: Props) => {
  const t = useTranslations("ClientDuplicates");
  const members = group.members;

  // Groups whose names genuinely differ start with NO decision: a couple sharing a phone
  // (Adam / Ruth) must be told apart by a person, never by a default. The rest default to merge.
  const initialAction: Action | undefined = group.kind === "different" ? undefined : "merge";

  const [keeperId, setKeeperId] = useState(members[0].id);
  const [actions, setActions] = useState<Record<string, Action | undefined>>(() =>
    Object.fromEntries(members.slice(1).map((m) => [m.id, initialAction])),
  );
  const keeper = members.find((m) => m.id === keeperId)!;
  const [name, setName] = useState(() => keeper.client_name?.trim() || fullName(keeper));
  // Once the reviewer types or picks a name it is used as-is. Until then the name follows the
  // records in play — which is how an empty kept name becomes "Rosario" from a merged record.
  const [nameEdited, setNameEdited] = useState(false);

  const changeKeeper = (id: string) => {
    if (id === keeperId) return;
    const next = members.find((m) => m.id === id)!;
    setActions((prev) => {
      const copy = { ...prev };
      delete copy[id];
      copy[keeperId] = initialAction;   // the previous keeper now needs a decision of its own
      return copy;
    });
    setKeeperId(id);
    setName(next.client_name?.trim() || fullName(next));
    setNameEdited(false);
  };

  const others = members.filter((m) => m.id !== keeperId);
  const mergeRows = others.filter((m) => actions[m.id] === "merge");
  const separateRows = others.filter((m) => actions[m.id] === "separate");
  const decided = others.every((m) => actions[m.id] !== undefined);
  const pickName = (value: string) => {
    setName(value);
    setNameEdited(true);
  };

  // Suggestions come from every record that will become this client (the keeper and those merged),
  // but the field is free text: the stored spellings can all be wrong ("Dario" twice, for Darío).
  const nameOptions = [
    ...new Set(
      [keeper, ...mergeRows].map((m) => m.client_name?.trim()).filter((n): n is string => !!n),
    ),
  ];
  const effectiveName = (
    nameEdited ? name : nameOptions.includes(name) ? name : nameOptions[0] ?? name
  ).trim();

  const totalBookings = keeper.bookings + mergeRows.reduce((s, m) => s + m.bookings, 0);
  const displayPhone = formatPhone(group.phone);

  const apply = () =>
    onApply({
      keeperId,
      mergeIds: mergeRows.map((m) => m.id),
      separateIds: separateRows.map((m) => m.id),
      name: effectiveName,
      separationNote: separateRows.length
        ? t("sharedPhoneNote", { phone: displayPhone, name: effectiveName })
        : undefined,
    });

  return (
    <Paper variant="outlined" sx={{ p: 2, opacity: busy ? 0.6 : 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {displayPhone}
        </Typography>
        <Chip
          size="small"
          color={KIND_CHIP[group.kind]}
          variant={group.kind === "different" ? "filled" : "outlined"}
          label={t(group.kind === "same" ? "kindSame" : group.kind === "similar" ? "kindSimilar" : "kindDifferent")}
        />
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 64 }}>{t("colKeep")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colName")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colPhone")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colEmail")}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{t("colBookings")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colLastVisit")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colCreated")}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{t("colVouchers")}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t("colDecision")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => {
              const isKeeper = m.id === keeperId;
              return (
                <TableRow key={m.id} selected={isKeeper}>
                  <TableCell>
                    <Radio
                      size="small"
                      checked={isKeeper}
                      onChange={() => changeKeeper(m.id)}
                      disabled={busy}
                    />
                  </TableCell>
                  <TableCell>{fullName(m) || "—"}</TableCell>
                  {/* As stored, on purpose: the different spellings are why these became duplicates. */}
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {m.client_phone}
                  </TableCell>
                  <TableCell>{m.client_email || "—"}</TableCell>
                  <TableCell align="right">{m.bookings}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(m.last_visit)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatBusinessDate(m.created_at)}</TableCell>
                  <TableCell align="right">{m.vouchers || "—"}</TableCell>
                  <TableCell>
                    {isKeeper ? (
                      <Chip size="small" color="primary" label={t("kept")} />
                    ) : (
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={actions[m.id] ?? null}
                        disabled={busy}
                        onChange={(_, v: Action | null) => {
                          if (v) setActions((prev) => ({ ...prev, [m.id]: v }));
                        }}
                        sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: "0.7rem", whiteSpace: "nowrap" } }}
                      >
                        <ToggleButton value="merge">{t("samePerson")}</ToggleButton>
                        <ToggleButton value="separate">{t("differentPerson")}</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
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

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          {!decided ? (
            <Alert severity="warning" sx={{ py: 0 }}>{t("decideAll")}</Alert>
          ) : (
            <>
              <Typography variant="body2" fontWeight={600}>
                {mergeRows.length > 0
                  ? t("previewMerge", { name: effectiveName, phone: displayPhone, bookings: totalBookings })
                  : t("previewKeepOnly", { name: effectiveName, phone: displayPhone })}
              </Typography>
              {separateRows.map((m) => (
                <Typography key={m.id} variant="body2" color="text.secondary">
                  {t("previewSeparate", { name: fullName(m) || "—" })}
                </Typography>
              ))}
            </>
          )}
        </Box>
        <Button variant="contained" size="small" disabled={!decided || busy || !effectiveName} onClick={apply}>
          {t("apply")}
        </Button>
      </Box>
    </Paper>
  );
};

export default DuplicateGroupCard;
