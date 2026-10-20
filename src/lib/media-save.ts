/**
 * The media save / review logic. Takes the actor as a parameter (and never calls Next-only cache APIs)
 * so it can be tested against the real database; the server actions in src/app/dashboard/media/actions.ts do the
 * sign-in check and the cache refresh around it.
 */
import { SCHOOL_ACCOUNT_NOTE, isSchoolAccount } from "@/lib/school-account";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDriveFileId } from "@/lib/drive";
import { isParsed, parseMediaLink } from "@/lib/embed";
import { processCover } from "@/lib/image";
import { DAILY_SUBMIT_LIMIT, MAX_HTML_BYTES, MAX_ITEMS, canAddItemKind, canDecide, canEditMedia, canManageMedia, canReviewMedia, statusAfterSave, type Actor } from "@/lib/media-access";
import { parseTags } from "@/lib/media-server";
import { rateLimited } from "@/lib/rate-limit";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";

export type MediaFormResult = { ok?: true; id?: string; status?: string; error?: string };

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel rejects larger request bodies
const UPLOAD_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  epub: ["application/epub+zip"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
  mp3: ["audio/mpeg"],
};

const itemSchema = z.object({
  id: z.string().optional(), // an item that already exists (kept / edited)
  kind: z.enum(["LINK", "HTML", "UPLOAD"]),
  label: z.string().trim().max(80).default(""),
  url: z.string().max(600).optional(),
  html: z.string().optional(),
  fileField: z.string().optional(), // name of the file in the form data (new uploads)
});

const payloadSchema = z.object({
  title: z.string().trim().min(3, "ชื่อสื่อต้องมีอย่างน้อย 3 ตัวอักษร").max(120),
  description: z.string().trim().max(2000).default(""),
  areaId: z.string().min(1, "กรุณาเลือกกลุ่มสาระ"),
  typeId: z.string().nullable().default(null),
  levelIds: z.array(z.string()).max(10).default([]),
  tags: z.string().max(400).default(""),
  authorName: z.string().trim().max(100).default(""),
  cover: z.object({ mode: z.enum(["keep", "none", "drive", "upload"]), link: z.string().max(500).optional(), fx: z.number().min(0).max(1).default(0.5), fy: z.number().min(0).max(1).default(0.5) }),
  items: z.array(itemSchema).min(1, "กรุณาเพิ่มสื่ออย่างน้อย 1 รายการ").max(MAX_ITEMS, `เพิ่มได้ไม่เกิน ${MAX_ITEMS} รายการ`),
  submit: z.boolean().default(false),
});

const safeDelete = (keys: (string | null | undefined)[]) => Promise.all(keys.filter((k): k is string => !!k).map((k) => getStorage().delete(k).catch(() => {})));

/** Create or edit one media item. `payload` is JSON, files travel as `cover` and `file_<n>` in the same form data. */
export async function saveMediaAs(actor: Actor, mediaId: string | null, formData: FormData): Promise<MediaFormResult> {
  if (!mediaId && (await isSchoolAccount(actor.id))) return { error: SCHOOL_ACCOUNT_NOTE };

  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("payload") ?? "")); } catch { return { error: "ข้อมูลไม่ถูกต้อง" }; }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const existing = mediaId ? await db.media.findUnique({ where: { id: mediaId }, include: { items: true } }) : null;
  if (mediaId && !existing) return { error: "ไม่พบสื่อนี้" };
  if (existing && !canEditMedia(actor, existing)) return { error: "ไม่มีสิทธิ์แก้ไขสื่อนี้" };

  if (!existing) {
    if (rateLimited(`media-new:${actor.id}`, 30, 60 * 60 * 1000)) return { error: "สร้างสื่อบ่อยเกินไป กรุณารอสักครู่" };
    const today = await db.media.count({ where: { createdById: actor.id, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (today >= DAILY_SUBMIT_LIMIT && actor.role !== "ADMIN") return { error: `ส่งสื่อได้ไม่เกิน ${DAILY_SUBMIT_LIMIT} ชิ้นต่อวัน` };
  }

  // ---- taxonomy
  const [area, type, levels, site] = await Promise.all([
    db.learningArea.findFirst({ where: { id: d.areaId, active: true }, select: { id: true } }),
    d.typeId ? db.mediaType.findFirst({ where: { id: d.typeId, active: true }, select: { id: true } }) : null,
    d.levelIds.length ? db.educationLevel.findMany({ where: { id: { in: d.levelIds }, active: true }, select: { id: true } }) : [],
    getSiteInfo(),
  ]);
  if (!area) return { error: "ไม่พบกลุ่มสาระที่เลือก" };
  if (d.typeId && !type) return { error: "ไม่พบประเภทสื่อที่เลือก" };
  const uploadsAllowed = site.allowServerUploads && storageIsDurable();

  // ---- items (validated again here: the browser's own checks are only for convenience)
  type NewItem = { id?: string; kind: "YOUTUBE" | "DRIVE_FILE" | "GOOGLE_DOC" | "APPS_SCRIPT" | "EMBED" | "LINK" | "HTML" | "UPLOAD"; label: string; url: string | null; html: string | null; storageKey: string | null; mimeType: string | null; sizeBytes: number | null; sortOrder: number; newFile?: { data: Buffer; ext: string; mime: string } };
  const keep = new Map((existing?.items ?? []).map((i) => [i.id, i]));
  const items: NewItem[] = [];
  for (const [index, it] of d.items.entries()) {
    const n = index + 1;
    const old = it.id ? keep.get(it.id) : undefined;
    if (it.id && !old) return { error: `รายการที่ ${n}: ไม่พบรายการเดิม` };
    const allow = canAddItemKind(actor, it.kind, uploadsAllowed);
    // a student's old item of a kind they may no longer add can stay as it is, but not be changed
    if (!allow.ok && !(old && old.kind === (it.kind === "LINK" ? old.kind : it.kind))) return { error: `รายการที่ ${n}: ${allow.error}` };

    if (it.kind === "LINK") {
      const r = parseMediaLink(it.url ?? "");
      if (!isParsed(r)) return { error: `รายการที่ ${n}: ${r.error}` };
      items.push({ id: old?.id, kind: r.kind, label: it.label, url: r.url, html: null, storageKey: null, mimeType: null, sizeBytes: null, sortOrder: index });
    } else if (it.kind === "HTML") {
      const html = it.html ?? "";
      if (!html.trim()) return { error: `รายการที่ ${n}: ยังไม่ได้วางโค้ด HTML` };
      if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return { error: `รายการที่ ${n}: HTML ใหญ่เกิน ${MAX_HTML_BYTES / 1024} KB` };
      items.push({ id: old?.id, kind: "HTML", label: it.label, url: null, html, storageKey: null, mimeType: null, sizeBytes: null, sortOrder: index });
    } else if (old && old.kind === "UPLOAD" && !it.fileField) {
      items.push({ id: old.id, kind: "UPLOAD", label: it.label, url: null, html: null, storageKey: old.storageKey, mimeType: old.mimeType, sizeBytes: old.sizeBytes, sortOrder: index });
    } else {
      const file = it.fileField ? formData.get(it.fileField) : null;
      if (!(file instanceof File) || file.size === 0) return { error: `รายการที่ ${n}: ยังไม่ได้เลือกไฟล์` };
      if (file.size > MAX_UPLOAD_BYTES) return { error: `รายการที่ ${n}: ไฟล์ต้องไม่เกิน 4 MB (ไฟล์ใหญ่กว่านี้ให้ใช้ลิงก์ Google Drive)` };
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!UPLOAD_TYPES[ext] || (file.type && !UPLOAD_TYPES[ext].includes(file.type))) return { error: `รายการที่ ${n}: รองรับไฟล์ ${Object.keys(UPLOAD_TYPES).join(", ")}` };
      const data = Buffer.from(await file.arrayBuffer());
      if (ext === "pdf" && data.subarray(0, 5).toString() !== "%PDF-") return { error: `รายการที่ ${n}: ไฟล์ไม่ใช่ PDF ที่ถูกต้อง` };
      items.push({ id: old?.id, kind: "UPLOAD", label: it.label || file.name, url: null, html: null, storageKey: null, mimeType: UPLOAD_TYPES[ext][0], sizeBytes: data.length, sortOrder: index, newFile: { data, ext, mime: UPLOAD_TYPES[ext][0] } });
    }
  }

  // ---- cover
  let coverKey = existing?.coverKey ?? null;
  let coverDriveId = existing?.coverDriveId ?? null;
  let coverFx = existing?.coverFx ?? 0.5;
  let coverFy = existing?.coverFy ?? 0.5;
  const staleKeys: (string | null)[] = [];
  let newCover: Buffer | null = null;
  if (d.cover.mode === "none") { staleKeys.push(coverKey); coverKey = null; coverDriveId = null; }
  else if (d.cover.mode === "drive") {
    const id = parseDriveFileId(d.cover.link);
    if (!id) return { error: "ลิงก์ภาพปกต้องเป็นลิงก์ไฟล์จาก drive.google.com" };
    staleKeys.push(coverKey); coverKey = null; coverDriveId = id; coverFx = d.cover.fx; coverFy = d.cover.fy;
  } else if (d.cover.mode === "upload") {
    if (!uploadsAllowed) return { error: "ขณะนี้ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) return { error: "ยังไม่ได้เลือกภาพปก" };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "ภาพปกต้องไม่เกิน 4 MB" };
    try { newCover = await processCover(Buffer.from(await file.arrayBuffer()), { aspect: 16 / 9, maxWidth: 960 }); } catch { return { error: "ไฟล์ภาพปกอ่านไม่ได้" }; }
    staleKeys.push(coverKey); coverDriveId = null;
  }

  // ---- status
  if (d.submit && items.length === 0) return { error: "กรุณาเพิ่มสื่ออย่างน้อย 1 รายการ" };
  const status = statusAfterSave(actor, existing?.status ?? null, d.submit);

  // ---- files first (so a failed upload never leaves a half-saved item)
  const storage = getStorage();
  const written: string[] = [];
  try {
    if (newCover) { coverKey = `media/cover-${randomUUID()}.webp`; await storage.put(coverKey, newCover, "image/webp"); written.push(coverKey); }
    for (const it of items) {
      if (!it.newFile) continue;
      it.storageKey = `media/${randomUUID()}.${it.newFile.ext}`;
      await storage.put(it.storageKey, it.newFile.data, it.newFile.mime);
      written.push(it.storageKey);
    }
  } catch (e) {
    console.error("media upload failed", e);
    await safeDelete(written);
    return { error: "อัปโหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  const keptIds = new Set(items.map((i) => i.id).filter(Boolean));
  const removed = (existing?.items ?? []).filter((i) => !keptIds.has(i.id));
  const now = new Date();
  const base = {
    title: d.title, description: d.description, authorName: actor.role === "ADMIN" ? d.authorName || null : existing?.authorName ?? null,
    areaId: d.areaId, typeId: d.typeId, tags: parseTags(d.tags), coverKey, coverDriveId, coverFx, coverFy, status,
    publishedAt: status === "PUBLISHED" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null,
    ...(status === "PENDING" || status === "PUBLISHED" ? { reviewNote: null } : {}),
    ...(actor.role === "ADMIN" && status === "PUBLISHED" ? { reviewedById: actor.id, reviewedAt: now } : {}),
  };

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const m = existing
        ? await tx.media.update({ where: { id: existing.id }, data: base, select: { id: true } })
        : await tx.media.create({ data: { ...base, createdById: actor.id }, select: { id: true } });
      await tx.mediaLevel.deleteMany({ where: { mediaId: m.id } });
      if (levels.length) await tx.mediaLevel.createMany({ data: levels.map((l) => ({ mediaId: m.id, levelId: l.id })) });
      if (removed.length) await tx.mediaItem.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
      for (const it of items) {
        const data = { kind: it.kind, label: it.label, url: it.url, html: it.html, storageKey: it.storageKey, mimeType: it.mimeType, sizeBytes: it.sizeBytes, sortOrder: it.sortOrder };
        if (it.id) await tx.mediaItem.update({ where: { id: it.id }, data });
        else await tx.mediaItem.create({ data: { ...data, mediaId: m.id } });
      }
      return m.id;
    });
  } catch (e) {
    console.error("media save failed", e);
    await safeDelete(written);
    return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await safeDelete([...staleKeys, ...removed.map((r) => r.storageKey)].filter((k) => k && !written.includes(k)));
  await audit({ actorId: actor.id, action: existing ? "media.update" : "media.create", entity: "Media", entityId: id, meta: { status, title: d.title } });
  return { ok: true, id, status };
}

/** Delete: the author or an admin. Stored files go with it. */
export async function deleteMediaAs(actor: Actor, id: string): Promise<{ error?: string }> {
  const m = await db.media.findUnique({ where: { id }, include: { items: { select: { storageKey: true } } } });
  if (!m) return { error: "ไม่พบสื่อนี้" };
  if (!canEditMedia(actor, m)) return { error: "ไม่มีสิทธิ์ลบสื่อนี้" };
  await db.media.delete({ where: { id } });
  await safeDelete([m.coverKey, ...m.items.map((i) => i.storageKey)]);
  await audit({ actorId: actor.id, action: "media.delete", entity: "Media", entityId: id, meta: { title: m.title } });
  return {};
}

/** Approve or send back an item waiting in the queue. */
export async function reviewMediaAs(actor: Actor, id: string, decision: "approve" | "reject", note: string): Promise<{ error?: string }> {
  const m = await db.media.findUnique({ where: { id }, select: { id: true, status: true, areaId: true, createdById: true, title: true, publishedAt: true } });
  if (!m) return { error: "ไม่พบสื่อนี้" };
  if (!canDecide(m.status)) return { error: "สื่อนี้ไม่ได้อยู่ในสถานะรออนุมัติ" };
  if (!canReviewMedia(actor, m)) return { error: m.createdById === actor.id ? "อนุมัติสื่อของตัวเองไม่ได้ ให้ผู้ตรวจคนอื่นหรือแอดมินตรวจ" : "ไม่มีสิทธิ์ตรวจสื่อกลุ่มสาระนี้" };
  const text = note.trim().slice(0, 500);
  if (decision === "reject" && text.length < 5) return { error: "กรุณาระบุเหตุผลที่ส่งกลับอย่างน้อย 5 ตัวอักษร เพื่อให้เจ้าของแก้ไขได้" };

  const now = new Date();
  await db.media.update({
    where: { id },
    data: decision === "approve"
      ? { status: "PUBLISHED", publishedAt: m.publishedAt ?? now, reviewedById: actor.id, reviewedAt: now, reviewNote: text || null }
      : { status: "REJECTED", reviewedById: actor.id, reviewedAt: now, reviewNote: text },
  });
  await audit({ actorId: actor.id, action: decision === "approve" ? "media.approve" : "media.reject", entity: "Media", entityId: id, meta: { title: m.title } });
  return {};
}

/** Admin only: pin to the top of lists, or take a published item back to draft. */
export async function setMediaPinnedAs(actor: Actor, id: string, pinned: boolean): Promise<{ error?: string }> {
  if (!canManageMedia(actor)) return { error: "ไม่มีสิทธิ์" };
  await db.media.update({ where: { id }, data: { pinned } });
  await audit({ actorId: actor.id, action: pinned ? "media.pin" : "media.unpin", entity: "Media", entityId: id });
  return {};
}

export async function unpublishMediaAs(actor: Actor, id: string): Promise<{ error?: string }> {
  if (!canManageMedia(actor)) return { error: "ไม่มีสิทธิ์" };
  await db.media.update({ where: { id }, data: { status: "DRAFT", pinned: false } });
  await audit({ actorId: actor.id, action: "media.unpublish", entity: "Media", entityId: id });
  return {};
}

