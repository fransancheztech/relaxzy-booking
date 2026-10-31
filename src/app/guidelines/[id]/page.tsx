"use client";

import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatBusinessDate } from "@/utils/businessTime";
import { useRole } from "@/hooks/useRole";
import Markdown from "@/components/Markdown";
import { extractToc } from "@/utils/markdownToc";
import { guidelineLabel, useGuidelines, type Guideline } from "../GuidelinesShell";

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "roleAdmin",
  receptionist: "roleReceptionist",
  therapist: "roleTherapist",
};

const ROLE_CHIP_COLORS: Record<string, "primary" | "secondary" | "success"> = {
  admin: "primary",
  receptionist: "secondary",
  therapist: "success",
};

/** One guideline, with its own "On this page" contents and links to the previous and next. */
export default function GuidelinePage() {
  const t = useTranslations("Guidelines");
  const tCommon = useTranslations("Common");
  const { isAdmin } = useRole();
  const { id } = useParams<{ id: string }>();
  const { guidelines, loaded, edit, remove } = useGuidelines();

  const index = guidelines.findIndex((g) => g.id === id);
  const guideline = index >= 0 ? guidelines[index] : null;
  const prev = index > 0 ? guidelines[index - 1] : null;
  const next = index >= 0 ? guidelines[index + 1] ?? null : null;

  const toc = useMemo(() => (guideline ? extractToc(guideline.content) : []), [guideline]);

  // Each guideline opens at its top. The links pass scroll={false} and this does it instead,
  // so the result doesn't depend on how much of the old page was in view.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  // Headings carry ids from rehype-slug; scrollIntoView honours their scroll-margin-top, which
  // tracks the live header height.
  const scrollToHeading = (headingId: string) => {
    document.getElementById(headingId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!loaded) return null;

  if (!guideline) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary" sx={{ mb: 1 }}>{t("notFound")}</Typography>
        <Link href="/guidelines">{t("backToGuidelines")}</Link>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {guideline.title && (
                <Typography variant="h6" sx={{ mb: 1, lineHeight: 1.25, fontSize: "1.5rem", fontWeight: 700 }}>
                  {guideline.title}
                </Typography>
              )}
              <Markdown sx={{ mb: 1.5 }}>{guideline.content}</Markdown>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                {guideline.target_roles.map((r) => (
                  <Chip
                    key={r}
                    size="small"
                    label={ROLE_LABEL_KEYS[r] ? t(ROLE_LABEL_KEYS[r] as Parameters<typeof t>[0]) : r}
                    color={ROLE_CHIP_COLORS[r] ?? "default"}
                    variant="outlined"
                    sx={{ fontSize: "0.7rem", height: 22 }}
                  />
                ))}
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                  {formatBusinessDate(guideline.created_at)}
                </Typography>
              </Box>
            </Box>
            {isAdmin && (
              <Box sx={{ display: "flex", flexShrink: 0 }}>
                <Tooltip title={tCommon("edit")}>
                  <IconButton size="small" onClick={() => edit(guideline)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={tCommon("delete")}>
                  <IconButton size="small" color="error" onClick={() => remove(guideline)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Paper>

        {(prev || next) && (
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {prev && <PagerLink guideline={prev} caption={t("previous")} direction="prev" />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {next && <PagerLink guideline={next} caption={t("next")} direction="next" />}
            </Box>
          </Box>
        )}
      </Box>

      {toc.length >= 2 && (
        <Box
          component="nav"
          sx={{
            display: { xs: "none", lg: "flex" },
            flexDirection: "column",
            width: 210,
            flexShrink: 0,
            position: "sticky",
            top: "calc(var(--app-bar-height, 64px) + 8px)",
            maxHeight: "calc(100vh - var(--app-bar-height, 64px) - 36px)",
            overflowY: "auto",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 700, px: 1, mb: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {t("onThisPage")}
          </Typography>
          <Stack spacing={0.25}>
            {toc.map((h) => (
              <Box
                key={h.id}
                onClick={() => scrollToHeading(h.id)}
                sx={{
                  cursor: "pointer",
                  py: 0.4,
                  // Indent by heading level so the outline is readable at a glance.
                  pl: 1 + (h.depth - 1) * 1.1,
                  pr: 1,
                  borderRadius: 0.75,
                  borderLeft: "2px solid transparent",
                  "&:hover": { bgcolor: "action.hover", borderColor: "divider" },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: 1.45,
                    color: h.depth <= 2 ? "text.primary" : "text.secondary",
                    fontWeight: h.depth <= 2 ? 500 : 400,
                  }}
                >
                  {h.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function PagerLink({
  guideline,
  caption,
  direction,
}: {
  guideline: Guideline;
  caption: string;
  direction: "prev" | "next";
}) {
  const isNext = direction === "next";
  return (
    <Paper
      variant="outlined"
      component={Link}
      href={`/guidelines/${guideline.id}`}
      scroll={false}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1.5,
        textDecoration: "none",
        flexDirection: isNext ? "row-reverse" : "row",
        textAlign: isNext ? "right" : "left",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      {isNext ? <ArrowForwardIcon fontSize="small" color="action" /> : <ArrowBackIcon fontSize="small" color="action" />}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          {caption}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
          {guidelineLabel(guideline)}
        </Typography>
      </Box>
    </Paper>
  );
}
