/**
 * Certificates against the database. Every function that changes something takes the acting member as a parameter
 * (like course-save.ts), so it can be tested with the real local database without a signed-in session.
 *
 * Life of a certificate: the learner finishes the course -> a row appears (PENDING, or ISSUED at once when the design
 * has no number series) -> an admin gives out numbers for everybody waiting ("ออกเลข") -> ISSUED, downloadable.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { canEditCourse, isCourseAdmin, type CourseActor } from "@/lib/course/access";
import { db } from "@/lib/db";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { NUMBER_MODES, parseFields, patternProblem, pickDesign, takeNumber, type NumberMode, type SerialState } from "./schema";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const MAX_DESIGNS_PER_COURSE = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I: easy to read out and type

export function newVerifyCode(len = 12): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/** Average of the learner's best score on every quiz of the course they have taken; null when they took none. */
export async function scoreOf(userId: string, courseId: string): Promise<number | null> {
  const attempts = await db.quizAttempt.findMany({
    where: { userId, submittedAt: { not: null }, quiz: { courseId } },
    select: { quizId: true, percent: true },
  });
  if (attempts.length === 0) return null;
  const best = new Map<string, number>();
  for (const a of attempts) best.set(a.quizId, Math.max(best.get(a.quizId) ?? 0, a.percent));
  return Math.round([...best.values()].reduce((s, n) => s + n, 0) / best.size);
}

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * The learner's certificate row, created the first time it is needed after they finish the course. Null when they have
 * not finished it, or the course has no design yet (nothing to show).
 */
export async function ensureCertificate(userId: string, courseId: string, now = new Date()) {
  const existing = await db.certificate.findUnique({ where: { courseId_userId: { courseId, userId } } });
  if (existing) return existing;
  const enrol = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { completedAt: true, user: { select: { name: true } } } });
  if (!enrol?.completedAt) return null;
  const designs = await db.certificateDesign.findMany({ where: { courseId }, select: { id: true, isDefault: true, minScore: true, position: true, serialId: true } });
  const score = await scoreOf(userId, courseId);
  const design = pickDesign(designs, score);
  if (!design) return null;
  const immediate = design.serialId === null; // no number series: nothing to wait for
  try {
    return await db.certificate.create({
      data: {
        courseId, userId, designId: design.id, serialId: design.serialId, verifyCode: newVerifyCode(), completedAt: enrol.completedAt, scorePercent: score,
        status: immediate ? "ISSUED" : "PENDING", ...(immediate && { issuedAt: now, nameSnapshot: enrol.user.name }),
      },
    });
  } catch (e) {
    if (isUnique(e)) {
      const again = await db.certificate.findUnique({ where: { courseId_userId: { courseId, userId } } });
      if (again) return again; // two tabs opened at the same moment
    }
    throw e;
  }
}

/** Rows for everybody who finished before a design existed (or before anyone looked). Returns how many were created. */
export async function backfillCertificates(courseId: string, now = new Date()): Promise<number> {
  const done = await db.enrollment.findMany({ where: { courseId, completedAt: { not: null }, user: { certificates: { none: { courseId } } } }, select: { userId: true }, take: 5000 });
  let n = 0;
  for (const e of done) if (await ensureCertificate(e.userId, courseId, now)) n++;
  return n;
}

/** Make sure a learner has a row for every finished course that has a design (used by "my certificates"). */
export async function ensureAllForUser(userId: string, now = new Date()): Promise<void> {
  const done = await db.enrollment.findMany({ where: { userId, completedAt: { not: null }, course: { certificateDesigns: { some: {} }, certificates: { none: { userId } } } }, select: { courseId: true }, take: 100 });
  for (const e of done) await ensureCertificate(userId, e.courseId, now);
}

type Tx = Prisma.TransactionClient;
type LockedSerial = SerialState & { mode: NumberMode };

/** Read a number series and lock its row until the transaction ends: nobody else can hand out a number from it meanwhile. */
async function lockSerial(tx: Tx, serialId: string): Promise<LockedSerial | null> {
  const rows = await tx.$queryRaw<LockedSerial[]>`SELECT "pattern", "padding", "nextNo", "resetYearly", "lastYear", "endNo", "mode"::text AS "mode" FROM "CertificateSerial" WHERE "id" = ${serialId} FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * Give a number to every learner of the course who is waiting, oldest finisher first. Admins only: the numbers come from
 * the district's register. One transaction per number series, with the series row locked, so two admins pressing the
 * button at once can never hand out the same number. Stops (stopped = true) when a series' range is used up.
 */
export async function issueNumbers(actor: Pick<CourseActor, "role" | "id">, courseId: string, now = new Date()): Promise<Result<{ issued: number; stopped: boolean }>> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบที่ออกเลขเกียรติบัตรได้");
  await backfillCertificates(courseId, now);
  const waiting = await db.certificate.findMany({ where: { courseId, status: "PENDING" }, orderBy: [{ completedAt: "asc" }, { id: "asc" }], select: { id: true, serialId: true, user: { select: { name: true } } } });
  const bySerial = new Map<string, typeof waiting>();
  for (const w of waiting) if (w.serialId) bySerial.set(w.serialId, [...(bySerial.get(w.serialId) ?? []), w]);

  let issued = 0;
  let stopped = false;
  for (const [serialId, rows] of bySerial) {
    const r = await db.$transaction(
      async (tx) => {
        let state = await lockSerial(tx, serialId);
        if (!state) return { count: 0, stopped: false };
        let count = 0;
        for (const row of rows) {
          const t = takeNumber(state, now);
          if (!t) return await finish(tx, serialId, state, count, true); // the range is used up
          // the status check skips anyone numbered a moment ago by someone else (then the number is not used up)
          const claimed = await tx.certificate.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "ISSUED", number: t.number, issuedAt: now, issuedById: actor.id, nameSnapshot: row.user.name } });
          if (claimed.count === 0) continue;
          state = { ...state, ...t.next };
          count++;
        }
        return await finish(tx, serialId, state, count, false);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    issued += r.count;
    stopped ||= r.stopped;
  }
  return { ok: true, issued, stopped };
}

async function finish(tx: Tx, serialId: string, state: SerialState, count: number, stopped: boolean) {
  await tx.certificateSerial.update({ where: { id: serialId }, data: { nextNo: state.nextNo, lastYear: state.lastYear } });
  return { count, stopped };
}

class Rollback extends Error {
  constructor(readonly why: "exhausted" | "taken") { super(why); }
}

/**
 * "ตรวจชื่อแล้ว รับเกียรติบัตร": for a series that runs automatically the LEARNER gets the next number at once.
 * Everything happens in one transaction with the series row locked, so 100 people pressing together get 100 different,
 * consecutive numbers; a double click (or a second tab) does not use a second number.
 */
export async function confirmCertificate(userId: string, courseId: string, now = new Date()): Promise<Result<{ number: string | null }>> {
  const cert = await db.certificate.findUnique({ where: { courseId_userId: { courseId, userId } }, select: { id: true, status: true, number: true, serialId: true, user: { select: { name: true } } } });
  if (!cert) return fail("ไม่พบเกียรติบัตร — ต้องเรียนคอร์สนี้จบก่อน");
  if (cert.status === "ISSUED") return { ok: true, number: cert.number };
  if (cert.status === "REVOKED") return fail("เกียรติบัตรนี้ถูกเพิกถอน");
  if (!cert.serialId) return fail("เกียรติบัตรนี้ไม่ต้องรับเลข");
  const serialId = cert.serialId;
  try {
    const number = await db.$transaction(
      async (tx) => {
        const state = await lockSerial(tx, serialId);
        if (!state || state.mode !== "AUTO") throw new Error("not-auto");
        const t = takeNumber(state, now);
        if (!t) throw new Rollback("exhausted");
        const claimed = await tx.certificate.updateMany({ where: { id: cert.id, status: "PENDING" }, data: { status: "ISSUED", number: t.number, issuedAt: now, issuedById: userId, nameSnapshot: cert.user.name } });
        if (claimed.count === 0) throw new Rollback("taken"); // undo: the number must not be used up
        await tx.certificateSerial.update({ where: { id: serialId }, data: { nextNo: t.next.nextNo, lastYear: t.next.lastYear } });
        return t.number;
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    return { ok: true, number };
  } catch (e) {
    if (e instanceof Rollback && e.why === "exhausted") return fail("เลขชุดนี้หมดแล้ว กรุณารอผู้ดูแลระบบขยายช่วงเลข แล้วกลับมากดรับอีกครั้ง");
    if (e instanceof Rollback && e.why === "taken") {
      const again = await db.certificate.findUnique({ where: { id: cert.id }, select: { status: true, number: true } });
      return again?.status === "ISSUED" ? { ok: true, number: again.number } : fail("ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    if (e instanceof Error && e.message === "not-auto") return fail("เกียรติบัตรนี้ผู้ดูแลระบบเป็นผู้ออกเลข ยังกดรับเองไม่ได้");
    throw e;
  }
}

export async function revokeCertificate(actor: Pick<CourseActor, "role">, id: string, note: string, now = new Date()): Promise<Result> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบที่เพิกถอนเกียรติบัตรได้");
  const reason = note.trim();
  if (reason.length < 5) return fail("กรอกเหตุผลที่เพิกถอนอย่างน้อย 5 ตัวอักษร");
  const r = await db.certificate.updateMany({ where: { id, status: { in: ["ISSUED", "PENDING"] } }, data: { status: "REVOKED", revokedAt: now, revokeNote: reason.slice(0, 300) } });
  return r.count ? { ok: true } : fail("ไม่พบเกียรติบัตรนี้ หรือถูกเพิกถอนไปแล้ว");
}

/** Undo a revoke: back to ISSUED when it already had a number, otherwise back to waiting. The number is never reused by anyone else. */
export async function restoreCertificate(actor: Pick<CourseActor, "role">, id: string): Promise<Result> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบ");
  const c = await db.certificate.findUnique({ where: { id }, select: { status: true, number: true, serialId: true } });
  if (!c || c.status !== "REVOKED") return fail("เกียรติบัตรนี้ไม่ได้ถูกเพิกถอน");
  const status = c.number || c.serialId === null ? "ISSUED" : "PENDING";
  await db.certificate.update({ where: { id }, data: { status, revokedAt: null, revokeNote: null, ...(status === "ISSUED" && { issuedAt: new Date() }) } });
  return { ok: true };
}

// ---------- designs (the course author or an admin) ----------

export type DesignInput = { name: string; isDefault: boolean; minScore: number | null; serialId: string | null; fields: unknown };

async function courseFor(actor: CourseActor, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, createdById: true } });
  return course && canEditCourse(actor, course) ? course : null;
}

function cleanDesign(i: DesignInput): Result<{ data: { name: string; isDefault: boolean; minScore: number | null; serialId: string | null; fields: Prisma.InputJsonValue } }> {
  const name = i.name.trim();
  if (!name || name.length > 80) return fail("ตั้งชื่อแบบเกียรติบัตร (ไม่เกิน 80 ตัวอักษร)");
  if (i.minScore !== null && (!Number.isInteger(i.minScore) || i.minScore < 1 || i.minScore > 100)) return fail("คะแนนขั้นต่ำต้องเป็นเลข 1–100");
  return { ok: true, data: { name, isDefault: i.isDefault, minScore: i.minScore, serialId: i.serialId, fields: parseFields(i.fields) as unknown as Prisma.InputJsonValue } };
}

export async function createDesign(actor: CourseActor, courseId: string, name: string): Promise<Result<{ id: string }>> {
  if (!(await courseFor(actor, courseId))) return fail("ไม่พบคอร์สนี้");
  const count = await db.certificateDesign.count({ where: { courseId } });
  if (count >= MAX_DESIGNS_PER_COURSE) return fail(`ออกแบบได้ไม่เกิน ${MAX_DESIGNS_PER_COURSE} แบบต่อคอร์ส`);
  const clean = name.trim();
  if (!clean || clean.length > 80) return fail("ตั้งชื่อแบบเกียรติบัตร (ไม่เกิน 80 ตัวอักษร)");
  const d = await db.certificateDesign.create({ data: { courseId, name: clean, position: count, isDefault: count === 0, fields: parseFields(null) as unknown as Prisma.InputJsonValue } });
  return { ok: true, id: d.id };
}

export async function saveDesign(actor: CourseActor, designId: string, input: DesignInput): Promise<Result> {
  const design = await db.certificateDesign.findUnique({ where: { id: designId }, select: { id: true, courseId: true } });
  if (!design || !(await courseFor(actor, design.courseId))) return fail("ไม่พบแบบเกียรติบัตรนี้");
  const clean = cleanDesign(input);
  if (!clean.ok) return clean;
  const current = await db.certificateDesign.findUnique({ where: { id: designId }, select: { serialId: true } });
  if (current && current.serialId !== input.serialId) {
    // the series is the district's register: only an admin picks it, and not once learners already hold certificates from this design
    if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบที่เปลี่ยนชุดเลขได้");
    if (input.serialId && !(await db.certificateSerial.findUnique({ where: { id: input.serialId }, select: { id: true } }))) return fail("ไม่พบชุดเลขที่เลือก");
    if ((await db.certificate.count({ where: { designId } })) > 0) return fail("มีผู้เรียนได้เกียรติบัตรจากแบบนี้แล้ว เปลี่ยนชุดเลขไม่ได้ — สร้างแบบใหม่แทน");
  }
  await db.$transaction(async (tx) => {
    if (clean.data.isDefault) await tx.certificateDesign.updateMany({ where: { courseId: design.courseId, id: { not: designId } }, data: { isDefault: false } });
    await tx.certificateDesign.update({ where: { id: designId }, data: clean.data });
  });
  return { ok: true };
}

/** Take the template picture from a public Google Drive link (the picture is shown from Drive; only the id and size are kept). */
export async function setDesignImage(actor: CourseActor, designId: string, link: string): Promise<Result<{ w: number; h: number }>> {
  const design = await db.certificateDesign.findUnique({ where: { id: designId }, select: { courseId: true } });
  if (!design || !(await courseFor(actor, design.courseId))) return fail("ไม่พบแบบเกียรติบัตรนี้");
  const img = await fetchDriveImage(link, 2400);
  if (!img.ok) return fail(img.error);
  if (img.width < 800) return fail("ภาพเทมเพลตเล็กเกินไป (ควรกว้างอย่างน้อย 1600 พิกเซล) จะพิมพ์ไม่คมชัด");
  const ratio = img.width / img.height;
  if (ratio < 1.2 || ratio > 1.6) return fail("ภาพเทมเพลตควรเป็น A4 แนวนอน (กว้างต่อสูงประมาณ 1.41)");
  await db.certificateDesign.update({ where: { id: designId }, data: { imageDriveId: img.id, imageW: img.width, imageH: img.height } });
  return { ok: true, w: img.width, h: img.height };
}

export async function deleteDesign(actor: CourseActor, designId: string): Promise<Result> {
  const design = await db.certificateDesign.findUnique({ where: { id: designId }, select: { courseId: true, isDefault: true } });
  if (!design || !(await courseFor(actor, design.courseId))) return fail("ไม่พบแบบเกียรติบัตรนี้");
  if ((await db.certificate.count({ where: { designId } })) > 0) return fail("มีผู้เรียนได้เกียรติบัตรจากแบบนี้แล้ว ลบไม่ได้");
  await db.$transaction(async (tx) => {
    await tx.certificateDesign.delete({ where: { id: designId } });
    if (design.isDefault) {
      const first = await tx.certificateDesign.findFirst({ where: { courseId: design.courseId }, orderBy: { position: "asc" }, select: { id: true } });
      if (first) await tx.certificateDesign.update({ where: { id: first.id }, data: { isDefault: true } });
    }
  });
  return { ok: true };
}

// ---------- number series and fonts (admins) ----------

export type SerialInput = { name: string; pattern: string; padding: number; nextNo: number; resetYearly: boolean; mode: NumberMode; endNo: number | null };

function cleanSerial(i: SerialInput): Result<{ data: SerialInput }> {
  const name = i.name.trim();
  if (!name || name.length > 80) return fail("ตั้งชื่อชุดเลข (ไม่เกิน 80 ตัวอักษร)");
  const bad = patternProblem(i.pattern);
  if (bad) return fail(bad);
  if (!Number.isInteger(i.padding) || i.padding < 1 || i.padding > 8) return fail("จำนวนหลักต้องเป็น 1–8");
  if (!Number.isInteger(i.nextNo) || i.nextNo < 1 || i.nextNo > 99_999_999) return fail("เลขเริ่มต้นต้องเป็นจำนวนเต็มตั้งแต่ 1");
  if (!NUMBER_MODES.includes(i.mode)) return fail("เลือกวิธีออกเลข");
  if (i.endNo !== null) {
    if (!Number.isInteger(i.endNo) || i.endNo < 1 || i.endNo > 99_999_999) return fail("เลขสิ้นสุดต้องเป็นจำนวนเต็มตั้งแต่ 1 (หรือเว้นว่างถ้าไม่จำกัด)");
    if (i.endNo < i.nextNo - 1) return fail("เลขสิ้นสุดต้องไม่น้อยกว่าเลขเริ่มต้น");
  }
  return { ok: true, data: { name, pattern: i.pattern.trim(), padding: i.padding, nextNo: i.nextNo, resetYearly: i.resetYearly, mode: i.mode, endNo: i.endNo } };
}

export async function saveSerial(actor: Pick<CourseActor, "role">, id: string | null, input: SerialInput): Promise<Result<{ id: string }>> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบ");
  const clean = cleanSerial(input);
  if (!clean.ok) return clean;
  if (!id) {
    if (clean.data.endNo !== null && clean.data.endNo < clean.data.nextNo) return fail("เลขสิ้นสุดต้องไม่น้อยกว่าเลขเริ่มต้น");
    return { ok: true, id: (await db.certificateSerial.create({ data: clean.data })).id };
  }
  const used = await db.certificate.count({ where: { serialId: id, number: { not: null } } });
  // once numbers went out, the pattern must not change under them and the counter must not go back (it would repeat numbers)
  const cur = await db.certificateSerial.findUnique({ where: { id } });
  if (!cur) return fail("ไม่พบชุดเลข");
  if (used > 0 && (cur.pattern !== clean.data.pattern || cur.padding !== clean.data.padding)) return fail("ออกเลขไปแล้ว เปลี่ยนรูปแบบเลขไม่ได้ — สร้างชุดเลขใหม่แทน");
  if (used > 0 && clean.data.nextNo < cur.nextNo) return fail(`เลขถัดไปต้องไม่น้อยกว่า ${cur.nextNo} (เลขที่ออกไปแล้วจะซ้ำ)`);
  await db.certificateSerial.update({ where: { id }, data: clean.data });
  return { ok: true, id };
}

export async function deleteSerial(actor: Pick<CourseActor, "role">, id: string): Promise<Result> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบ");
  if ((await db.certificateDesign.count({ where: { serialId: id } })) > 0) return fail("มีแบบเกียรติบัตรใช้ชุดเลขนี้อยู่ ลบไม่ได้");
  if ((await db.certificate.count({ where: { serialId: id } })) > 0) return fail("เคยออกเลขจากชุดนี้แล้ว ลบไม่ได้");
  await db.certificateSerial.delete({ where: { id } });
  return { ok: true };
}

export const MAX_FONT_BYTES = 3 * 1024 * 1024;
export const MAX_FONTS = 30;

/** Real font files start with one of these four signatures; a renamed picture or document is refused. */
export function fontMime(buf: Uint8Array): string | null {
  const s = String.fromCharCode(...buf.slice(0, 4));
  if (buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0) return "font/ttf";
  if (s === "OTTO") return "font/otf";
  if (s === "wOFF") return "font/woff";
  if (s === "wOF2") return "font/woff2";
  return null;
}

export async function addFont(actor: Pick<CourseActor, "role"> & { id?: string }, name: string, bytes: Uint8Array): Promise<Result<{ id: string }>> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบ");
  const label = name.trim();
  if (!label || label.length > 60) return fail("ตั้งชื่อฟอนต์ (ไม่เกิน 60 ตัวอักษร)");
  if (bytes.length === 0 || bytes.length > MAX_FONT_BYTES) return fail(`ไฟล์ฟอนต์ต้องไม่เกิน ${MAX_FONT_BYTES / 1024 / 1024} MB`);
  const mime = fontMime(bytes);
  if (!mime) return fail("ไม่ใช่ไฟล์ฟอนต์ (รองรับ .ttf .otf .woff .woff2)");
  if ((await db.certificateFont.count()) >= MAX_FONTS) return fail(`เพิ่มฟอนต์ได้ไม่เกิน ${MAX_FONTS} ตัว ลบตัวที่ไม่ใช้ก่อน`);
  const f = await db.certificateFont.create({ data: { name: label, mime, size: bytes.length, data: Buffer.from(bytes), createdById: actor.id ?? null }, select: { id: true } });
  return { ok: true, id: f.id };
}

export async function deleteFont(actor: Pick<CourseActor, "role">, id: string): Promise<Result> {
  if (!isCourseAdmin(actor)) return fail("เฉพาะผู้ดูแลระบบ");
  const inUse = await db.certificateDesign.findMany({ select: { name: true, fields: true, course: { select: { title: true } } } });
  const hit = inUse.find((d) => parseFields(d.fields).some((f) => f.enabled && f.font === `f:${id}`));
  if (hit) return fail(`ฟอนต์นี้ถูกใช้ในแบบ “${hit.name}” ของคอร์ส “${hit.course.title}” ลบไม่ได้`);
  await db.certificateFont.deleteMany({ where: { id } });
  return { ok: true };
}
