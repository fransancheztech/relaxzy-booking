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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "@/app/context/LayoutContext";
import { formatBusinessDateTime } from "@/utils/businessTime";
import {
  IMPORT_FILES,
  REVIEW_KINDS,
  type ClientSnapshot,
  type OnlineOrderDecision,
  type OnlineOrderDetails,
  type NameProposal,
  type ReviewAction,
  type ReviewError,
  type ReviewItem,
  type ReviewKind,
  type ReviewListResponse,
  type VoucherCardDecision,
  type VoucherCardDetails,
  type VoucherCardProposal,
} from "@/lib/review/types";
import ReviewItemCard, { clientFullName, phoneRank, type DecidePayload } from "./ReviewItemCard";
import VoucherCardReview from "./VoucherCardReview";
import OnlineOrderReview from "./OnlineOrderReview";
import { ymd } from "./VoucherParts";

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
  return items; // client_inactive and vouchers: by date, as the API sends them
}

/** A short name for an item in toasts and in the list of decisions. */
function itemLabel(item: ReviewItem): string {
  if (item.kind === "voucher_card") {
    const c = item.details as VoucherCardDetails;
    return `${ymd(c.fecha)} ${c.de || "—"} → ${c.para || "—"}`;
  }
  if (item.kind === "voucher_online_order") {
    const o = item.details as OnlineOrderDetails;
    return `#${o.invoice} ${o.buyer}`;
  }
  return clientFullName(item.details as ClientSnapshot);
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
      VOUCHER_NOT_FOUND: t("errorVoucherNotFound"),
      NOTE_REQUIRED: t("errorNoteRequired"),
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

  // Upload of an imported tab's file (tarjetas.json, pedidos_online.json): read in the browser, sent as JSON.
  const fileInput = useRef<HTMLInputElement>(null);
  const importFile = async (file: File) => {
    let items: unknown;
    try {
      items = JSON.parse(await file.text());
    } catch {
      toast.error(t("importInvalid"));
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/review/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, items }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) toast.success(t("importDone", { imported: body.imported ?? 0, added: body.added ?? 0, auto: body.autoDecided ?? 0 }));
      else toast.error(body.error === "INVALID_FILE" ? t("importInvalid") : t("importFailed"));
    } catch {
      toast.error(t("importFailed"));
    } finally {
      await refresh(kind);
      setSearching(false);
    }
  };

  // Opening a tab loads it; a check that has never found anything runs once by itself. Imported
  // tabs have nothing to search until their file is uploaded.
  useEffect(() => {
    let cancelled = false;
    currentKind.current = kind;
    setLoading(true);
    setPosition(0);
    (async () => {
      const body = await refresh(kind);
      if (cancelled) return;
      const c = body?.counts[kind];
      if (c && c.open + c.deferred + c.decided === 0 && !IMPORT_FILES[kind] && !autoSearched.current.has(kind)) {
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

    const isNameCheck = item.kind === "client_missing_accent" || item.kind === "client_surname_in_name";
    const name = action === "apply" && isNameCheck
      ? clientFullName({ client_name: payload.client_name, client_surname: payload.client_surname })
      : itemLabel(item);
    if (action === "later") {
      toast.info(t("deferredToast", { name }));
    } else {
      const message = item.kind === "client_inactive"
        ? (action === "apply" ? t("retiredToast", { name }) : t("keptClientToast", { name }))
        : !isNameCheck ? t("recordedToast", { name })
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
    if (item.kind === "voucher_card") {
      const d = item.decision as unknown as VoucherCardDecision;
      const p = item.proposal as VoucherCardProposal | null;
      const codes = d.voucher_ids.map((id) => p?.candidates.find((c) => c.id === id)?.code ?? "?").join(", ");
      const what = d.link === "system" ? t("outcomeLinked", { codes })
        : d.link === "online_order" ? t("outcomeOnline", { invoice: d.invoice ?? 0 })
          : t("outcomeMissing");
      return { text: itemLabel(item), outcome: d.used === "unrecorded" ? `${what} · ${t("usage.unrecorded")}` : what };
    }
    if (item.kind === "voucher_online_order") {
      const d = item.decision as unknown as OnlineOrderDecision;
      return { text: itemLabel(item), outcome: t(`orderOutcome.${d.outcome}`) };
    }
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

      {IMPORT_FILES[kind] && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importFile(file);
            }}
          />
          <Button size="small" variant="outlined" startIcon={<UploadFileIcon fontSize="small" />} disabled={searching || busy}
            onClick={() => fileInput.current?.click()}>
            {t("importButton", { file: IMPORT_FILES[kind] ?? "" })}
          </Button>
          <Typography variant="caption" color="text.secondary">{t("importHint", { file: IMPORT_FILES[kind] ?? "" })}</Typography>
        </Box>
      )}

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
          {(() => {
            const key = `${current.id}:${current.updated_at}`;
            const props = {
              item: current,
              busy: busy || searching,
              onDecide: (action: ReviewAction, payload: DecidePayload) => decide(current, action, payload),
            };
            if (current.kind === "voucher_card") return <VoucherCardReview key={key} {...props} />;
            if (current.kind === "voucher_online_order") return <OnlineOrderReview key={key} {...props} />;
            return <ReviewItemCard key={key} {...props} />;
          })()}
        </Box>
      ) : (
        !loadFailed && (
          IMPORT_FILES[kind] && shown.open + shown.deferred + shown.decided === 0
            ? <Alert severity="info">{t("importFirst", { file: IMPORT_FILES[kind] ?? "" })}</Alert>
            : <Alert severity="success">{view === "open" ? t("allDone") : t("noneDeferred")}</Alert>
        )
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
                  {!item.decided_by && <Chip size="small" label={t("autoChip")} />}
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
