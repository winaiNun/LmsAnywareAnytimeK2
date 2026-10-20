import type { Metadata, Viewport } from "next";
import FloatingTools from "@/components/floating-tools-server";
import Pwa from "@/components/pwa";
import SiteFooter from "@/components/site-footer";
import { getPwaIdentity, iconUrl } from "@/lib/pwa";
import VisitBeacon from "@/components/visit-beacon";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const id = await getPwaIdentity();
  return {
    title: id.name,
    description: id.description,
    applicationName: id.name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: id.shortName, statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: iconUrl("192", id), sizes: "192x192", type: "image/png" }],
      apple: [{ url: iconUrl("apple-180", id), sizes: "180x180" }],
    },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const id = await getPwaIdentity();
  return { themeColor: id.themeColor, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

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
