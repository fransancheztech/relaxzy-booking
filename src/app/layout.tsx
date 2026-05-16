import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import DatepickerLocaleProvider from "../components/DatePickerLocaleProvider";
import LayoutContent from "@/components/LayoutContent";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Providers } from "@/components/Providers";
import { LayoutProvider } from "./context/LayoutContext";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Relaxzy Bookings",
  description: "Manage your Relaxzy bookings",
  icons: {
    icon: "/favicon32.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("sidebarCollapsed")?.value === "true";

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansThai.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppRouterCacheProvider>
            <Providers>
              <LayoutProvider>
                <DatepickerLocaleProvider />
                <LayoutContent initialCollapsed={initialCollapsed}>{children}</LayoutContent>
              </LayoutProvider>
            </Providers>
          </AppRouterCacheProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
