"use client";

import { Box } from "@mui/material";
import { useTranslations } from "next-intl";

const NoRowsOverlay = ({ error }: { error: string | null }) => {
  const t = useTranslations("Common");
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: error ? "error.main" : "text.secondary",
      }}
    >
      {error ? `${t("errorLoading")}: ${error}` : t("noRowsFound")}
    </Box>
  );
};

export default NoRowsOverlay;
