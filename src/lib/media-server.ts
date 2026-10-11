/** Server-only helpers for the media library (loads the facts that src/lib/media-access.ts decides on). */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/media-access";

/** The signed-in member as the permission functions see them, or null. Disabled accounts count as signed out. */
export async function getActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, memberType: true, active: true, reviewerAreas: { select: { areaId: true } } },
  });
  if (!user || !user.active) return null;
  return { id: user.id, role: user.role, memberType: user.memberType, reviewerAreaIds: user.reviewerAreas.map((r) => r.areaId) };
}

export const parseTags = (raw: string): string[] =>
  [...new Set(raw.split(/[,،\n]/).map((t) => t.trim().replace(/\s+/g, " ").slice(0, 30)).filter(Boolean))].slice(0, 8);

/** Media kinds by badge: what the card shows in the corner. */
export const ITEM_BADGE: Record<string, string> = {
  YOUTUBE: "วิดีโอ",
  DRIVE_FILE: "ไฟล์",
  GOOGLE_DOC: "เอกสาร",
  APPS_SCRIPT: "แอป",
  HTML: "แอป HTML",
  EMBED: "สื่อฝัง",
  LINK: "ลิงก์",
  UPLOAD: "ไฟล์",
};
