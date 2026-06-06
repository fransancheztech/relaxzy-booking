"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
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
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import AddLinkIcon from "@mui/icons-material/AddLink";
import { startOfDay, endOfDay } from "date-fns";
import { toast } from "react-toastify";

type Member = {
  id: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  client: { id: string; name: string | null; surname: string | null } | null;
  service: { id: string; name: string } | null;
  therapist: { id: string; full_name: string } | null;
};

type Candidate = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  short_service_name: string | null;
  service_name: string | null;
  start_time: string | null;
  status: string;
  booking_group_id: string | null;
};

type Props = {
  bookingId: string;
  bookingGroupId: string | null;
  readOnly?: boolean;
  onMemberClick?: (id: string) => void;
  onGroupChanged?: () => void;
};

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";

const BookingGroupSection = ({
  bookingId,
  bookingGroupId,
  readOnly,
  onMemberClick,
  onGroupChanged,
}: Props) => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");

  const [members, setMembers] = useState<Member[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!bookingId || !bookingGroupId) {
      setMembers([]);
      return;
    }
    try {
      const res = await fetch(`/api/bookings/${bookingId}/group`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load group");
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch (err) {
      console.error(err);
      setMembers([]);
    }
  }, [bookingId, bookingGroupId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || t("removeFromGroupError"));
        return;
      }
      toast.success(t("removeFromGroupSuccess"));
      window.dispatchEvent(new CustomEvent("refreshCalendarData"));
      window.dispatchEvent(new CustomEvent("refreshBookingsData"));
      onGroupChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(t("removeFromGroupError"));
    } finally {
      setRemoving(false);
      setConfirmOpen(false);
    }
  };

  // Same-day bookings that can be linked: not this one, not already grouped, not cancelled.
  const openAddDialog = async () => {
    setAddOpen(true);
    setLoadingCandidates(true);
    setCandidates([]);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load booking");
      const booking = await res.json();
      const day = booking.start_time ? new Date(booking.start_time) : new Date();
      const params = new URLSearchParams({
        start: startOfDay(day).toISOString(),
        end: endOfDay(day).toISOString(),
      });
      const rangeRes = await fetch(`/api/bookings/range?${params}`, { cache: "no-store" });
      if (!rangeRes.ok) throw new Error("Failed to load bookings");
      const rows: Candidate[] = await rangeRes.json();
      setCandidates(
        rows.filter(
          (c) =>
            c.id !== bookingId &&
            !c.booking_group_id &&
            c.status !== "cancelled",
        ),
      );
    } catch (err) {
      console.error(err);
      toast.error(t("addToGroupError"));
      setAddOpen(false);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAdd = async (targetId: string) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || t("addToGroupError"));
        return;
      }
      toast.success(t("addToGroupSuccess"));
      window.dispatchEvent(new CustomEvent("refreshCalendarData"));
      window.dispatchEvent(new CustomEvent("refreshBookingsData"));
      setAddOpen(false);
      onGroupChanged?.();
      loadMembers();
    } catch (err) {
      console.error(err);
      toast.error(t("addToGroupError"));
    } finally {
      setAdding(false);
    }
  };

  const others = members.filter((m) => m.id !== bookingId);

  return (
    <>
      <Grid size={12}>
        {/* Header: title on the left, group actions on the right (kept away from the
            member chips so it's clear the actions apply to this booking/group). */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <GroupsIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" color="text.secondary">
            {bookingGroupId
              ? `${t("groupSection")} · ${t("groupOf", { count: members.length })}`
              : t("groupSection")}
          </Typography>
          {!readOnly && (
            <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
              <Tooltip title={t("addToGroupTooltip")}>
                <span>
                  <Button
                    size="small"
                    startIcon={<AddLinkIcon />}
                    onClick={openAddDialog}
                    disabled={adding}
                  >
                    {t("addToGroup")}
                  </Button>
                </span>
              </Tooltip>
              {bookingGroupId && (
                <Tooltip title={t("removeFromGroupTooltip")}>
                  <span>
                    <Button
                      size="small"
                      color="warning"
                      startIcon={<LinkOffIcon />}
                      onClick={() => setConfirmOpen(true)}
                      disabled={removing}
                    >
                      {t("removeFromGroup")}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
        <Divider sx={{ mt: 0.5 }} />
      </Grid>
      <Grid size={12}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          {others.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              {bookingGroupId ? "—" : t("notInGroup")}
            </Typography>
          ) : (
            others.map((m) => {
              const name =
                [m.client?.name, m.client?.surname].filter(Boolean).join(" ").trim() || "Walk-in";
              const parts = [name, m.service?.name, m.therapist?.full_name, fmtTime(m.start_time)].filter(
                Boolean,
              );
              return (
                <Chip
                  key={m.id}
                  size="small"
                  label={parts.join(" · ")}
                  onClick={onMemberClick ? () => onMemberClick(m.id) : undefined}
                  variant="outlined"
                />
              );
            })
          )}
        </Box>
      </Grid>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t("removeFromGroup")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("confirmRemoveFromGroup")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={removing}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleRemove} color="warning" disabled={removing}>
            {t("removeFromGroup")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("addToGroupTitle")}</DialogTitle>
        <DialogContent dividers>
          {loadingCandidates ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : candidates.length === 0 ? (
            <DialogContentText>{t("addToGroupEmpty")}</DialogContentText>
          ) : (
            <List dense disablePadding>
              {candidates.map((c) => {
                const name =
                  [c.client_name, c.client_surname].filter(Boolean).join(" ").trim() || "Walk-in";
                const secondary = [c.short_service_name ?? c.service_name, fmtTime(c.start_time)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <ListItemButton key={c.id} onClick={() => handleAdd(c.id)} disabled={adding}>
                    <ListItemText primary={name} secondary={secondary} />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={adding}>
            {tCommon("cancel")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BookingGroupSection;
