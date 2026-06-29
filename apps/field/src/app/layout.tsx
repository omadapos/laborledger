import type { Metadata, Viewport } from "next";

import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { FIELD_PWA_NAME, FIELD_PWA_THEME_COLOR } from "@/lib/field-pwa";

import "./globals.css";

export const metadata: Metadata = {
  title: FIELD_PWA_NAME,
  description: "Employee PWA for timekeeping and vehicle service jobs.",
  applicationName: FIELD_PWA_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: FIELD_PWA_NAME
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: FIELD_PWA_THEME_COLOR
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/field-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/field-icon.svg" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
