"use client";

import { Box, Card, CardContent, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface Props {
  label: string;
  value: string;
  secondary?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
}

const KpiCard = ({ label, value, secondary, icon, tooltip }: Props) => {
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ color: isEmpty ? "text.disabled" : "text.primary" }}
          >
            {value}
          </Typography>
          {tooltip && (
            <Tooltip title={tooltip} arrow enterTouchDelay={0}>
              <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
            </Tooltip>
          )}
        </Box>
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
