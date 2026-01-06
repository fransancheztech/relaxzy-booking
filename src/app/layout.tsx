import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DatepickerLocaleProvider from "../components/DatePickerLocaleProvider";
import LayoutContent from "@/components/LayoutContent";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Providers } from "@/components/Providers";
import { LayoutProvider } from "./context/LayoutContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relaxzy Bookings",
  description: "Manage your Relaxzy bookings",
  icons: {
    icon: "/favicon32.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppRouterCacheProvider>
          <Providers>
            <LayoutProvider>
              <DatepickerLocaleProvider />
              <LayoutContent>{children}</LayoutContent>
            </LayoutProvider>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
