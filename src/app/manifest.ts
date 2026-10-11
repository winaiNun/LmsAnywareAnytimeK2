import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anywhere Anytime — ห้องสมุดและระบบเรียนรู้",
    short_name: "Anywhere Anytime",
    description: "ห้องสมุดดิจิทัลและระบบเรียนรู้ออนไลน์ เข้าถึงได้ทุกที่ ทุกเวลา",
    lang: "th",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B2A6F",
    theme_color: "#0052FF",
    icons: [
      ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512].map((n) => ({ src: `/icons/icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png", purpose: "any" as const })),
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "ห้องสมุด", url: "/library", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "คอร์สเรียน", url: "/courses", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "บัญชีของฉัน", url: "/dashboard", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
    ],
  };
}
