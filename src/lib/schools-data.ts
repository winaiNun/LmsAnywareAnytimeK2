/**
 * School directory: pure filtering / sorting / paging / random pick (no imports → server + client safe).
 * The whole district is a few hundred schools, so everything is done in memory after one query, which
 * keeps Thai sorting correct (database collations are not reliable for Thai) and the code simple.
 */

export type SchoolListItem = {
  id: string;
  code: string;
  name: string;
  district: string; // อำเภอ
  center: string; // ศูนย์เครือข่าย
  siteUrl: string | null;
  cardUrl: string | null; // public URL of the card image, if fetched
  updatedAt: number; // ms
};

export const SCHOOL_SORTS = [
  { value: "name", label: "ชื่อโรงเรียน ก → ฮ" },
  { value: "name-desc", label: "ชื่อโรงเรียน ฮ → ก" },
  { value: "code", label: "รหัสโรงเรียน (น้อย → มาก)" },
  { value: "district", label: "อำเภอ → ศูนย์เครือข่าย" },
  { value: "updated", label: "อัปเดตล่าสุด" },
] as const;
export type SchoolSort = (typeof SCHOOL_SORTS)[number]["value"];

export const HOME_SCHOOL_COUNT = 12; // 4 columns × 3 rows
export const SCHOOLS_PER_PAGE = 16; // 4 columns × 4 rows

const collator = new Intl.Collator("th", { sensitivity: "base", numeric: true });

/** "โรงเรียนบ้านหนองไผ่" sorts as "บ้านหนองไผ่": every name starts with "โรงเรียน", which says nothing. */
export const sortName = (name: string) => name.replace(/^\s*โรงเรียน\s*/, "").trim();

/** Compare two Thai strings in dictionary order (leading vowels ignored, numbers by value). */
export const compareThai = (a: string, b: string) => collator.compare(a, b);

/** Lower-case, collapse spaces, drop zero-width characters: what we compare typed text against. */
export const normalizeText = (s: string) => s.replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export type SchoolQuery = { q?: string; district?: string; center?: string; sort?: string; page?: number; perPage?: number };

export function isSort(v: string | undefined): v is SchoolSort {
  return SCHOOL_SORTS.some((s) => s.value === v);
}

/**
 * Free-text match on name, code, district and center: every word typed must appear somewhere.
 * A short number ("2" in "จักราช 2") is a centre/name number, not a fragment of a school code, so it only
 * matches a whole token of the name/district/centre; numbers of 4+ digits may match inside the code.
 */
export function matchesQuery(s: SchoolListItem, q: string): boolean {
  const words = normalizeText(q).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeText(`${s.name} ${s.district} ${s.center}`);
  const tokens = new Set(text.split(" "));
  const hay = `${text} ${s.code}`;
  return words.every((w) => (/^\d{1,3}$/.test(w) ? tokens.has(w) : hay.includes(w)));
}

export function sortSchools<T extends SchoolListItem>(list: T[], sort: SchoolSort): T[] {
  const byName = (a: T, b: T) => compareThai(sortName(a.name), sortName(b.name)) || a.code.localeCompare(b.code);
  const out = [...list];
  switch (sort) {
    case "name-desc": return out.sort((a, b) => byName(b, a));
    case "code": return out.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
    case "district": return out.sort((a, b) => compareThai(a.district, b.district) || compareThai(a.center, b.center) || byName(a, b));
    case "updated": return out.sort((a, b) => b.updatedAt - a.updatedAt || byName(a, b));
    default: return out.sort(byName);
  }
}

export type SchoolPage<T extends SchoolListItem = SchoolListItem> = {
  items: T[];
  total: number; // after filtering
  page: number; // clamped, 1-based
  pages: number;
  perPage: number;
};

export function querySchools<T extends SchoolListItem>(all: T[], query: SchoolQuery): SchoolPage<T> {
  const perPage = Math.max(1, Math.floor(query.perPage ?? SCHOOLS_PER_PAGE));
  const filtered = all.filter(
    (s) => (!query.district || s.district === query.district) && (!query.center || s.center === query.center) && (!query.q || matchesQuery(s, query.q)),
  );
  const sorted = sortSchools(filtered, isSort(query.sort) ? query.sort : "name");
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1) || 1), pages);
  return { items: sorted.slice((page - 1) * perPage, page * perPage), total: sorted.length, page, pages, perPage };
}

/** Distinct districts and, per district, its centers — for the filter drop-downs (Thai order). */
export function filterOptions(all: SchoolListItem[]): { districts: string[]; centers: { district: string; center: string }[] } {
  const districts = [...new Set(all.map((s) => s.district))].sort(compareThai);
  const seen = new Set<string>();
  const centers: { district: string; center: string }[] = [];
  for (const s of all) {
    const key = `${s.district}\u0000${s.center}`;
    if (!seen.has(key)) {
      seen.add(key);
      centers.push({ district: s.district, center: s.center });
    }
  }
  centers.sort((a, b) => compareThai(a.district, b.district) || compareThai(a.center, b.center));
  return { districts, centers };
}

/** `n` different random items (Fisher–Yates on a copy). `rng` is injectable for tests. */
export function pickRandom<T>(list: readonly T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...list];
  const take = Math.min(Math.max(0, Math.floor(n)), copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}

/** Query string for the schools page, dropping empty values and the first page. */
export function schoolsHref(query: SchoolQuery & { sort?: string }): string {
  const p = new URLSearchParams();
  if (query.q?.trim()) p.set("q", query.q.trim());
  if (query.district) p.set("district", query.district);
  if (query.center) p.set("center", query.center);
  if (query.sort && query.sort !== "name") p.set("sort", query.sort);
  if (query.page && query.page > 1) p.set("page", String(query.page));
  const qs = p.toString();
  return qs ? `/schools?${qs}` : "/schools";
}
