import type { MetadataRoute } from "next";
import { getPwaIdentity, iconUrl } from "@/lib/pwa";

// Built from the site settings on every request, so renaming the system or swapping the logo reaches new installs automatically.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const id = await getPwaIdentity();
  return {
    name: id.name,
    short_name: id.shortName,
    description: id.description,
    lang: "th",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: id.backgroundColor,
    theme_color: id.themeColor,
    icons: [
      { src: iconUrl("192", id), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl("512", id), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconUrl("maskable-192", id), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: iconUrl("maskable-512", id), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "คลังสื่อ", url: "/library", icons: [{ src: iconUrl("192", id), sizes: "192x192" }] },
      { name: "คอร์สเรียน", url: "/courses", icons: [{ src: iconUrl("192", id), sizes: "192x192" }] },
      { name: "บัญชีของฉัน", url: "/dashboard", icons: [{ src: iconUrl("192", id), sizes: "192x192" }] },
    ],
  };
}
