"use client";

import { Paper, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRole } from "@/hooks/useRole";
import { useGuidelines } from "./GuidelinesShell";

/** /guidelines has no content of its own: it opens the first guideline. */
export default function GuidelinesIndexPage() {
  const t = useTranslations("Guidelines");
  const { isAdmin } = useRole();
  const { guidelines, loaded } = useGuidelines();
  const router = useRouter();

  const firstId = guidelines[0]?.id;
  useEffect(() => {
    if (firstId) router.replace(`/guidelines/${firstId}`);
  }, [firstId, router]);

  if (!loaded || firstId) return null;

  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
      <Typography color="text.secondary">{isAdmin ? t("emptyAdmin") : t("emptyReader")}</Typography>
    </Paper>
  );
}
