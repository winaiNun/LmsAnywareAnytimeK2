import type { Metadata, Viewport } from "next";
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
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
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
        <Pwa />
      </body>
    </html>
  );
}
