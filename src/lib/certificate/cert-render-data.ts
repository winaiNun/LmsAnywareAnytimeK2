import { db } from "@/lib/db";
import { driveThumbnailUrl } from "@/lib/drive";
import { certValues, parseFields, type CertField, type CertValues } from "./schema";

const A4 = 297 / 210;

export type CertRender = {
  id: string;
  status: "PENDING" | "ISSUED" | "REVOKED";
  number: string | null;
  verifyCode: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  courseAuthorId: string;
  designName: string;
  numberMode: "MANUAL" | "AUTO" | null; // how the series gives numbers; null = this design needs no number
  imageSrc: string | null;
  aspect: number;
  fields: CertField[];
  values: CertValues;
  usedFonts: { id: string; name: string }[];
  issuedAt: Date | null;
  completedAt: Date;
  holderName: string;
};

/** Everything needed to draw one certificate. Until it is issued the number shows as "รอออกเลข" and the name follows the member's current name. */
export async function loadCertificate(where: { id: string } | { verifyCode: string }): Promise<CertRender | null> {
  const c = await db.certificate.findUnique({
    where,
    include: {
      design: true,
      serial: { select: { mode: true } },
      course: { select: { title: true, hours: true, instructorName: true, createdById: true } },
      user: { select: { name: true, organization: true, memberSchool: { select: { name: true } } } },
    },
  });
  if (!c) return null;
  const fields = parseFields(c.design.fields);
  const fontIds = [...new Set(fields.filter((f) => f.enabled && f.font.startsWith("f:")).map((f) => f.font.slice(2)))];
  const holderName = c.nameSnapshot ?? c.user.name;
  const values = certValues({
    name: holderName, number: c.number ?? "รอออกเลข", completedAt: c.completedAt, issuedAt: c.issuedAt, course: c.course.title, scorePercent: c.scorePercent,
    hours: c.course.hours, instructor: c.course.instructorName, school: c.user.memberSchool?.name ?? c.user.organization, code: c.verifyCode,
  });
  return {
    id: c.id, status: c.status, number: c.number, verifyCode: c.verifyCode, courseId: c.courseId, courseTitle: c.course.title, userId: c.userId, courseAuthorId: c.course.createdById,
    designName: c.design.name,
    numberMode: c.serial?.mode ?? null,
    imageSrc: c.design.imageDriveId ? driveThumbnailUrl(c.design.imageDriveId, 2400) : null,
    aspect: c.design.imageW > 0 && c.design.imageH > 0 ? c.design.imageW / c.design.imageH : A4,
    fields, values, usedFonts: fontIds.map((id) => ({ id, name: "" })),
    issuedAt: c.issuedAt, completedAt: c.completedAt, holderName,
  };
}
