"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

const LOCALES = ["en", "es", "th"] as const;
type Locale = (typeof LOCALES)[number];

export default function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Language");

  const handleChange = async (_: React.MouseEvent, value: Locale | null) => {
    if (!value || value === locale) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: value }),
    });
    router.refresh();
  };

  return (
    <Box sx={{ px: 1.5, pb: 1 }}>
      <Tooltip title={t("label")} placement="right">
        <ToggleButtonGroup
          value={locale}
          exclusive
          onChange={handleChange}
          size="small"
          sx={{ width: "100%" }}
        >
          {LOCALES.map((l) => (
            <ToggleButton
              key={l}
              value={l}
              sx={{
                flex: 1,
                py: 0.4,
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                borderColor: "rgba(255,255,255,0.1)",
                "&.Mui-selected": {
                  color: "#a8ffb5",
                  bgcolor: "rgba(255,255,255,0.08)",
                },
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.05)",
                },
              }}
            >
              {t(l)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Tooltip>
    </Box>
  );
}
