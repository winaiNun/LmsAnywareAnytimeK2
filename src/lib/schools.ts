/** Loading schools from the database for the public pages (server only). */
import { db } from "@/lib/db";
import { HOME_SCHOOL_COUNT, type SchoolListItem } from "@/lib/schools-data";
import { driveThumbnailUrl, parseDriveFileId } from "@/lib/drive";
import { fileUrl } from "@/lib/site";

type Row = {
  id: string;
  code: string;
  name: string;
  district: string;
  center: string;
  siteUrl: string | null;
  cardKey: string | null;
  cardSourceUrl?: string | null;
  updatedAt: Date;
};

/**
 * Our own files need durable storage: S3/R2, or the local disk on a real machine. On Vercel with the default
 * "local" driver nothing survives (and stored keys copied from another machine point at nothing).
 */
export const storageIsDurable = () => process.env.STORAGE_DRIVER === "s3" || !process.env.VERCEL;

/** Card picture to show: our stored copy when storage works, otherwise straight from the school's public Drive link. */
export function cardUrlFor(s: Pick<Row, "cardKey" | "cardSourceUrl">): string | null {
  if (s.cardKey && storageIsDurable()) return fileUrl(s.cardKey);
  const id = parseDriveFileId(s.cardSourceUrl);
  return id ? driveThumbnailUrl(id, 640) : null;
}

export const toListItem = (s: Row): SchoolListItem => ({
  id: s.id,
  code: s.code,
  name: s.name,
  district: s.district,
  center: s.center,
  siteUrl: s.siteUrl,
  cardUrl: cardUrlFor(s),
  updatedAt: s.updatedAt.getTime(),
});

const select = { id: true, code: true, name: true, district: true, center: true, siteUrl: true, cardKey: true, cardSourceUrl: true, updatedAt: true } as const;

/** Every school that is switched on (a few hundred rows at most — filtered/sorted/paged in memory). */
export async function getPublicSchools(): Promise<SchoolListItem[]> {
  return (await db.school.findMany({ where: { active: true }, select })).map(toListItem);
}

/** A fresh random sample for the home page (different on every request). */
export async function getRandomSchools(n = HOME_SCHOOL_COUNT): Promise<SchoolListItem[]> {
  const ids = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "School" WHERE active = true ORDER BY random() LIMIT ${n}`;
  if (ids.length === 0) return [];
  const rows = await db.school.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select });
  const order = new Map(ids.map((r, i) => [r.id, i]));
  return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(toListItem);
}

export async function countPublicSchools() {
  return db.school.count({ where: { active: true } });
}
