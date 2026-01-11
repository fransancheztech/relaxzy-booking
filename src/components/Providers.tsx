// This file is needed to avoid an error with MUI not liking functions like CreateTheme() being passed to client components like ThemeProvider from server components like RootLayout.

"use client";
import { ThemeProvider } from "@mui/material";
import theme from "@/theme";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </ThemeProvider>
  );
}
