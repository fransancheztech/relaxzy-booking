"use client";

import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { StatsResponse } from "@/types/stats";

const EMPTY = (
  <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: "center" }}>
    No hay datos para este período
  </Typography>
);

interface Props {
  bookings: StatsResponse["bookings"];
  financial: StatsResponse["financial"];
}

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{title}</Typography>
    {children}
  </Paper>
);

const BookingsSection = ({ bookings, financial }: Props) => {
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dowData = dowOrder.map((d) => {
    const found = bookings.by_day_of_week.find((r) => r.day_of_week === d);
    return { label: DOW_LABELS[d], count: found?.count ?? 0 };
  });

  const serviceData = bookings.by_service.map((s) => ({ label: s.service_name, count: s.count, revenue: s.revenue }));
  const slotData = bookings.by_time_slot.map((s) => ({ label: `${String(s.hour).padStart(2, "0")}h`, count: s.count }));
  const durationData = bookings.by_duration.map((d) => ({ label: `${d.duration_minutes} min`, count: d.count }));
  const ticketData = financial.ticket_distribution.filter((b) => b.count > 0);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Reservas</Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={`Completadas: ${bookings.completed}`} size="small" color="success" variant="outlined" />
        <Chip label={`Canceladas: ${bookings.cancelled}`} size="small" color={bookings.cancellation_rate > 10 ? "error" : "default"} variant="outlined" />
        <Chip label={`Cancelación: ${bookings.cancellation_rate.toFixed(1)}%`} size="small" color={bookings.cancellation_rate > 10 ? "warning" : "default"} variant="outlined" />
        <Chip label={`Duración media: ${Math.round(bookings.avg_session_minutes)} min`} size="small" variant="outlined" />
        <Chip label={`Horas reservadas: ${bookings.total_booked_hours.toFixed(1)} h`} size="small" variant="outlined" />
        <Chip label={`Media/día: ${bookings.avg_per_day.toFixed(1)}`} size="small" variant="outlined" />
      </Stack>

      <Grid container spacing={2}>
        {/* By service — horizontal */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Por servicio">
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill="#002d04" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>

        {/* By time slot */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Por hora del día">
            {slotData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={slotData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill="#60a561" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>

        {/* By day of week */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Por día de la semana">
            {bookings.by_day_of_week.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill="#002d04" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>

        {/* By duration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Por duración">
            {durationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={durationData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill="#60a561" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>

        {/* Revenue by service — horizontal */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Ingresos por servicio">
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v} €`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => `${Number(v ?? 0).toFixed(2)} €`} />
                  <Bar dataKey="revenue" name="Ingresos" fill="#a8d5a9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>

        {/* Ticket distribution */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Distribución de tickets">
            {ticketData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ticketData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill="#002d04" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BookingsSection;
