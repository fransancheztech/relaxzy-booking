"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import EditIcon from "@mui/icons-material/Edit";
import { BusinessDatePicker } from "@/components/BusinessDatePickers";
import { formatBusinessDate, formatBusinessDateTime } from "@/utils/businessTime";
import { formatMoney } from "@/utils/formatMoney";
import { toast } from "react-toastify";
import VoucherPaymentEventDialog from "./VoucherPaymentEventDialog";
import UpdateBookingDialogForm from "@/app/bookings/UpdateBookingDialogForm";
import ClientDropdown from "@/app/bookings/ClientDropdown";
import { useClientSearch, type FocusedClientField } from "@/hooks/useClientSearch";
import type { ClientRow } from "@/hooks/useSimilarClients";
import { CLIENT_CONTACT_TAKEN } from "@/types/clientConflict";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Client = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
};

type PaymentEvent = {
  id: string;
  amount: string | null;
  type: "CHARGE" | "REFUND" | null;
  method: "cash" | "credit_card" | null;
  notes: string | null;
  created_at: string;
};

type VoucherUse = {
  id: string;
  amount: string;
  notes: string | null;
  booking_id: string | null;
  created_at: string | null;
  booking: {
    id: string;
    start_time: string | null;
    deleted: boolean;
    client_name: string | null;
    service_name: string | null;
  } | null;
};

type VoucherSource = "physical" | "online";

type Details = {
  voucher: {
    id: string;
    code: string;
    balance: string | null;
    expiration_date: string;
    created_at: string | null;
    notes: string | null;
    source: VoucherSource;
    external_reference: string | null;
    buyer_id: string;
    recipient_id: string | null;
  };
  buyer: Client | null;
  recipient: Client | null;
  paymentEvents: PaymentEvent[];
  voucherUses: VoucherUse[];
};

interface EditData {
  buyer_name: string;
  buyer_surname: string;
  buyer_phone: string;
  buyer_email: string;
  recipient_name: string;
  recipient_surname: string;
  recipient_phone: string;
  recipient_email: string;
  created_at: Date | null;
  expiration_date: Date | null;
  notes: string;
  source: VoucherSource;
  external_reference: string;
}

type Props = {
  voucherId: string;
  open: boolean;
  onClose: () => void;
};

const formatDate = (value: string | null | undefined) => formatBusinessDate(value);
const formatDateTime = (value: string | null) => formatBusinessDateTime(value);

const clientLabel = (c: Client | null) => {
  if (!c) return "—";
  const name = [c.client_name, c.client_surname].filter(Boolean).join(" ");
  const contact = [c.client_phone, c.client_email].filter(Boolean).join(" · ");
  return [name, contact].filter(Boolean).join("  ·  ");
};

const VoucherDetailDialog = ({ voucherId, open, onClose }: Props) => {
  const t = useTranslations("Vouchers");
  const tCommon = useTranslations("Common");
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogMode, setPaymentDialogMode] = useState<"charge" | "refund">("charge");
  const [selectedEvent, setSelectedEvent] = useState<PaymentEvent | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteUse, setPendingDeleteUse] = useState<VoucherUse | null>(null);
  const [bookingToView, setBookingToView] = useState<string | null>(null);
  const [confirmDeleteVoucherOpen, setConfirmDeleteVoucherOpen] = useState(false);
  const { submitting: deletingVoucher, guard: deleteGuard } = useSubmitGuard();

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<EditData | null>(null);
  const { submitting: saving, guard: saveGuard } = useSubmitGuard();

  // Client autocomplete for the buyer/recipient fields while editing.
  const [focusedClient, setFocusedClient] = useState<{
    party: "buyer" | "recipient";
    kind: "name" | "surname" | "phone" | "email";
  } | null>(null);
  const clientBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_KIND: Record<"name" | "surname" | "phone" | "email", Exclude<FocusedClientField, null>> = {
    name: "client_name",
    surname: "client_surname",
    phone: "client_phone",
    email: "client_email",
  };

  const fp = focusedClient?.party;
  const { clients: clientMatches, clear: clearClientMatches } = useClientSearch({
    focusedField: focusedClient ? API_KIND[focusedClient.kind] : null,
    name: fp ? editData?.[`${fp}_name`] : undefined,
    surname: fp ? editData?.[`${fp}_surname`] : undefined,
    email: fp ? editData?.[`${fp}_email`] : undefined,
    phone: fp ? editData?.[`${fp}_phone`] : undefined,
  });

  const selectClient = (party: "buyer" | "recipient", c: ClientRow) => {
    setEditData((p) => {
      if (!p) return p;
      return party === "buyer"
        ? { ...p, buyer_name: c.client_name ?? "", buyer_surname: c.client_surname ?? "", buyer_phone: c.client_phone ?? "", buyer_email: c.client_email ?? "" }
        : { ...p, recipient_name: c.client_name ?? "", recipient_surname: c.client_surname ?? "", recipient_phone: c.client_phone ?? "", recipient_email: c.client_email ?? "" };
    });
    clearClientMatches();
    if (clientBlurTimer.current) clearTimeout(clientBlurTimer.current);
    setFocusedClient(null);
  };

  // A buyer/recipient text field with the shared client autocomplete dropdown.
  const clientField = (
    party: "buyer" | "recipient",
    kind: "name" | "surname" | "phone" | "email",
    label: string,
  ) => {
    const key = `${party}_${kind}` as `${"buyer" | "recipient"}_${"name" | "surname" | "phone" | "email"}`;
    const value = editData?.[key] ?? "";
    return (
      <Box sx={{ position: "relative" }}>
        <TextField
          size="small"
          fullWidth
          label={label}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setEditData((p) => (p ? { ...p, [key]: v } : p));
          }}
          onFocus={() => {
            if (clientBlurTimer.current) clearTimeout(clientBlurTimer.current);
            setFocusedClient({ party, kind });
          }}
          onBlur={() => {
            clientBlurTimer.current = setTimeout(() => setFocusedClient(null), 150);
          }}
        />
        {focusedClient?.party === party && focusedClient?.kind === kind && clientMatches.length > 0 && (
          <ClientDropdown clients={clientMatches} onSelect={(c) => selectClient(party, c)} query={value} />
        )}
      </Box>
    );
  };

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/vouchers/${voucherId}/details`);
      if (!res.ok) {
        setFetchError(t("errorLoadingDetails"));
        return;
      }
      setDetails(await res.json());
    } catch {
      setFetchError(t("errorLoadingDetails"));
    } finally {
      setLoading(false);
    }
  }, [voucherId]);

  useEffect(() => {
    if (open && voucherId) loadDetails();
  }, [open, voucherId, loadDetails]);

  // Reset edit state when details load
  useEffect(() => {
    if (details) {
      setEditData({
        buyer_name: details.buyer?.client_name ?? "",
        buyer_surname: details.buyer?.client_surname ?? "",
        buyer_phone: details.buyer?.client_phone ?? "",
        buyer_email: details.buyer?.client_email ?? "",
        recipient_name: details.recipient?.client_name ?? "",
        recipient_surname: details.recipient?.client_surname ?? "",
        recipient_phone: details.recipient?.client_phone ?? "",
        recipient_email: details.recipient?.client_email ?? "",
        created_at: details.voucher.created_at ? new Date(details.voucher.created_at) : null,
        expiration_date: details.voucher.expiration_date ? new Date(details.voucher.expiration_date) : null,
        notes: details.voucher.notes ?? "",
        source: details.voucher.source,
        // Online refs are stored with a leading "#" but the input shows it as an adornment,
        // so strip it for the editable value to avoid "##44" on screen. The backend re-adds it on save.
        external_reference:
          details.voucher.source === "online" && details.voucher.external_reference?.startsWith("#")
            ? details.voucher.external_reference.slice(1)
            : details.voucher.external_reference ?? "",
      });
      setEditMode(false);
    }
  }, [details]);

  const handlePaymentSuccess = useCallback(() => {
    loadDetails();
    window.dispatchEvent(new CustomEvent("refreshVouchersData"));
  }, [loadDetails]);

  const confirmDeleteUse = async () => {
    if (!pendingDeleteUse) return;
    const use = pendingDeleteUse;
    setPendingDeleteUse(null);
    setDeletingId(use.id);
    try {
      const res = await fetch(`/api/voucher-uses/${use.id}/delete`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error || "Error deleting voucher use");
        return;
      }
      toast.success(t("voucherUseDeleted"));
      loadDetails();
      window.dispatchEvent(new CustomEvent("refreshVouchersData"));
    } catch {
      toast.error(t("networkError"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = () =>
    saveGuard(async () => {
      if (!editData) return;
      try {
        const res = await fetch(`/api/vouchers/${voucherId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...editData,
            created_at: editData.created_at?.toISOString(),
            expiration_date: editData.expiration_date?.toISOString(),
          }),
        });
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          if (result?.error === CLIENT_CONTACT_TAKEN) {
            const name = result?.conflict?.name;
            toast.error(name ? t("contactTakenBy", { name }) : t("contactTaken"));
          } else {
            toast.error(t("errorSavingDetails"));
          }
          return;
        }
        toast.success(t("detailsSaved"));
        loadDetails();
        window.dispatchEvent(new CustomEvent("refreshVouchersData"));
      } catch {
        toast.error(t("errorSavingDetails"));
      }
    });

  const openRefund = (event: PaymentEvent) => {
    setSelectedEvent(event);
    setPaymentDialogMode("refund");
    setPaymentDialogOpen(true);
  };

  const openAddBalance = () => {
    setSelectedEvent(null);
    setPaymentDialogMode("charge");
    setPaymentDialogOpen(true);
  };

  const confirmDeleteVoucher = () =>
    deleteGuard(async () => {
      try {
        const res = await fetch(`/api/vouchers/${voucherId}`, { method: "DELETE" });
        const result = await res.json();
        if (!res.ok) {
          toast.error(result?.error || t("errorDeletingVoucher"));
          return;
        }
        toast.success(t("voucherDeleted"));
        setConfirmDeleteVoucherOpen(false);
        window.dispatchEvent(new CustomEvent("refreshVouchersData"));
        onClose();
      } catch {
        toast.error(t("networkError"));
      }
    });

  const currentBalance = details?.voucher.balance != null ? Number(details.voucher.balance) : 0;
  const canDeleteVoucher = Math.abs(currentBalance) < 0.005;

  const hasSeparateRecipient =
    details?.voucher.recipient_id != null &&
    details.voucher.recipient_id !== details.voucher.buyer_id;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <span>Voucher {details?.voucher.code ?? ""}</span>
            {details?.voucher.source && (
              <Chip
                label={
                  details.voucher.source === "online"
                    ? t("sourceOnline")
                    : t("sourcePhysical")
                }
                color={details.voucher.source === "online" ? "info" : "default"}
                size="small"
                variant="outlined"
              />
            )}
            {details?.voucher.balance != null && (
              <Chip
                label={`${t("balanceLabel")} ${formatMoney(Number(details.voucher.balance))}`}
                color="success"
                size="small"
              />
            )}
          </Box>
          <Button
            startIcon={<AddCircleIcon />}
            onClick={openAddBalance}
            variant="contained"
            color="success"
            size="small"
            disabled={loading}
          >
            {t("addBalance")}
          </Button>
        </DialogTitle>

        <DialogContent>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {fetchError && <Alert severity="error">{fetchError}</Alert>}

          {details && !loading && (
            <>
              {/* Voucher info section */}
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                {!editMode ? (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Typography variant="body2">
                        <strong>{t("buyer")}:</strong> {clientLabel(details.buyer)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>{t("recipient")}:</strong>{" "}
                        {hasSeparateRecipient ? clientLabel(details.recipient) : t("sameAsBuyer")}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <strong>{t("createdAt")}:</strong> {formatDate(details.voucher.created_at)}
                        {"  ·  "}
                        <strong>{t("expirationDate")}:</strong> {formatDate(details.voucher.expiration_date)}
                        {details.voucher.external_reference && (
                          <>{" · "}<strong>{t("externalReference")}:</strong> {details.voucher.external_reference}</>
                        )}
                        {details.voucher.notes && (
                          <>{" · "}<strong>{tCommon("notes")}:</strong> {details.voucher.notes}</>
                        )}
                      </Typography>
                    </Box>
                    <Tooltip title={tCommon("edit")}>
                      <IconButton size="small" onClick={() => setEditMode(true)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : (
                  <Grid container spacing={1.5}>
                      <Grid size={12}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {t("buyer")}
                        </Typography>
                      </Grid>
                      <Grid size={3}>{clientField("buyer", "name", tCommon("name"))}</Grid>
                      <Grid size={3}>{clientField("buyer", "surname", tCommon("surname"))}</Grid>
                      <Grid size={3}>{clientField("buyer", "phone", tCommon("phone"))}</Grid>
                      <Grid size={3}>{clientField("buyer", "email", tCommon("email"))}</Grid>

                      {hasSeparateRecipient && (
                        <>
                          <Grid size={12}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              {t("recipient")}
                            </Typography>
                          </Grid>
                          <Grid size={3}>{clientField("recipient", "name", tCommon("name"))}</Grid>
                          <Grid size={3}>{clientField("recipient", "surname", tCommon("surname"))}</Grid>
                          <Grid size={3}>{clientField("recipient", "phone", tCommon("phone"))}</Grid>
                          <Grid size={3}>{clientField("recipient", "email", tCommon("email"))}</Grid>
                        </>
                      )}

                      <Grid size={3}>
                        <BusinessDatePicker
                          label={t("createdAt")}
                          value={editData?.created_at ?? null}
                          onChange={(d) => setEditData((p) => p && ({ ...p, created_at: d }))}
                          disableFuture
                          slotProps={{ textField: { size: "small", fullWidth: true } }}
                        />
                      </Grid>
                      <Grid size={3}>
                        <BusinessDatePicker
                          label={t("expirationDate")}
                          value={editData?.expiration_date ?? null}
                          onChange={(d) => setEditData((p) => p && ({ ...p, expiration_date: d }))}
                          slotProps={{ textField: { size: "small", fullWidth: true } }}
                        />
                      </Grid>
                      <Grid size={3}>
                        <FormControl
                          fullWidth
                          sx={{
                            height: 40,
                            border: 1,
                            borderColor: "rgba(0, 0, 0, 0.23)",
                            borderRadius: 1,
                            px: 1.5,
                            position: "relative",
                            justifyContent: "center",
                            "&:hover": { borderColor: "text.primary" },
                          }}
                        >
                          <FormLabel
                            sx={{
                              position: "absolute",
                              top: -8,
                              left: 8,
                              bgcolor: "background.paper",
                              px: 0.5,
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                          >
                            {t("source")}
                          </FormLabel>
                          <RadioGroup
                            row
                            value={editData?.source ?? "physical"}
                            onChange={(e) =>
                              setEditData((p) =>
                                p && ({ ...p, source: e.target.value as VoucherSource })
                              )
                            }
                            sx={{ flexWrap: "nowrap" }}
                          >
                            <FormControlLabel
                              value="physical"
                              control={<Radio size="small" sx={{ p: 0.5 }} />}
                              label={<Typography variant="body2">{t("sourcePhysical")}</Typography>}
                              sx={{ mr: 1.5, ml: -0.5 }}
                            />
                            <FormControlLabel
                              value="online"
                              control={<Radio size="small" sx={{ p: 0.5 }} />}
                              label={<Typography variant="body2">{t("sourceOnline")}</Typography>}
                              sx={{ mr: 0 }}
                            />
                          </RadioGroup>
                        </FormControl>
                      </Grid>
                      <Grid size={3}>
                        <TextField size="small" fullWidth label={t("externalReference")}
                          value={editData?.external_reference ?? ""}
                          onChange={(e) => setEditData((p) => p && ({ ...p, external_reference: e.target.value }))}
                          slotProps={
                            editData?.source === "online"
                              ? {
                                  input: {
                                    startAdornment: (
                                      <InputAdornment position="start">#</InputAdornment>
                                    ),
                                  },
                                }
                              : undefined
                          }
                        />
                      </Grid>
                      <Grid size={12}>
                        <TextField size="small" fullWidth label={tCommon("notes")}
                          value={editData?.notes ?? ""}
                          onChange={(e) => setEditData((p) => p && ({ ...p, notes: e.target.value }))} />
                      </Grid>

                      <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button size="small" onClick={() => setEditMode(false)} disabled={saving}>
                          {tCommon("cancel")}
                        </Button>
                        <Button size="small" variant="contained" onClick={handleSave} disabled={saving}>
                          {saving ? tCommon("saving") : tCommon("saveChanges")}
                        </Button>
                      </Grid>
                    </Grid>
                )}
              </Paper>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                {t("paymentEvents")}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{tCommon("amount")}</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>{tCommon("method")}</TableCell>
                    <TableCell>{tCommon("notes")}</TableCell>
                    <TableCell>{t("date")}</TableCell>
                    <TableCell align="center">{t("action")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.paymentEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                        {t("noPaymentEvents")}
                      </TableCell>
                    </TableRow>
                  )}
                  {details.paymentEvents.map((pe) => (
                    <TableRow key={pe.id}>
                      <TableCell>
                        {pe.amount != null ? formatMoney(Number(pe.amount)) : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pe.type ?? "—"}
                          color={pe.type === "CHARGE" ? "success" : "warning"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {pe.method === "cash"
                          ? t("cash")
                          : pe.method === "credit_card"
                            ? t("creditCard")
                            : "—"}
                      </TableCell>
                      <TableCell>{pe.notes ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(pe.created_at)}</TableCell>
                      <TableCell align="center">
                        {pe.type === "CHARGE" && (
                          <Tooltip title="Refund">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => openRefund(pe)}
                            >
                              <CurrencyExchangeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                {t("voucherUses")}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{tCommon("amount")}</TableCell>
                    <TableCell>{t("booking")}</TableCell>
                    <TableCell>{tCommon("notes")}</TableCell>
                    <TableCell>{t("date")}</TableCell>
                    <TableCell align="center">{t("action")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.voucherUses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                        {t("noVoucherUses")}
                      </TableCell>
                    </TableRow>
                  )}
                  {details.voucherUses.map((vu) => (
                    <TableRow key={vu.id}>
                      <TableCell>{formatMoney(Number(vu.amount))}</TableCell>
                      <TableCell>
                        {!vu.booking_id ? (
                          "—"
                        ) : vu.booking ? (
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => setBookingToView(vu.booking!.id)}
                            sx={{ textTransform: "none", p: 0, minWidth: 0, textAlign: "left", lineHeight: 1.3 }}
                          >
                            {[
                              vu.booking.start_time ? formatBusinessDate(vu.booking.start_time) : null,
                              vu.booking.client_name,
                              vu.booking.service_name,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {vu.booking.deleted ? ` (${t("bookingDeleted")})` : ""}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{vu.notes ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(vu.created_at)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={tCommon("delete")}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setPendingDeleteUse(vu)}
                              disabled={deletingId === vu.id}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ display: "flex", justifyContent: "space-between" }}>
          <Tooltip
            title={canDeleteVoucher ? "" : t("cannotDeleteWithBalance")}
            placement="right"
          >
            <span>
              <Button
                startIcon={<DeleteIcon />}
                color="error"
                variant="contained"
                onClick={() => setConfirmDeleteVoucherOpen(true)}
                disabled={!details || !canDeleteVoucher || deletingVoucher}
              >
                {tCommon("delete")}
              </Button>
            </span>
          </Tooltip>
          <Button onClick={onClose} color="inherit">
            {tCommon("close")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDeleteVoucherOpen}
        onClose={() => setConfirmDeleteVoucherOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("deleteVoucherTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("deleteVoucherMessage", { code: details?.voucher.code ?? "" })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDeleteVoucherOpen(false)}
            disabled={deletingVoucher}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            onClick={confirmDeleteVoucher}
            disabled={deletingVoucher}
          >
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDeleteUse} onClose={() => setPendingDeleteUse(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("deleteUseTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDeleteUse
              ? t("deleteUseMessage", { amount: formatMoney(Math.abs(Number(pendingDeleteUse.amount))) })
              : ""}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeleteUse(null)}>{tCommon("cancel")}</Button>
          <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={confirmDeleteUse}>
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>

      <VoucherPaymentEventDialog
        open={paymentDialogOpen}
        mode={paymentDialogMode}
        voucherId={voucherId}
        defaultAmount={
          selectedEvent?.amount != null ? Number(selectedEvent.amount) : undefined
        }
        defaultMethod={selectedEvent?.method ?? undefined}
        onClose={() => setPaymentDialogOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* Booking opened from a voucher use — stacked on top of this dialog. */}
      {bookingToView && (
        <UpdateBookingDialogForm
          open={!!bookingToView}
          bookingId={bookingToView}
          onClose={() => setBookingToView(null)}
        />
      )}
    </>
  );
};

export default VoucherDetailDialog;
