/**
 * The numbers the home-page stat cards can show, with their default Thai label and icon. Pure (no database): the counting itself
 * is in compute.ts. Only content and community numbers are offered, never website traffic.
 */
export const STAT_METRICS = {
  media: { label: "สื่อการเรียนรู้", icon: "book-open", about: "จำนวนสื่อในคลังสื่อที่เผยแพร่แล้ว" },
  courses: { label: "คอร์สเรียน", icon: "play-circle", about: "จำนวนคอร์สเรียนที่เผยแพร่แล้ว" },
  creators: { label: "ผู้สร้างสื่อ/วิทยากร", icon: "graduation-cap", about: "จำนวนคนที่เป็นเจ้าของสื่อหรือคอร์สที่เผยแพร่แล้ว (นับคนละ 1 ครั้ง ไม่นับบัญชีนักเรียนและบัญชีที่ปิดใช้งาน)" },
  mediaCreators: { label: "ผู้สร้างสื่อ", icon: "presentation", about: "จำนวนคนที่เป็นเจ้าของสื่อที่เผยแพร่แล้ว (ไม่นับบัญชีนักเรียนและบัญชีที่ปิดใช้งาน)" },
  instructors: { label: "วิทยากร/ผู้สอน", icon: "graduation-cap", about: "จำนวนคนที่เป็นเจ้าของคอร์สที่เผยแพร่แล้ว (ไม่นับบัญชีนักเรียนและบัญชีที่ปิดใช้งาน)" },
  students: { label: "ผู้เรียน/นักเรียน", icon: "users", about: "จำนวนสมาชิกประเภทนักเรียนที่ยังเปิดใช้งาน" },
  members: { label: "สมาชิกทั้งหมด", icon: "users", about: "จำนวนสมาชิกทุกประเภทที่ยังเปิดใช้งาน (นักเรียน ครู ศึกษานิเทศก์ บุคคลทั่วไป)" },
  learners: { label: "ผู้ลงทะเบียนเรียนคอร์ส", icon: "user-check", about: "จำนวนคนที่ลงทะเบียนเรียนคอร์สที่เผยแพร่แล้วอย่างน้อย 1 คอร์ส (นับคนละ 1 ครั้ง)" },
  enrollments: { label: "การลงทะเบียนเรียน", icon: "clipboard-check", about: "จำนวนครั้งที่ลงทะเบียนเรียนคอร์สที่เผยแพร่แล้ว (คนเดียวลงหลายคอร์สนับหลายครั้ง)" },
  certificates: { label: "เกียรติบัตรที่ออกแล้ว", icon: "award", about: "จำนวนเกียรติบัตรที่ออกเลขที่เรียบร้อยแล้ว (ไม่นับที่รอออกเลขหรือถูกเพิกถอน)" },
  schools: { label: "โรงเรียนในทำเนียบ", icon: "school", about: "จำนวนโรงเรียนที่แสดงในทำเนียบ Anywhere Anytime" },
} as const;

export type StatMetric = keyof typeof STAT_METRICS;
export const STAT_METRIC_KEYS = Object.keys(STAT_METRICS) as StatMetric[];
export const isStatMetric = (v: unknown): v is StatMetric => typeof v === "string" && Object.prototype.hasOwnProperty.call(STAT_METRICS, v);

/** The four cards a new site starts with (the migration inserts the same rows). */
export const DEFAULT_STAT_CARDS: { id: string; metric: StatMetric }[] = [
  { id: "stat_default_media", metric: "media" },
  { id: "stat_default_courses", metric: "courses" },
  { id: "stat_default_creators", metric: "creators" },
  { id: "stat_default_students", metric: "students" },
];

/** Icons the admin may pick for a card. */
export const STAT_ICON_KEYS = ["book-open", "play-circle", "users", "graduation-cap", "user-check", "award", "trophy", "school", "file-text", "presentation", "clipboard-check", "globe", "sparkles", "heart"] as const;
export const isStatIcon = (v: unknown): v is (typeof STAT_ICON_KEYS)[number] => typeof v === "string" && (STAT_ICON_KEYS as readonly string[]).includes(v);

export const MAX_STAT_CARDS = 8;
export const MAX_STAT_LABEL = 40;

/** A card row as stored: empty label / icon mean "the default of its metric". */
export type StatCardRow = { metric: string; label: string | null; icon: string | null };

export const statLabel = (c: StatCardRow): string => c.label?.trim() || (isStatMetric(c.metric) ? STAT_METRICS[c.metric].label : c.metric);
export const statIcon = (c: StatCardRow): string => (c.icon && isStatIcon(c.icon) ? c.icon : isStatMetric(c.metric) ? STAT_METRICS[c.metric].icon : "sparkles");

/** 1234567 -> "1,234,567" (Thai locale); anything that is not a finite number shows as 0. */
export const formatStat = (n: unknown): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  return v.toLocaleString("th-TH");
};
