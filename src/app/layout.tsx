import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import DatepickerLocaleProvider from "../components/DatePickerLocaleProvider";
import LayoutContent from "@/components/LayoutContent";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Providers } from "@/components/Providers";
import { LayoutProvider } from "./context/LayoutContext";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";

// The app's fonts are kept in ./fonts (built by src/scripts/build-fonts.py), so a build never
// downloads them. Inter has no Thai letters: Thai text comes from Noto Sans Thai Looped, next in
// the font list (theme.ts, globals.css). Thai staff read the looped style more easily.
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const notoSansThaiLooped = localFont({
  src: "./fonts/NotoSansThaiLooped-Variable.woff2",
  variable: "--font-noto-sans-thai-looped",
  weight: "100 900",
  display: "swap",
  // Downloaded only when a page has Thai text.
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0E00-0E7F, U+200B-200D, U+25CC" }],
  adjustFontFallback: false,
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
    <html lang={locale} className={`${inter.variable} ${notoSansThaiLooped.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
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
