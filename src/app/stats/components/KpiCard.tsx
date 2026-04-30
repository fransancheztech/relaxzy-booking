"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";

interface Props {
  label: string;
  value: string;
  secondary?: string;
  icon?: React.ReactNode;
}

const KpiCard = ({ label, value, secondary, icon }: Props) => {
  const isEmpty = value === "0" || value === "0 €" || value === "€ 0,00" || value === "0%";

  return (
    <Card
      elevation={2}
      sx={{
        borderLeft: `4px solid`,
        borderColor: isEmpty ? "grey.300" : "primary.main",
        height: "100%",
      }}
    >
      <CardContent sx={{ pb: "12px !important" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {label}
          </Typography>
          {icon && (
            <Box sx={{ color: isEmpty ? "grey.400" : "primary.main", opacity: 0.7 }}>
              {icon}
            </Box>
          )}
        </Box>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ mt: 0.5, color: isEmpty ? "text.disabled" : "text.primary" }}
        >
          {value}
        </Typography>
        {secondary && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
            {secondary}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiCard;
