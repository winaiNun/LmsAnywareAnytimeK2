import type { Metadata, Viewport } from "next";
import FloatingTools from "@/components/floating-tools-server";
import Pwa from "@/components/pwa";
import SiteFooter from "@/components/site-footer";
import VisitBeacon from "@/components/visit-beacon";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anyware Anytime — ห้องสมุดและระบบเรียนรู้ออนไลน์",
  description: "ห้องสมุดดิจิทัลและระบบเรียนรู้ออนไลน์ เข้าถึงได้ทุกที่ ทุกเวลา",
  applicationName: "Anywhere Anytime",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Anywhere Anytime", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [
      { url: "/icons/apple-touch-icon-120.png", sizes: "120x120" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0052FF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="font-sans antialiased">
        {children}
        <SiteFooter />
        <VisitBeacon />
        <FloatingTools />
        <Pwa />
      </body>
    </html>
  );
}
