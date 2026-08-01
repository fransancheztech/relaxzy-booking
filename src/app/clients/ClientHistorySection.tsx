"use client";

import { useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Divider, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { STATUS_COLORS } from "@/constants";
import { formatBusinessDate, formatBusinessTime } from "@/utils/businessTime";
import UpdateBookingDialogForm from "@/app/bookings/UpdateBookingDialogForm";

type HistoryRow = {
  id: string;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  price: number | string | null;
  service_name: string | null;
  therapist_name: string | null;
};

type HistoryData = {
  total: number;
  lastVisit: { start_time: string | null; therapist_name: string | null } | null;
  rows: HistoryRow[];
};

const ClientHistorySection = ({ clientId, open }: { clientId: string | null; open: boolean }) => {
  const t = useTranslations("Clients");
  const tBookings = useTranslations("Bookings");
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingToView, setBookingToView] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clientId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clients/${clientId}/bookings`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, clientId]);

  const statusChip = (status: string | null) => {
    const colors = (status ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] : null);
    return (
      <Chip
        size="small"
        label={status ? tBookings(status) : "—"}
        sx={{
          height: 18,
          fontSize: "0.65rem",
          fontWeight: 600,
          color: "#fff",
          bgcolor: colors?.bg ?? "grey.500",
        }}
      />
    );
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" color="text.secondary">{t("historyTitle")}</Typography>
      <Divider sx={{ mb: 1 }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : !data || data.rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
          {t("noHistory")}
        </Typography>
      ) : (
        <>
          {/* Summary: the receptionist's question — who did they last see — answered up top. */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "baseline", mb: 1 }}>
            {data.lastVisit && (
              <Typography variant="body2">
                {t("lastVisitLabel")}:{" "}
                <strong>{formatBusinessDate(data.lastVisit.start_time)}</strong>
                {" · "}
                <strong>{data.lastVisit.therapist_name ?? t("unassignedTherapist")}</strong>
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: data.lastVisit ? 1 : 0 }}>
              {t("bookingsCount", { count: data.total })}
            </Typography>
          </Box>

          <Box sx={{ maxHeight: 260, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            {data.rows.map((row, i) => {
              const cancelled = row.status === "cancelled";
              return (
                <Box
                  key={row.id}
                  onClick={() => setBookingToView(row.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    cursor: "pointer",
                    borderTop: i === 0 ? "none" : "1px solid",
                    borderColor: "divider",
                    opacity: cancelled ? 0.55 : 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography variant="caption" sx={{ minWidth: 92, color: "text.secondary" }}>
                    {formatBusinessDate(row.start_time)} {formatBusinessTime(row.start_time)}
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 60 }}>
                    {row.service_name ?? "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 60, fontWeight: 600 }}>
                    {row.therapist_name ?? t("unassignedTherapist")}
                  </Typography>
                  {statusChip(row.status)}
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Bookings opened from history are strictly read-only for everyone — edits happen
          only through the booking's own workflows, never from the client's page. */}
      {bookingToView && (
        <UpdateBookingDialogForm
          open={!!bookingToView}
          bookingId={bookingToView}
          onClose={() => setBookingToView(null)}
          readOnly
        />
      )}
    </Box>
  );
};

export default ClientHistorySection;
