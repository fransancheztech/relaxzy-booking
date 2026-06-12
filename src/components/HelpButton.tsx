"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Box,
  Divider,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useTranslations } from "next-intl";

type PageKey =
  | "calendar"
  | "bookings"
  | "clients"
  | "payments"
  | "services"
  | "therapists"
  | "vouchers"
  | "stats"
  | "tips"
  | "fallback";

const PAGE_KEYS: Record<string, PageKey> = {
  "/calendar":   "calendar",
  "/bookings":   "bookings",
  "/clients":    "clients",
  "/payments":   "payments",
  "/services":   "services",
  "/therapists": "therapists",
  "/vouchers":   "vouchers",
  "/stats":      "stats",
  "/tips":       "tips",
};

const SECTION_COUNTS: Record<PageKey, number[]> = {
  calendar:    [5, 4, 4, 3, 2, 4],
  bookings:    [3, 4, 3, 3, 3, 2, 4],
  clients:     [2, 2, 1, 2],
  payments:    [3, 2],
  services:    [3, 2, 2],
  therapists:  [3, 2, 2],
  vouchers:    [3, 3, 3, 2],
  stats:       [3, 5, 1],
  tips:        [3, 3, 2],
  fallback:    [3],
};

export default function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useTranslations("Help");

  if (pathname === "/login") return null;

  const pageKey: PageKey = PAGE_KEYS[pathname] ?? "fallback";
  const sections = SECTION_COUNTS[pageKey];
  const title = t(`${pageKey}.title` as Parameters<typeof t>[0]);

  return (
    <>
      <Fab
        size="small"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1300,
          bgcolor: "rgba(1,26,2,0.85)",
          color: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          "&:hover": { bgcolor: "#002d04" },
          width: 40,
          height: 40,
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: 20 }} />
      </Fab>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 340, display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box
            sx={{
              px: 2.5,
              py: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "#011a02",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", lineHeight: 1 }}>
                {t("helpLabel")}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                {title}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.6)" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
            {sections.map((tipCount, si) => {
              const headingKey = `${pageKey}.section${si}heading` as Parameters<typeof t>[0];
              const heading = t(headingKey);
              const tips: string[] = Array.from({ length: tipCount }, (_, ti) =>
                t(`${pageKey}.section${si}tip${ti}` as Parameters<typeof t>[0])
              );
              return (
                <Box key={si} sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 1, color: "text.primary" }}
                  >
                    {heading}
                  </Typography>
                  <List dense disablePadding>
                    {tips.map((tip, ti) => (
                      <ListItem key={ti} disablePadding sx={{ alignItems: "flex-start", mb: 0.75 }}>
                        <FiberManualRecordIcon
                          sx={{ fontSize: 6, mt: "7px", mr: 1, flexShrink: 0, color: "#60a561" }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {tip}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                  {si < sections.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
