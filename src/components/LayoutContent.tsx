"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  CssBaseline,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Button,
  Stack,
  Container,
  AppBar,
} from "@mui/material";
import { drawerWidth, menuPages } from "@/constants";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useLayout } from "@/app/context/LayoutContext";

const supabase = createClient();

function HeaderButton() {
  const { buttonLabel, onButtonClick } = useLayout();

  if (!buttonLabel) return null;

  return (
    <Button
      variant="contained"
      color="secondary"
      onClick={onButtonClick ?? undefined}
      sx={{ textTransform: "uppercase", fontWeight: "bold", fontSize: "1rem" }}
    >
      {buttonLabel}
    </Button>
  );
}

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const appBarHeight = 64; // typical MUI AppBar height in px

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setCheckedAuth(true);

      // Redirect root "/" to "/calendar"
      if (pathname === "/") {
        router.replace("/calendar");
      }

      // Redirect logged out users from private pages
      if (!user && pathname !== "/login") {
        router.replace("/login");
      }

      // Redirect logged in users away from login
      if (user && pathname === "/login") {
        router.replace("/calendar");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [pathname, router]);

   const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
    setUser(null);
    router.push("/login");
  };

  // Hide sidebar and treat as logged out on login page
  const isLoggedIn: boolean = !!user && pathname !== "/login";

  // Avoid rendering until auth is checked
  if (!checkedAuth) return null;

  return (
    <Stack sx={{ minHeight: "100vh" }}>
      <CssBaseline />

      {/* Full-width AppBar at top */}
      <AppBar position="fixed" color="primary">
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Image
            src="/BigTextHorizontalClearText.png"
            alt="Relaxzy Logo"
            width={200}
            height={40}
            priority
            style={{ cursor: "pointer" }}
            onClick={() => router.push("/calendar")}
          />
          <HeaderButton />
        </Toolbar>
      </AppBar>

      {/* Sidebar + Main content */}
      <Stack direction="row" sx={{ pt: `${appBarHeight}px` }}>
        {isLoggedIn ? (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: {
                width: drawerWidth,
                boxSizing: "border-box",
                top: `${appBarHeight}px`, // start below AppBar
                height: `calc(100vh - ${appBarHeight}px)`, // full height minus AppBar
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                backgroundColor: "primary.main",
              },
            }}
          >
            <Stack sx={{ flexGrow: 1 }}>
              <List>
                {menuPages.map((page) => (
                  <ListItem key={page.href} disablePadding>
                    <ListItemButton
                      selected={pathname === page.href}
                      onClick={() => router.push(page.href)}
                    >
                      <ListItemText primary={page.text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Stack>

            <Stack sx={{ p: 2 }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Stack>
          </Drawer>
        ) : (
          ""
        )}

        {/* Main content */}
        <Container component="main" maxWidth={false}>
          {children}
        </Container>
      </Stack>
    </Stack>
  );
}
