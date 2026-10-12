"use server";

import { revalidatePath } from "next/cache";
import { addFont, createDesign, deleteDesign, deleteSerial, issueNumbers, restoreCertificate, revokeCertificate, saveDesign, saveSerial, setDesignImage, type DesignInput, type Result } from "@/lib/certificate/cert-store";
import { getCourseActor } from "@/lib/course/course-server";
import { deleteFont } from "@/lib/certificate/cert-store";

const NEED_LOGIN = { ok: false as const, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

async function actor() {
  return getCourseActor();
}
const refresh = (courseId: string) => revalidatePath(`/dashboard/courses/${courseId}/edit`);

export async function createDesignAction(courseId: string, name: string): Promise<Result<{ id: string }>> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await createDesign(a, courseId, name);
  if (r.ok) refresh(courseId);
  return r;
}

export async function saveDesignAction(courseId: string, designId: string, input: DesignInput): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await saveDesign(a, designId, input);
  if (r.ok) refresh(courseId);
  return r;
}

export async function setDesignImageAction(courseId: string, designId: string, link: string): Promise<Result<{ w: number; h: number }>> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await setDesignImage(a, designId, link);
  if (r.ok) refresh(courseId);
  return r;
}

export async function deleteDesignAction(courseId: string, designId: string): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await deleteDesign(a, designId);
  if (r.ok) refresh(courseId);
  return r;
}

export async function issueNumbersAction(courseId: string): Promise<Result<{ issued: number; stopped: boolean }>> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await issueNumbers(a, courseId);
  if (r.ok) refresh(courseId);
  return r;
}

export async function revokeCertificateAction(courseId: string, id: string, note: string): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await revokeCertificate(a, id, note);
  if (r.ok) refresh(courseId);
  return r;
}

export async function restoreCertificateAction(courseId: string, id: string): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await restoreCertificate(a, id);
  if (r.ok) refresh(courseId);
  return r;
}

// ---- admin: number series and fonts ----

export async function saveSerialAction(id: string | null, input: Parameters<typeof saveSerial>[2]): Promise<Result<{ id: string }>> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await saveSerial(a, id, input);
  if (r.ok) revalidatePath("/admin/certificates");
  return r;
}

export async function deleteSerialAction(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await deleteSerial(a, id);
  if (r.ok) revalidatePath("/admin/certificates");
  return r;
}

export async function addFontAction(formData: FormData): Promise<Result<{ id: string }>> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  if (formData.get("confirm") !== "on") return { ok: false, error: "ติ๊กยืนยันว่ามีสิทธิ์ใช้ฟอนต์นี้ก่อน" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "เลือกไฟล์ฟอนต์" };
  const r = await addFont(a, String(formData.get("name") ?? ""), new Uint8Array(await file.arrayBuffer()));
  if (r.ok) revalidatePath("/admin/certificates");
  return r;
}

export async function deleteFontAction(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return NEED_LOGIN;
  const r = await deleteFont(a, id);
  if (r.ok) revalidatePath("/admin/certificates");
  return r;
}
