/** Loading schools from the database for the public pages (server only). */
import { db } from "@/lib/db";
import { HOME_SCHOOL_COUNT, type SchoolListItem } from "@/lib/schools-data";
import { fileUrl } from "@/lib/site";

type Row = {
  id: string;
  code: string;
  name: string;
  district: string;
  center: string;
  siteUrl: string | null;
  cardKey: string | null;
  updatedAt: Date;
};

export const toListItem = (s: Row): SchoolListItem => ({
  id: s.id,
  code: s.code,
  name: s.name,
  district: s.district,
  center: s.center,
  siteUrl: s.siteUrl,
  cardUrl: fileUrl(s.cardKey),
  updatedAt: s.updatedAt.getTime(),
});

const select = { id: true, code: true, name: true, district: true, center: true, siteUrl: true, cardKey: true, updatedAt: true } as const;

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
