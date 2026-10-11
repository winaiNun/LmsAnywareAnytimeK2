"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { processBackground } from "@/lib/image";
import { ALIGNS, BG_MODES, DIRECTION_VALUES, HEADING_STYLES, SIZES } from "@/lib/section-styles";
import { SECTION_KEYS, getHomeSections } from "@/lib/sections";
import { getStorage } from "@/lib/storage";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) throw new Error("Forbidden");
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง");
const schema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกข้อความกำกับเซกชัน").max(80),
  subtitle: z.string().trim().max(160).default(""),
  align: z.enum(ALIGNS),
  titleSize: z.enum(SIZES),
  titleColor: hex,
  bgMode: z.enum(BG_MODES).default("none"),
  // Colour inputs are only present for the modes that use them.
  bgColor: hex.optional(),
  bgColor2: hex.optional(),
  bgDirection: z.enum(DIRECTION_VALUES as [string, ...string[]]).default("to right"),
  bgOverlay: z.coerce.number().int().min(0).max(80).default(0),
  headingStyle: z.enum(HEADING_STYLES).default("accent"),
  eyebrow: z.string().trim().max(24, "ป้ายเล็กยาวไม่เกิน 24 ตัวอักษร").default(""),
  accentColor: hex.default("#0052FF"),
});

export type SectionState = { error?: string; saved?: boolean } | undefined;

export async function saveSection(key: string, _prev: SectionState, formData: FormData): Promise<SectionState> {
  await requireStaff();
  if (!(SECTION_KEYS as readonly string[]).includes(key)) return { error: "ไม่พบเซกชัน" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if ((d.bgMode === "solid" || d.bgMode === "gradient") && !d.bgColor) return { error: "กรุณาเลือกสีพื้นหลัง" };
  if (d.bgMode === "gradient" && !d.bgColor2) return { error: "กรุณาเลือกสีที่ 2 สำหรับการไล่สี" };

  const current = (await getHomeSections()).find((s) => s.key === key)!;
  const existing = await db.homeSection.findUnique({ where: { key } });
  const storage = getStorage();
  let bgImageKey = existing?.bgImageKey ?? null;
  let oldKey: string | null = null;

  const file = formData.get("bgImage");
  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.includes(file.type)) return { error: "รองรับเฉพาะไฟล์ PNG, JPG, WebP" };
    if (file.size > MAX_IMAGE_BYTES) return { error: "ไฟล์รูปต้องไม่เกิน 10 MB" };
    let data: Buffer;
    try {
      data = await processBackground(Buffer.from(await file.arrayBuffer()));
    } catch {
      return { error: "ไฟล์รูปเสียหรืออ่านไม่ได้" };
    }
    const newKey = `site/section-${randomUUID()}.webp`;
    await storage.put(newKey, data, "image/webp");
    oldKey = bgImageKey;
    bgImageKey = newKey;
  } else if (formData.get("removeBgImage") && bgImageKey) {
    oldKey = bgImageKey;
    bgImageKey = null;
  }

  const data = {
    title: d.title,
    subtitle: d.subtitle,
    align: d.align,
    titleSize: d.titleSize,
    titleColor: d.titleColor,
    bgMode: d.bgMode,
    bgColor: d.bgMode === "solid" || d.bgMode === "gradient" ? (d.bgColor ?? null) : null,
    bgColor2: d.bgMode === "gradient" ? (d.bgColor2 ?? null) : null,
    bgDirection: d.bgDirection,
    bgImageKey,
    bgOverlay: d.bgOverlay,
    headingStyle: d.headingStyle,
    // null = the default label of this block, "" = no label at all
    eyebrow: formData.get("hideEyebrow") === "on" ? "" : d.eyebrow || null,
    accentColor: d.accentColor,
    // only blocks that have a "see all" target carry the switch; the others keep null
    showMore: current.hasMore ? formData.get("showMore") === "on" : null,
    visible: formData.get("visible") === "on",
    sortOrder: current.sortOrder,
  };
  await db.homeSection.upsert({ where: { key }, update: data, create: { key, ...data } });
  if (oldKey) await storage.delete(oldKey);

  revalidatePath("/");
  revalidatePath("/admin/sections");
  return { saved: true };
}

/** Swap with the neighbour above/below, then persist the whole order (so ties never happen). */
export async function moveSection(key: string, direction: "up" | "down") {
  await requireStaff();
  const list = await getHomeSections();
  const i = list.findIndex((s) => s.key === key);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];

  await db.$transaction(
    list.map((s, order) =>
      db.homeSection.upsert({
        where: { key: s.key },
        update: { sortOrder: order },
        create: {
          key: s.key,
          title: s.title,
          subtitle: s.subtitle,
          visible: s.visible,
          align: s.align,
          titleSize: s.titleSize,
          titleColor: s.titleColor,
          bgMode: s.bgMode,
          bgColor: s.bgColor,
          bgColor2: s.bgColor2,
          bgDirection: s.bgDirection,
          bgOverlay: s.bgOverlay,
          sortOrder: order,
        },
      }),
    ),
  );

  revalidatePath("/");
  revalidatePath("/admin/sections");
}
