"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setLike } from "@/lib/media-counters";
import { rateLimited } from "@/lib/rate-limit";

export type LikeResult = { ok: true; liked: boolean; likeCount: number } | { ok: false; error: string; needLogin?: boolean };

/** Set (not toggle) the member's like, so a double click or a retry can not count twice. */
export async function setMediaLike(mediaId: string, liked: boolean): Promise<LikeResult> {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อนกดถูกใจ", needLogin: true };
  if (rateLimited(`like:${session.user.id}`, 60, 60 * 1000)) return { ok: false, error: "กดเร็วเกินไป กรุณารอสักครู่" };
  const r = await setLike(session.user.id, mediaId, !!liked);
  return r ? { ok: true, ...r } : { ok: false, error: "ไม่พบสื่อนี้" };
}
