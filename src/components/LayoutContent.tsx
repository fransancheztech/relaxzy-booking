"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  CssBaseline,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Button,
  Stack,
  Box,
  Container,
  AppBar,
  Typography,
  Divider,
} from "@mui/material";
import { drawerWidth, menuPages } from "@/constants";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useLayout } from "@/app/context/LayoutContext";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PaymentsIcon from "@mui/icons-material/Payments";
import SpaIcon from "@mui/icons-material/Spa";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import BarChartIcon from "@mui/icons-material/BarChart";
import SavingsIcon from "@mui/icons-material/Savings";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import HelpButton from "./HelpButton";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

const supabase = createClient();

const PAGE_ICONS: Record<string, React.ReactNode> = {
  "/calendar":   <CalendarMonthIcon sx={{ fontSize: 18 }} />,
  "/bookings":   <EventNoteIcon sx={{ fontSize: 18 }} />,
  "/clients":    <PeopleAltIcon sx={{ fontSize: 18 }} />,
  "/payments":   <PaymentsIcon sx={{ fontSize: 18 }} />,
  "/services":   <SpaIcon sx={{ fontSize: 18 }} />,
  "/therapists": <HealthAndSafetyIcon sx={{ fontSize: 18 }} />,
  "/vouchers":   <CardGiftcardIcon sx={{ fontSize: 18 }} />,
  "/stats":      <BarChartIcon sx={{ fontSize: 18 }} />,
  "/tips":       <SavingsIcon sx={{ fontSize: 18 }} />,
};

function HeaderButton() {
  const { buttonLabel, onButtonClick } = useLayout();
  if (!buttonLabel) return null;
  return (
    <Button
      variant="contained"
      color="secondary"
      onClick={onButtonClick ?? undefined}
      size="small"
      sx={{ fontWeight: 700, px: 2.5, borderRadius: 2 }}
    >
      {buttonLabel}
    </Button>
  );
}

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const t = useTranslations("Nav");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = user?.app_metadata?.role === "admin";
  const adminOnlyPaths = new Set(["/stats", "/tips"]);
  const visiblePages = menuPages.filter(
    (page) => !adminOnlyPaths.has(page.href) || isAdmin
  );

  const appBarHeight = 64;
  const currentPageHref = menuPages.find((p) => p.href === pathname)?.href;
  const currentPage = currentPageHref ? t(currentPageHref.slice(1) as Parameters<typeof t>[0]) : "";
  const isLoggedIn = pathname !== "/login";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
    setUser(null);
    router.push("/login");
  };

  return (
    <Stack sx={{ minHeight: "100vh" }}>
      <CssBaseline />

      {/* AppBar */}
      <AppBar
        position="fixed"
        color="primary"
        elevation={0}
        sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Image
              src="/BigTextHorizontalClearText.png"
              alt="Relaxzy Logo"
              width={160}
              height={32}
              priority
              style={{ cursor: "pointer" }}
              onClick={() => router.push("/calendar")}
            />
            {currentPage && isLoggedIn && (
              <>
                <Box sx={{ width: "1px", height: 20, bgcolor: "rgba(255,255,255,0.2)" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500, letterSpacing: 0.3 }}
                >
                  {currentPage}
                </Typography>
              </>
            )}
          </Box>
          <HeaderButton />
        </Toolbar>
      </AppBar>

      {/* Sidebar + Main */}
      <Stack direction="row" sx={{ pt: `${appBarHeight}px` }}>
        {isLoggedIn && (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: {
                width: drawerWidth,
                boxSizing: "border-box",
                top: `${appBarHeight}px`,
                height: `calc(100vh - ${appBarHeight}px)`,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#011a02",
                borderRight: "none",
                pt: 1,
              },
            }}
          >
            {/* Nav items */}
            <Box sx={{ flexGrow: 1, overflow: "auto" }}>
              <List dense sx={{ px: 1 }}>
                {visiblePages.map((page) => {
                  const isActive = pathname === page.href;
                  return (
                    <ListItem key={page.href} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => router.push(page.href)}
                        sx={{
                          borderRadius: 2,
                          py: 1,
                          px: 1.5,
                          transition: "background-color 0.15s ease",
                          bgcolor: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                          "&:hover": {
                            bgcolor: isActive
                              ? "rgba(255,255,255,0.13)"
                              : "rgba(255,255,255,0.05)",
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 32,
                            color: isActive ? "#a8ffb5" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {PAGE_ICONS[page.href]}
                        </ListItemIcon>
                        <ListItemText
                          primary={t(page.href.slice(1) as Parameters<typeof t>[0])}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: "0.875rem",
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? "#ffffff" : "rgba(255,255,255,0.6)",
                                letterSpacing: 0.2,
                              },
                            },
                          }}
                        />
                        {isActive && (
                          <Box
                            sx={{
                              width: 3,
                              height: 18,
                              borderRadius: 2,
                              bgcolor: "#60a561",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            {/* Language switcher */}
            <LanguageSwitcher />

            {/* User + logout */}
            <Box>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mx: 1 }} />
              <Box sx={{ p: 1.5, pb: 2 }}>
                {user?.email && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                      px: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        bgcolor: "rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }} />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255,255,255,0.35)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "0.7rem",
                      }}
                    >
                      {user.email}
                    </Typography>
                  </Box>
                )}
                <Button
                  variant="text"
                  fullWidth
                  onClick={handleLogout}
                  startIcon={<LogoutIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    justifyContent: "flex-start",
                    fontSize: "0.8rem",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.35)",
                    borderRadius: 2,
                    py: 0.75,
                    px: 1.5,
                    "&:hover": {
                      bgcolor: "rgba(220,50,50,0.1)",
                      color: "rgba(255,120,120,0.9)",
                    },
                  }}
                >
                  {t("logout")}
                </Button>
              </Box>
            </Box>
          </Drawer>
        )}

        {/* Main content */}
        <Container component="main" maxWidth={false}>
          {children}
        </Container>
      </Stack>
      <HelpButton />
    </Stack>
  );
}
