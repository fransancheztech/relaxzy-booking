"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { formatBusinessDateTime } from "@/utils/businessTime";
import {
  REVIEW_KINDS,
  type ClientSnapshot,
  type NameProposal,
  type ReviewAction,
  type ReviewError,
  type ReviewItem,
  type ReviewKind,
  type ReviewListResponse,
} from "@/lib/review/types";
import ReviewItemCard, { clientFullName, phoneRank, type DecidePayload } from "./ReviewItemCard";

type View = "open" | "deferred";

// Errors after which the list no longer matches the data: the check runs again before showing more.
const RESEARCH_ON: ReviewError[] = ["STALE_ITEM", "ALREADY_DECIDED", "CLIENT_NOT_FOUND", "CLIENT_HAS_HISTORY"];

const byName = (a: ReviewItem, b: ReviewItem) =>
  clientFullName(a.details as ClientSnapshot).localeCompare(clientFullName(b.details as ClientSnapshot), "es");

/** The order items are shown in. Spanish phones first for accents: they are the likely real misses. */
function sortItems(kind: ReviewKind, items: ReviewItem[]): ReviewItem[] {
  if (kind === "client_missing_accent") {
    return [...items].sort((a, b) =>
      phoneRank((a.details as ClientSnapshot).client_phone) - phoneRank((b.details as ClientSnapshot).client_phone)
      || byName(a, b));
  }
  if (kind === "client_surname_in_name") return [...items].sort(byName);
  return items; // client_inactive: oldest client first, as the API sends them
}

const ReviewPageContent = () => {
  const t = useTranslations("Review");
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [kind, setKind] = useState<ReviewKind>("client_missing_accent");
  const [view, setView] = useState<View>("open");
  // The latest answer, tagged with its tab: the counts are shown on every tab, the items only on their own.
  const [data, setData] = useState<{ kind: ReviewKind; body: ReviewListResponse } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  // The tab on screen, so an answer for a tab the user already left is ignored.
  const currentKind = useRef(kind);
  // Checks already run automatically this visit (the first time a tab has no items at all).
  const autoSearched = useRef(new Set<ReviewKind>());

  useEffect(() => {
    setButtonLabel("");
    setOnButtonClick(null);
    return () => { setButtonLabel(""); setOnButtonClick(null); };
  }, [setButtonLabel, setOnButtonClick]);

  const errorText = useCallback((code: string | undefined) => {
    const messages: Partial<Record<ReviewError, string>> = {
      STALE_ITEM: t("errorStale"),
      ALREADY_DECIDED: t("errorAlreadyDecided"),
      INVALID_NAME: t("errorInvalidName"),
      CLIENT_NOT_FOUND: t("errorClientNotFound"),
      CLIENT_HAS_HISTORY: t("errorClientHasHistory"),
      CHANGED_SINCE: t("errorChangedSince"),
      CONTACT_TAKEN: t("errorContactTaken"),
    };
    return messages[code as ReviewError] ?? t("errorFailed");
  }, [t]);

  const refresh = useCallback(async (k: ReviewKind): Promise<ReviewListResponse | null> => {
    try {
      const res = await fetch(`/api/review?kind=${k}`);
      if (!res.ok) throw new Error();
      const body = (await res.json()) as ReviewListResponse;
      if (currentKind.current === k) {
        setData({ kind: k, body });
        setLoadFailed(false);
      }
      return body;
    } catch {
      if (currentKind.current === k) setLoadFailed(true);
      return null;
    }
  }, []);

  const search = useCallback(async (k: ReviewKind, announce: boolean) => {
    setSearching(true);
    try {
      const res = await fetch("/api/review/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: k }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      if (announce) toast.success(t("searchDone", { added: body.added ?? 0, removed: body.removed ?? 0 }));
    } catch {
      toast.error(t("searchFailed"));
    } finally {
      await refresh(k);
      setSearching(false);
    }
  }, [refresh, t]);

  // Opening a tab loads it; a check that has never found anything runs once by itself.
  useEffect(() => {
    let cancelled = false;
    currentKind.current = kind;
    setLoading(true);
    setPosition(0);
    (async () => {
      const body = await refresh(kind);
      if (cancelled) return;
      const c = body?.counts[kind];
      if (c && c.open + c.deferred + c.decided === 0 && !autoSearched.current.has(kind)) {
        autoSearched.current.add(kind);
        await search(kind, false);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [kind, refresh, search]);

  const counts = data?.body.counts;
  const recent = data?.kind === kind ? data.body.recent : [];
  const items = sortItems(kind, (data?.kind === kind ? data.body.items : []).filter((i) => i.status === view));
  const index = Math.min(position, Math.max(items.length - 1, 0));
  const current = items[index];

  const reopen = async (item: ReviewItem, toastId?: string | number) => {
    if (toastId !== undefined) toast.dismiss(toastId);
    try {
      const res = await fetch(`/api/review/items/${item.id}/reopen`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) toast.success(t("undoneToast"));
      else toast.error(errorText(body.error));
    } catch {
      toast.error(t("errorFailed"));
    }
    await refresh(kind);
  };

  const decide = async (item: ReviewItem, action: ReviewAction, payload: DecidePayload) => {
    setBusy(true);
    let res: Response | null = null;
    let body: { error?: string } = {};
    try {
      res = await fetch(`/api/review/items/${item.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      body = await res.json().catch(() => ({}));
    } catch {
      // handled below as a failed save
    }
    setBusy(false);

    if (!res?.ok) {
      toast.error(errorText(body.error));
      if (RESEARCH_ON.includes(body.error as ReviewError)) await search(kind, false);
      return;
    }

    const name = action === "apply" && item.kind !== "client_inactive"
      ? clientFullName({ client_name: payload.client_name, client_surname: payload.client_surname })
      : clientFullName(item.details as ClientSnapshot);
    if (action === "later") {
      toast.info(t("deferredToast", { name }));
    } else {
      const message = item.kind === "client_inactive"
        ? (action === "apply" ? t("retiredToast", { name }) : t("keptClientToast", { name }))
        : (action === "apply" ? t("appliedToast", { name }) : t("keptToast", { name }));
      const id = toast.success(
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span>{message}</span>
          <Button size="small" color="inherit" onClick={() => reopen(item, id)} sx={{ fontWeight: 700 }}>
            {t("undo")}
          </Button>
        </Box>,
        { autoClose: 8000 },
      );
    }
    // The position stays, so the next item takes this one's place.
    await refresh(kind);
  };

  const shown = counts?.[kind] ?? { open: 0, deferred: 0, decided: 0 };

  const recentLine = (item: ReviewItem) => {
    const before = clientFullName(item.details as ClientSnapshot);
    const applied = item.decision?.action === "apply";
    if (item.kind === "client_inactive") {
      return { text: before, outcome: applied ? t("outcomeRetired") : t("outcomeKeptClient") };
    }
    const after = applied ? clientFullName(item.decision as unknown as NameProposal) : null;
    return { text: after ? `${before} → ${after}` : before, outcome: applied ? t("outcomeApplied") : t("outcomeKept") };
  };

  return (
    <Box sx={{ py: 3, px: 2, display: "flex", flexDirection: "column", gap: 2, maxWidth: 960 }}>
      <Box>
        <Typography variant="h6" fontWeight={700}>{t("title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("intro")}</Typography>
      </Box>

      <Tabs
        value={kind}
        onChange={(_, v: ReviewKind) => { setKind(v); setView("open"); }}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        {REVIEW_KINDS.map((k) => (
          <Tab
            key={k}
            value={k}
            disabled={busy}
            label={t("tabLabel", { label: t(`kind.${k}`), count: counts?.[k]?.open ?? 0 })}
          />
        ))}
      </Tabs>

      <Typography variant="body2" color="text.secondary">{t(`kindIntro.${kind}`)}</Typography>

      {loadFailed && <Alert severity="error">{t("loadFailed")}</Alert>}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v: View | null) => { if (v) { setView(v); setPosition(0); } }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1.25, fontSize: "0.75rem" } }}
        >
          <ToggleButton value="open">{t("viewOpen", { count: shown.open })}</ToggleButton>
          <ToggleButton value="deferred">{t("viewDeferred", { count: shown.deferred })}</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">{t("decidedCount", { count: shown.decided })}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={searching ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
          disabled={searching || busy}
          onClick={() => search(kind, true)}
        >
          {searching ? t("searching") : t("searchAgain")}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : current ? (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
            <IconButton size="small" aria-label={t("previous")} disabled={index === 0 || busy} onClick={() => setPosition(index - 1)}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {t("position", { index: index + 1, count: items.length })}
            </Typography>
            <IconButton
              size="small"
              aria-label={t("next")}
              disabled={index >= items.length - 1 || busy}
              onClick={() => setPosition(index + 1)}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
          <ReviewItemCard
            key={`${current.id}:${current.updated_at}`}
            item={current}
            busy={busy || searching}
            onDecide={(action, payload) => decide(current, action, payload)}
          />
        </Box>
      ) : (
        !loadFailed && <Alert severity="success">{view === "open" ? t("allDone") : t("noneDeferred")}</Alert>
      )}

      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t("recent")}</Typography>
        {!recent.length ? (
          <Typography variant="body2" color="text.secondary">{t("noRecent")}</Typography>
        ) : (
          <Paper variant="outlined">
            {recent.map((item, i) => {
              const line = recentLine(item);
              return (
                <Box
                  key={item.id}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 0.75, flexWrap: "wrap",
                    borderTop: i > 0 ? "1px solid" : "none", borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>
                    {formatBusinessDateTime(item.decided_at)}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 180 }}>{line.text}</Typography>
                  <Chip size="small" label={line.outcome} variant="outlined" />
                  <Button size="small" disabled={busy} onClick={() => reopen(item)}>{t("undo")}</Button>
                </Box>
              );
            })}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default ReviewPageContent;
