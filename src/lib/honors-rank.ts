/**
 * Honours page: who may appear and how members are ranked. Pure functions (no database), so they are unit-tested
 * and the rules live in one place. Privacy rules, in order of importance:
 *   1. a student (a minor) NEVER appears, whatever the other flags say;
 *   2. a member appears only after choosing so (`showInHonors`), and an admin can take anyone off (`honorsHidden`);
 *   3. staff accounts (admin / librarian) and school accounts are not ranked.
 */
import { bangkokParts, fromBangkokParts } from "@/lib/thai-date";

export const HONOR_TABS = ["all", "media", "courses", "rising", "likes", "views"] as const;
export type HonorTab = (typeof HONOR_TABS)[number];
export const isHonorTab = (v: string | undefined): v is HonorTab => !!v && (HONOR_TABS as readonly string[]).includes(v);

export const HONOR_PERIODS = ["all", "year"] as const;
export type HonorPeriod = (typeof HONOR_PERIODS)[number];
export const isHonorPeriod = (v: string | undefined): v is HonorPeriod => !!v && (HONOR_PERIODS as readonly string[]).includes(v);

export const BIO_MAX = 140;
export const RISING_DAYS = 90;

/** Fields the eligibility check needs. */
export type HonorCandidate = {
  memberType: string;
  role: string;
  active: boolean;
  showInHonors: boolean;
  honorsHidden: boolean;
  managesSchool: boolean;
};

export function isHonorEligible(u: HonorCandidate): boolean {
  return u.active && u.showInHonors && !u.honorsHidden && u.memberType !== "STUDENT" && (u.role === "STUDENT" || u.role === "TEACHER") && !u.managesSchool;
}

/** The same rule as a Prisma `where` (kept next to the function above so the two cannot drift apart; the test checks both). */
export const ELIGIBLE_WHERE = {
  active: true,
  showInHonors: true,
  honorsHidden: false,
  memberType: { not: "STUDENT" as const },
  role: { in: ["STUDENT" as const, "TEACHER" as const] },
  school: { is: null },
};

/** Start of the current Thai academic year (16 May, Bangkok time). */
export function academicYearStart(now: Date): Date {
  const p = bangkokParts(now);
  const year = p.month > 5 || (p.month === 5 && p.day >= 16) ? p.year : p.year - 1;
  return fromBangkokParts({ year, month: 5, day: 16 })!;
}

export type HonorStats = {
  id: string;
  mediaCount: number;
  courseCount: number;
  likes: number;
  views: number;
  joinedAt: Date;
};

export function honorBadges(s: Pick<HonorStats, "mediaCount" | "courseCount" | "likes">): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.mediaCount >= 1) out.push({ key: "media1", label: "สื่อชิ้นแรก" });
  if (s.mediaCount >= 10) out.push({ key: "media10", label: "ครบ 10 สื่อ" });
  if (s.mediaCount >= 25) out.push({ key: "media25", label: "ครบ 25 สื่อ" });
  if (s.courseCount >= 1) out.push({ key: "course1", label: "คอร์สแรก" });
  if (s.courseCount >= 3) out.push({ key: "course3", label: "ครบ 3 คอร์ส" });
  if (s.likes >= 100) out.push({ key: "likes100", label: "ถูกใจครบ 100" });
  return out;
}

const byName = new Intl.Collator("th");

/**
 * Order (and filter) one tab. `rising` = members who joined in the last 90 days and already have a published piece of work.
 * Ranked tabs need at least `minItems` published pieces (media + courses) and a score above zero; ties are broken by the
 * other measure, then by join date (earlier first) so the order is stable between visits.
 */
export function rankHonors<T extends HonorStats & { name: string }>(rows: T[], tab: HonorTab, opts: { minItems: number; now?: Date }): T[] {
  const now = opts.now ?? new Date();
  const items = (r: HonorStats) => r.mediaCount + r.courseCount;
  const eligible = (r: HonorStats) => items(r) >= Math.max(1, opts.minItems);
  const tie = (a: T, b: T) => +a.joinedAt - +b.joinedAt || byName.compare(a.name, b.name);
  const sorted = (list: T[], score: (r: T) => number, second: (r: T) => number) => list.filter((r) => score(r) > 0).sort((a, b) => score(b) - score(a) || second(b) - second(a) || tie(a, b));

  switch (tab) {
    case "all":
      return [...rows].sort((a, b) => byName.compare(a.name, b.name));
    case "media":
      return sorted(rows.filter(eligible), (r) => r.mediaCount, (r) => r.likes);
    case "courses":
      return sorted(rows.filter(eligible), (r) => r.courseCount, (r) => r.mediaCount);
    case "likes":
      return sorted(rows.filter(eligible), (r) => r.likes, (r) => r.mediaCount);
    case "views":
      return sorted(rows.filter(eligible), (r) => r.views, (r) => r.mediaCount);
    case "rising": {
      const since = now.getTime() - RISING_DAYS * 86400000;
      return rows.filter((r) => +r.joinedAt >= since && eligible(r)).sort((a, b) => +b.joinedAt - +a.joinedAt || tie(a, b));
    }
  }
}

/** Fisher–Yates with an injectable random source (the home carousel shuffles on every visit). */
export function shuffled<T>(list: T[], rnd: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
