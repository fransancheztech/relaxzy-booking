"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import type { ClientSummary } from "@/lib/clients/duplicates";
import type { ClientRow } from "@/hooks/useSimilarClients";
import { formatPhone, phoneDigits } from "@/utils/phone";
import { formatBusinessDate } from "@/utils/businessTime";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import ClientMergeForm, { type MergeDecision } from "./duplicates/ClientMergeForm";

type Props = {
  open: boolean;
  /** The client the dialog was opened from (by default the one merged away). */
  sourceId: string | null;
  sourceName: string;
  onClose: () => void;
  /** After a merge or its undo, so the caller can refresh what it shows. */
  onChanged: () => void;
};

const fullName = (c: { client_name?: string | null; client_surname?: string | null }) =>
  [c.client_name, c.client_surname].map((s) => s?.trim()).filter(Boolean).join(" ");

/** Which find-similar field a free-text search means: a phone, an email, or a name. */
const searchField = (q: string) =>
  q.includes("@") ? "client_email" : !/[a-z]/i.test(q) && phoneDigits(q).length >= 3 ? "client_phone" : "client_name";

/**
 * "Merge into another client…" (admin only): for duplicates the review screen can't detect —
 * e.g. one record has no phone at all. Step 1 finds the other record; step 2 is the same merge
 * form as the review screen. Goes through merge_clients(), so it is logged and undoable.
 */
const MergeIntoDialog = ({ open, sourceId, sourceName, onClose, onChanged }: Props) => {
  const t = useTranslations("Clients");
  const tDup = useTranslations("ClientDuplicates");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [pair, setPair] = useState<[ClientSummary, ClientSummary] | null>(null);
  const [loadingPair, setLoadingPair] = useState(false);
  const [decision, setDecision] = useState<MergeDecision | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setPair(null);
    setDecision(null);
  }, [open, sourceId]);

  useEffect(() => {
    const q = query.trim();
    if (!open || pair || q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/clients/find-similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: searchField(q), value: q, others: {} }),
          signal: controller.signal,
        });
        const rows: ClientRow[] = res.ok ? await res.json() : [];
        setResults(rows.filter((r) => r.id !== sourceId));
      } catch {
        // aborted by a newer keystroke
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, pair, sourceId]);

  const pickTarget = async (targetId: string) => {
    if (!sourceId) return;
    setLoadingPair(true);
    try {
      const res = await fetch(`/api/clients/merges/preview?a=${targetId}&b=${sourceId}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.clients) || body.clients.length !== 2) throw new Error();
      setPair(body.clients as [ClientSummary, ClientSummary]);
    } catch {
      toast.error(t("mergeLoadFailed"));
    } finally {
      setLoadingPair(false);
    }
  };

  const undo = async (mergeId: string, toastId: string | number) => {
    toast.dismiss(toastId);
    try {
      const res = await fetch(`/api/clients/merges/${mergeId}/undo`, { method: "POST" });
      if (res.ok) toast.success(tDup("undone"));
      else toast.error(tDup("undoFailed"));
    } catch {
      toast.error(tDup("undoFailed"));
    }
    onChanged();
  };

  const merge = () =>
    guard(async () => {
      if (!decision) return;
      const res = await fetch("/api/clients/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          body.error === "STALE_GROUP" ? tDup("stalePair")
            : body.error === "INVALID_NAME" ? tDup("invalidName")
            : body.error === "CONTACT_TAKEN" ? tDup("typoContactTaken")
            : tDup("resolveFailed"),
        );
        return;
      }
      const mergeId: string | null = body.mergeId ?? null;
      const name = [decision.name, decision.surname].filter(Boolean).join(" ");
      const id = toast.success(
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span>{tDup("mergedToast", { name })}</span>
          {mergeId && (
            <Button size="small" color="inherit" onClick={() => undo(mergeId, id)} sx={{ fontWeight: 700 }}>
              {tDup("undo")}
            </Button>
          )}
        </Box>,
        { autoClose: 10000 },
      );
      onChanged();
      onClose();
    });

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("mergeIntoTitle", { name: sourceName || "—" })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {!pair ? (
          <>
            <Typography variant="body2" color="text.secondary">{t("mergeIntoIntro")}</Typography>
            <TextField
              autoFocus
              size="small"
              label={t("mergeSearchLabel")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {searching ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                    </InputAdornment>
                  ),
                },
              }}
            />
            {/* Fixed-height list so results arriving don't make the dialog jump. */}
            <Paper variant="outlined" sx={{ height: 280, overflowY: "auto", opacity: loadingPair ? 0.5 : 1 }}>
              {results.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  {query.trim().length < 2 ? t("mergeSearchHint") : searching ? "" : t("mergeSearchEmpty")}
                </Typography>
              ) : (
                results.map((r, i) => (
                  <Box
                    key={r.id}
                    onClick={() => !loadingPair && pickTarget(r.id)}
                    sx={{
                      px: 2,
                      py: 1,
                      cursor: "pointer",
                      borderTop: i > 0 ? "1px solid" : "none",
                      borderColor: "divider",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>{fullName(r) || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[formatPhone(r.client_phone ?? null), r.client_email, r.created_at && t("mergeCreated", { date: formatBusinessDate(r.created_at) })]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                ))
              )}
            </Paper>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ py: 0 }}>{t("mergeIntoChoose")}</Alert>
            <ClientMergeForm
              key={`${pair[0].id}|${pair[1].id}`}
              clients={pair}
              defaultKeeperId={pair[0].id}
              busy={submitting}
              onChange={setDecision}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {pair && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => { setPair(null); setDecision(null); }}
            disabled={submitting}
            sx={{ mr: "auto" }}
          >
            {t("mergeBack")}
          </Button>
        )}
        <Button onClick={onClose} disabled={submitting}>{tCommon("cancel")}</Button>
        <Button
          variant="contained"
          startIcon={<MergeTypeIcon />}
          disabled={!pair || !decision || submitting}
          onClick={merge}
        >
          {t("mergeConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeIntoDialog;
