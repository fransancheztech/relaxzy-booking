"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import LinkOffIcon from "@mui/icons-material/LinkOff";
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

type Props = {
  bookingId: string;
  bookingGroupId: string | null;
  readOnly?: boolean;
  onMemberClick?: (id: string) => void;
  onGroupChanged?: () => void;
};

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

  const loadMembers = useCallback(async () => {
    if (!bookingId || !bookingGroupId) {
      setMembers([]);
      return;
    }
    try {
      const res = await fetch(`/api/bookings/${bookingId}/group`, {
        cache: "no-store",
      });
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

  if (!bookingGroupId) return null;

  const others = members.filter((m) => m.id !== bookingId);

  return (
    <>
      <Grid size={12}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GroupsIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" color="text.secondary">
            {t("groupSection")} · {t("groupOf", { count: members.length })}
          </Typography>
        </Box>
        <Divider />
      </Grid>
      <Grid size={12}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          {others.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          ) : (
            others.map((m) => {
              const name = [m.client?.name, m.client?.surname]
                .filter(Boolean)
                .join(" ")
                .trim() || "Walk-in";
              const time = m.start_time
                ? new Date(m.start_time).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              const parts = [name, m.service?.name, m.therapist?.full_name, time].filter(
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
          {!readOnly && (
            <Box sx={{ ml: "auto" }}>
              <Button
                size="small"
                color="warning"
                startIcon={<LinkOffIcon />}
                onClick={() => setConfirmOpen(true)}
                disabled={removing}
              >
                {t("removeFromGroup")}
              </Button>
            </Box>
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
    </>
  );
};

export default BookingGroupSection;
