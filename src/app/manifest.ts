import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anywhere Anytime — ห้องสมุดและระบบเรียนรู้",
    short_name: "Anywhere Anytime",
    description: "ห้องสมุดดิจิทัลและระบบเรียนรู้ออนไลน์ เข้าถึงได้ทุกที่ ทุกเวลา",
    lang: "th",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B2A6F",
    theme_color: "#0052FF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
