/**
 * Video watch tracking. The browser reports the stretches it played continuously ("segments"); the server keeps, for
 * every 5-second slice of the video, how many seconds of it were really watched. A slice counts as watched when at
 * least 3 of its seconds (or 60% of a short last slice) were played. Skipping ahead adds nothing, replaying adds nothing
 * twice, and a report can not claim more playing time than has really passed since the previous one.
 * Server only (uses Buffer for the stored base64 form).
 */
export const SLICE = 5;
export const MAX_DURATION = 6 * 3600; // longest video we accept (seconds)
export const MAX_SEGMENT = 300; // one continuous stretch in a single report
const SLACK = 8; // seconds of tolerance for timers and network delay
const RATE = 1.5; // playing at 1.5x is fine; more than that is not plausible
const FIRST_REPORT_MAX = 90;

export type Segment = [number, number];
export type WatchState = { durationSec: number; map: string; lastReportAt: Date | null };
export type WatchReport = { durationSec: number; segments: Segment[] };
export type WatchResult =
  | { ok: true; durationSec: number; map: string; percent: number; changed: boolean }
  | { ok: false; error: string };

const sliceCount = (duration: number) => Math.ceil(duration / SLICE);
const sliceLength = (duration: number, i: number) => Math.min(SLICE, duration - i * SLICE);

function decode(map: string, n: number): number[] {
  const bytes = map ? Buffer.from(map, "base64") : Buffer.alloc(0);
  return Array.from({ length: n }, (_, i) => bytes[i] ?? 0);
}
const encode = (cells: number[]) => Buffer.from(Uint8Array.from(cells)).toString("base64");

/** Percent (0-100) of the slices that count as watched. */
export function watchedPercent(map: string, durationSec: number): number {
  if (durationSec <= 0) return 0;
  const n = sliceCount(durationSec);
  const cells = decode(map, n);
  let watched = 0;
  for (let i = 0; i < n; i++) {
    const need = Math.min(3, Math.ceil(sliceLength(durationSec, i) * 0.6));
    if (cells[i] >= need) watched++;
  }
  return Math.min(100, Math.floor((watched / n) * 100));
}

/** Merge one report into the stored state, or refuse it (the reason is for logs, the learner just sees nothing change). */
export function applyWatchReport(prev: WatchState | null, report: WatchReport, now: Date): WatchResult {
  const d = Math.round(report.durationSec);
  if (!Number.isFinite(d) || d < SLICE || d > MAX_DURATION) return { ok: false, error: "ความยาววิดีโอไม่ถูกต้อง" };
  if (report.segments.length > 40) return { ok: false, error: "รายงานมากเกินไป" };
  // the stored map belongs to one duration; a video that changed length starts over
  const sameVideo = !!prev && prev.durationSec > 0 && Math.abs(prev.durationSec - d) <= Math.max(2, d * 0.01);
  const n = sliceCount(d);
  const cells = decode(sameVideo ? prev!.map : "", n);

  let claimed = 0;
  const checked: Segment[] = [];
  for (const seg of report.segments) {
    const [from, to] = seg;
    if (![from, to].every(Number.isFinite) || from < 0 || to <= from || to > d + 1) return { ok: false, error: "ช่วงเวลาไม่ถูกต้อง" };
    if (to - from > MAX_SEGMENT) return { ok: false, error: "ช่วงเวลายาวเกินไป" };
    claimed += to - from;
    checked.push([from, Math.min(to, d)]);
  }
  const elapsed = prev?.lastReportAt && sameVideo ? Math.max(0, (now.getTime() - prev.lastReportAt.getTime()) / 1000) : FIRST_REPORT_MAX;
  if (claimed > elapsed * RATE + SLACK) return { ok: false, error: "เวลาที่รายงานมากกว่าเวลาจริง" };

  const before = cells.join(",");
  for (const [from, to] of checked) {
    for (let i = Math.floor(from / SLICE); i * SLICE < to && i < n; i++) {
      const overlap = Math.min(to, (i + 1) * SLICE) - Math.max(from, i * SLICE);
      if (overlap > 0) cells[i] = Math.min(SLICE, cells[i] + Math.round(overlap));
    }
  }
  const map = encode(cells);
  return { ok: true, durationSec: d, map, percent: watchedPercent(map, d), changed: cells.join(",") !== before };
}
