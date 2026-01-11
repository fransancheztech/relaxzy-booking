"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  Stack,
} from "@mui/material";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userChecked, setUserChecked] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Redirect to /calendar if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/calendar");
      } else {
        setUserChecked(true); // only render form after check
      }
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      // Redirect to /calendar using Next.js router
      router.replace("/calendar");
    }
  };

  // Don't render form until we check if user is logged in
  if (!userChecked) return null;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: 4, maxWidth: 400, width: "100%", borderRadius: 2 }}
      >
        <Typography variant="h5" component="h1" gutterBottom fontWeight={600}>
          Login
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              variant="outlined"
              required
              fullWidth
            />
            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              variant="outlined"
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </Stack>
        </Box>

        {message && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
