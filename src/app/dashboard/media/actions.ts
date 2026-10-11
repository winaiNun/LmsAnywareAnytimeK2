"use server";

import { revalidatePath } from "next/cache";
import { deleteMediaAs, reviewMediaAs, saveMediaAs, setMediaPinnedAs, unpublishMediaAs, type MediaFormResult } from "@/lib/media-save";
import { getActor } from "@/lib/media-server";

export type { MediaFormResult };

function refresh(id?: string) {
  for (const p of ["/", "/library", "/dashboard/media", "/dashboard/review", "/admin/media"]) revalidatePath(p);
  if (id) revalidatePath(`/library/${id}`);
}

const NOT_SIGNED_IN = { error: "กรุณาเข้าสู่ระบบ" };

/** Create or edit one media item. `payload` is JSON, files travel as `cover` and `file_<n>` in the same form data. */
export async function saveMedia(mediaId: string | null, formData: FormData): Promise<MediaFormResult> {
  const actor = await getActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await saveMediaAs(actor, mediaId, formData);
  refresh(r.id ?? mediaId ?? undefined);
  return r;
}

export async function deleteMedia(id: string): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await deleteMediaAs(actor, id);
  refresh(id);
  return r;
}

export async function reviewMedia(id: string, decision: "approve" | "reject", note: string): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await reviewMediaAs(actor, id, decision, note);
  refresh(id);
  return r;
}

export async function setMediaPinned(id: string, pinned: boolean): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await setMediaPinnedAs(actor, id, pinned);
  refresh(id);
  return r;
}

export async function unpublishMedia(id: string): Promise<{ error?: string }> {
  const actor = await getActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await unpublishMediaAs(actor, id);
  refresh(id);
  return r;
}
