"use client";

import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { StatsResponse } from "@/types/stats";

const EMPTY = (
  <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: "center" }}>
    No hay datos para este período
  </Typography>
);

interface Props {
  clients: StatsResponse["clients"];
  bucket: StatsResponse["meta"]["date_bucket"];
}

const ClientSection = ({ clients, bucket }: Props) => {
  const chartData = clients.new_over_time.map((p) => {
    const d = new Date(p.period);
    let label: string;
    if (bucket === "day") label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    else if (bucket === "week") label = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("es-ES", { month: "short" })}`;
    else label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    return { label, count: p.count };
  });

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Clientes</Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip label={`Total histórico: ${clients.total_all_time}`} size="small" variant="outlined" />
        <Chip label={`En periodo: ${clients.total_unique}`} size="small" variant="outlined" />
        <Chip label={`Nuevos: ${clients.new_in_period}`} size="small" color="success" variant="outlined" />
        <Chip label={`Recurrentes: ${clients.returning_in_period}`} size="small" color="primary" variant="outlined" />
        <Chip label={`Retención: ${clients.retention_rate.toFixed(1)}%`} size="small" color={clients.retention_rate >= 50 ? "success" : "default"} variant="outlined" />
        <Chip label={`Media reservas/cliente: ${clients.avg_bookings_per_client.toFixed(1)}`} size="small" variant="outlined" />
        {clients.repeat_frequency_days > 0 && (
          <Chip label={`Frecuencia repetición: ${Math.round(clients.repeat_frequency_days)} días`} size="small" variant="outlined" />
        )}
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Clientes nuevos en el tiempo
            </Typography>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#002d04" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#002d04" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Nuevos clientes"
                    stroke="#002d04"
                    strokeWidth={2}
                    fill="url(#clientGradient)"
                    dot={chartData.length <= 20}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : EMPTY}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Nuevos vs. Recurrentes
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { label: "Nuevos", value: clients.new_in_period, color: "#60a561" },
                { label: "Recurrentes", value: clients.returning_in_period, color: "#002d04" },
              ].map(({ label, value, color }) => {
                const pct = clients.total_unique > 0 ? (value / clients.total_unique) * 100 : 0;
                return (
                  <Box key={label}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="body2">{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{value} ({pct.toFixed(0)}%)</Typography>
                    </Box>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: "grey.100", overflow: "hidden" }}>
                      <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: color, borderRadius: 4, transition: "width 0.5s" }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClientSection;
