"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { formatBusinessDateTime } from "@/utils/businessTime";
import DuplicateGroupCard, {
  defaultDecision,
  fullName,
  type DuplicateGroup,
  type DuplicateKind,
  type GroupDecision,
} from "./DuplicateGroupCard";
import TypoPairCard, { type TypoMergeDecision, type TypoPair } from "./TypoPairCard";

type MergeEntry = {
  id: string;
  merged_at: string;
  undone_at: string | null;
  survivor_name: string;
  absorbed_names: string[];
  bookings_moved: number;
};

type Filter = "all" | DuplicateKind;
type Section = "phone" | "typos";

const postJson = async (
  url: string,
  payload: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<{ mergeId: string | null } | { error: string }> => {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { mergeId: body.mergeId ?? null } : { error: body.error ?? "RESOLVE_FAILED" };
  } catch {
    return { error: "RESOLVE_FAILED" };
  }
};

const resolveGroup = (decision: GroupDecision) => postJson("/api/clients/duplicates/resolve", decision);

const pairKey = (p: TypoPair) => `${p.a.id}|${p.b.id}`;

const DuplicatesPageContent = () => {
  const t = useTranslations("ClientDuplicates");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [typos, setTypos] = useState<TypoPair[]>([]);
  // Typo pairs held back until a number stops being shared (resolve its same-phone group first).
  const [typosWaiting, setTyposWaiting] = useState(0);
  const [section, setSection] = useState<Section>("phone");
  // The typo pair currently being written, so its card can't be submitted twice.
  const [busyPair, setBusyPair] = useState<string | null>(null);
  const [merges, setMerges] = useState<MergeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // The group currently being written (by phone), so its card can't be submitted twice.
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => { setButtonLabel(""); setOnButtonClick(null); };
  }, [setButtonLabel, setOnButtonClick]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clients/duplicates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(data.groups ?? []);
      setTypos(data.typos?.pairs ?? []);
      setTyposWaiting(data.typos?.waiting ?? 0);
      setMerges(data.merges ?? []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const undo = async (mergeId: string, toastId?: string | number) => {
    try {
      const res = await fetch(`/api/clients/merges/${mergeId}/undo`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (toastId !== undefined) toast.dismiss(toastId);
      if (res.ok) {
        toast.success(t("undone"));
      } else {
        const messages: Record<string, string> = {
          UNMERGE_ALREADY_UNDONE: t("alreadyUndone"),
          UNMERGE_SURVIVOR_MERGED_AWAY: t("survivorMergedAway"),
          CONTACT_TAKEN: t("undoContactTaken"),
          UNMERGE_OLD_FORMAT: t("undoOldFormat"),
        };
        toast.error(messages[body.error] ?? t("undoFailed"));
      }
    } catch {
      toast.error(t("undoFailed"));
    }
    load();
  };

  const apply = async (group: DuplicateGroup, decision: GroupDecision) => {
    setBusyPhone(group.phone);
    const result = await resolveGroup(decision);
    setBusyPhone(null);

    if ("error" in result) {
      toast.error(
        result.error === "STALE_GROUP" ? t("staleGroup")
          : result.error === "INVALID_NAME" ? t("invalidName")
          : t("resolveFailed"),
      );
      load();
      return;
    }

    // Undo straight from the confirmation, so a wrong merge costs one click to reverse.
    if (result.mergeId) {
      const mergeId = result.mergeId;
      const id = toast.success(
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span>{t("mergedToast", { name: decision.name })}</span>
          <Button size="small" color="inherit" onClick={() => undo(mergeId, id)} sx={{ fontWeight: 700 }}>
            {t("undo")}
          </Button>
        </Box>,
        { autoClose: 10000 },
      );
    } else {
      toast.success(t("separatedToast", { name: decision.name }));
    }
    setGroups((prev) => prev.filter((g) => g.phone !== group.phone));
    load();
  };

  const mergeTypo = async (pair: TypoPair, decision: TypoMergeDecision) => {
    setBusyPair(pairKey(pair));
    const result = await postJson("/api/clients/duplicates/resolve-typo", decision);
    setBusyPair(null);

    if ("error" in result) {
      toast.error(
        result.error === "STALE_GROUP" ? t("stalePair")
          : result.error === "INVALID_NAME" ? t("invalidName")
          : result.error === "CONTACT_TAKEN" ? t("typoContactTaken")
          : t("resolveFailed"),
      );
      load();
      return;
    }

    const mergeId = result.mergeId;
    const id = toast.success(
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span>{t("mergedToast", { name: decision.name })}</span>
        {mergeId && (
          <Button size="small" color="inherit" onClick={() => undo(mergeId, id)} sx={{ fontWeight: 700 }}>
            {t("undo")}
          </Button>
        )}
      </Box>,
      { autoClose: 10000 },
    );
    setTypos((prev) => prev.filter((p) => pairKey(p) !== pairKey(pair)));
    load();
  };

  const undoDismiss = async (pair: TypoPair, toastId: string | number) => {
    toast.dismiss(toastId);
    const result = await postJson("/api/clients/duplicates/dismiss", { aId: pair.a.id, bId: pair.b.id }, "DELETE");
    if ("error" in result) toast.error(t("dismissFailed"));
    else toast.success(t("dismissUndone"));
    load();
  };

  const dismissTypo = async (pair: TypoPair) => {
    setBusyPair(pairKey(pair));
    const result = await postJson("/api/clients/duplicates/dismiss", { aId: pair.a.id, bId: pair.b.id });
    setBusyPair(null);

    if ("error" in result) {
      toast.error(t("dismissFailed"));
      load();
      return;
    }

    const id = toast.success(
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span>{t("dismissedToast")}</span>
        <Button size="small" color="inherit" onClick={() => undoDismiss(pair, id)} sx={{ fontWeight: 700 }}>
          {t("undo")}
        </Button>
      </Box>,
      { autoClose: 10000 },
    );
    setTypos((prev) => prev.filter((p) => pairKey(p) !== pairKey(pair)));
    load();
  };

  const sameGroups = groups.filter((g) => g.kind === "same");

  // Sequential, one transaction per group: a failure stops nothing else and leaves that group
  // listed. Every merge lands in the log below and can be undone on its own.
  const runBulk = async () => {
    setBulkOpen(false);
    const targets = [...sameGroups];
    setBulk({ done: 0, total: targets.length });
    let merged = 0;
    let failed = 0;
    for (const [i, group] of targets.entries()) {
      const result = await resolveGroup(defaultDecision(group));
      if ("error" in result) failed++;
      else merged++;
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
    if (failed) toast.warning(t("bulkPartial", { merged, failed }));
    else toast.success(t("bulkDone", { merged }));
    load();
  };

  const counts: Record<Filter, number> = {
    all: groups.length,
    same: sameGroups.length,
    similar: groups.filter((g) => g.kind === "similar").length,
    different: groups.filter((g) => g.kind === "different").length,
  };
  const visible = filter === "all" ? groups : groups.filter((g) => g.kind === filter);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3, px: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => router.push("/clients")} sx={{ mb: 1 }}>
          {t("back")}
        </Button>
        <Typography variant="h6" fontWeight={700}>{t("title")}</Typography>
      </Box>

      {loadFailed && <Alert severity="error">{t("loadFailed")}</Alert>}

      <Tabs value={section} onChange={(_, v: Section) => setSection(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="phone" label={t("sectionSamePhone", { count: groups.length })} disabled={!!bulk} />
        <Tab value="typos" label={t("sectionTypos", { count: typos.length })} disabled={!!bulk} />
      </Tabs>

      {section === "typos" && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900 }}>
            {t("typosIntro")}
          </Typography>
          {typosWaiting > 0 && (
            <Alert severity="info">{t("typosWaiting", { count: typosWaiting })}</Alert>
          )}
          {!loadFailed && typos.length === 0 && (
            <Alert severity="success">{t("noTypos")}</Alert>
          )}
          {typos.map((p) => (
            <TypoPairCard
              key={pairKey(p)}
              pair={p}
              busy={busyPair === pairKey(p)}
              onMerge={(decision) => mergeTypo(p, decision)}
              onDismiss={() => dismissTypo(p)}
            />
          ))}
        </>
      )}

      {section === "phone" && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900 }}>
          {t("intro")}
        </Typography>
      )}

      {section === "phone" && groups.length > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v: Filter | null) => { if (v) setFilter(v); }}
            sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { py: 0.25, px: 1.25, fontSize: "0.75rem" } }}
          >
            <ToggleButton value="all">{t("filterAll", { count: counts.all })}</ToggleButton>
            <ToggleButton value="same">{t("filterSame", { count: counts.same })}</ToggleButton>
            <ToggleButton value="similar">{t("filterSimilar", { count: counts.similar })}</ToggleButton>
            <ToggleButton value="different">{t("filterDifferent", { count: counts.different })}</ToggleButton>
          </ToggleButtonGroup>
          {sameGroups.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              disabled={!!bulk || !!busyPhone}
              onClick={() => setBulkOpen(true)}
            >
              {t("bulkButton", { count: sameGroups.length })}
            </Button>
          )}
        </Stack>
      )}

      {bulk && (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>{t("bulkProgress", { done: bulk.done, count: bulk.total })}</Typography>
          <LinearProgress variant="determinate" value={(bulk.done / bulk.total) * 100} />
        </Box>
      )}

      {section === "phone" && !loadFailed && groups.length === 0 && (
        <Alert severity="success">{t("noGroups")}</Alert>
      )}

      {section === "phone" && visible.map((g) => (
        <DuplicateGroupCard
          key={g.phone}
          group={g}
          busy={!!bulk || busyPhone === g.phone}
          onApply={(decision) => apply(g, decision)}
        />
      ))}

      <Divider sx={{ my: 1 }} />

      <Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t("recentMerges")}</Typography>
        {merges.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t("noMerges")}</Typography>
        ) : (
          <Paper variant="outlined">
            {merges.map((m, i) => (
              <Box
                key={m.id}
                sx={{
                  display: "flex", alignItems: "center", gap: 2, px: 2, py: 1, flexWrap: "wrap",
                  borderTop: i > 0 ? "1px solid" : "none", borderColor: "divider",
                  opacity: m.undone_at ? 0.55 : 1,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>
                  {formatBusinessDateTime(m.merged_at)}
                </Typography>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>
                  {t("mergeLine", { absorbed: m.absorbed_names.join(", "), survivor: m.survivor_name })}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {t("bookingsMoved", { count: m.bookings_moved })}
                  </Typography>
                </Typography>
                {m.undone_at ? (
                  <Chip size="small" label={t("undoneChip")} />
                ) : (
                  <Button size="small" onClick={() => undo(m.id)}>{t("undo")}</Button>
                )}
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("bulkTitle", { count: sameGroups.length })}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("bulkBody")}</DialogContentText>
          <Box component="ul" sx={{ mt: 1.5, pl: 2.5, maxHeight: 200, overflowY: "auto", fontSize: "0.8rem", color: "text.secondary" }}>
            {sameGroups.map((g) => (
              <li key={g.phone}>
                {t("bulkItem", {
                  name: fullName(g.members[0]) || "—",
                  records: g.members.length,
                  bookings: g.members.reduce((s, m) => s + m.bookings, 0),
                })}
              </li>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>{tCommon("cancel")}</Button>
          <Button variant="contained" onClick={runBulk}>{t("bulkConfirm")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DuplicatesPageContent;
