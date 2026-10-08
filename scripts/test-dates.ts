/* Run with: npm run test:dates — plain assertions, no test framework needed. */
import assert from "node:assert/strict";
import {
  addDaysBangkok, addMonthsBangkok, bangkokParts, bangkokWeekday, daysInMonth, diffCalendarDays, endOfDayBangkok, formatThaiDate,
  formatThaiInput, fromBangkokParts, isLeapYear, lastMonthsBangkok, monthGrid, normalizeYear, parseInstant, parseThaiDateInput,
  startOfDayBangkok, thaiMonthShort, toBE, toCE,
} from "../src/lib/thai-date";

let passed = 0;
const t = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; }
};

t("BE <-> CE", () => {
  assert.equal(toBE(2026), 2569);
  assert.equal(toCE(2569), 2026);
  assert.equal(toCE(toBE(1999)), 1999);
});

t("leap years follow the Gregorian rule (BE 2567 = 2024 is leap, 2569 = 2026 is not)", () => {
  assert.ok(isLeapYear(toCE(2567)));
  assert.ok(!isLeapYear(toCE(2569)));
  assert.ok(isLeapYear(2000) && !isLeapYear(2100) && isLeapYear(2400));
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.deepEqual([1, 3, 4, 6, 9, 11, 12].map((m) => daysInMonth(2026, m)), [31, 31, 30, 30, 30, 30, 31]);
});

t("Bangkok wall clock <-> instant, across the UTC date line", () => {
  const late = fromBangkokParts({ year: 2026, month: 10, day: 8, hour: 23, minute: 30 })!;
  assert.equal(late.toISOString(), "2026-10-08T16:30:00.000Z"); // same day in UTC
  const early = fromBangkokParts({ year: 2026, month: 10, day: 8, hour: 0, minute: 30 })!;
  assert.equal(early.toISOString(), "2026-10-07T17:30:00.000Z"); // PREVIOUS day in UTC
  assert.deepEqual(bangkokParts(early), { year: 2026, month: 10, day: 8, hour: 0, minute: 30 });
  assert.deepEqual(bangkokParts(late), { year: 2026, month: 10, day: 8, hour: 23, minute: 30 });
  // new year in Bangkok happens at 17:00Z on 31 Dec
  assert.equal(bangkokParts(new Date("2026-12-31T17:00:00Z")).year, 2027);
  assert.equal(bangkokParts(new Date("2026-12-31T16:59:59Z")).year, 2026);
});

t("impossible dates are rejected", () => {
  assert.equal(fromBangkokParts({ year: 2026, month: 2, day: 29 }), null);
  assert.ok(fromBangkokParts({ year: 2024, month: 2, day: 29 }));
  assert.equal(fromBangkokParts({ year: 2026, month: 4, day: 31 }), null);
  assert.equal(fromBangkokParts({ year: 2026, month: 13, day: 1 }), null);
  assert.equal(fromBangkokParts({ year: 2026, month: 1, day: 0 }), null);
  assert.equal(fromBangkokParts({ year: 2026, month: 1, day: 1, hour: 24 }), null);
  assert.equal(fromBangkokParts({ year: 2026, month: 1, day: 1, minute: 60 }), null);
  assert.equal(fromBangkokParts({ year: 1800, month: 1, day: 1 }), null);
  assert.equal(fromBangkokParts({ year: 25, month: 1, day: 1 }), null);
  assert.equal(fromBangkokParts({ year: 2026.5, month: 1, day: 1 }), null);
});

t("formatting is พ.ศ. whatever the server time zone", () => {
  const d = new Date("2026-10-08T07:30:00Z"); // 14:30 Bangkok
  assert.equal(formatThaiDate(d, { style: "long" }), "8 ตุลาคม 2569");
  assert.equal(formatThaiDate(d), "8 ต.ค. 2569");
  assert.equal(formatThaiDate(d, { style: "numeric" }), "08/10/2569");
  assert.equal(formatThaiDate(d, { time: true }), "8 ต.ค. 2569 14:30 น.");
  assert.equal(formatThaiDate(d, { style: "long", weekday: true }), "วันพฤหัสบดีที่ 8 ตุลาคม 2569");
  assert.equal(formatThaiDate(new Date("2026-10-07T17:30:00Z"), { style: "numeric" }), "08/10/2569"); // 00:30 Bangkok is already the 8th
  assert.equal(formatThaiDate(null), "—");
  assert.equal(formatThaiDate(new Date("nope")), "—");
  assert.equal(thaiMonthShort(d), "ต.ค.");
  assert.equal(bangkokWeekday(d), 4);
});

t("year normalising: 4-digit BE, 4-digit CE, 2-digit BE, rejects the rest", () => {
  assert.equal(normalizeYear("2569"), 2026);
  assert.equal(normalizeYear("2026"), 2026);
  assert.equal(normalizeYear("69"), 2026);
  assert.equal(normalizeYear("2400"), 1857); // parsed as BE; fromBangkokParts later rejects it as out of range
  assert.equal(normalizeYear("2300"), null);
  assert.equal(normalizeYear("202"), null);
  assert.equal(normalizeYear("20266"), null);
  assert.equal(normalizeYear("abcd"), null);
  assert.equal(normalizeYear("1899"), null);
});

t("typed input in many shapes", () => {
  const ok = (s: string) => parseThaiDateInput(s);
  assert.deepEqual(ok("8/10/2569"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("08-10-2569"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("8.10.2026"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("8/10/69"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("2569-10-08"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("2026-10-08"), { year: 2026, month: 10, day: 8, hour: 0, minute: 0, hasTime: false });
  assert.deepEqual(ok("8/10/2569 14:30"), { year: 2026, month: 10, day: 8, hour: 14, minute: 30, hasTime: true });
  assert.deepEqual(ok("8/10/2569 9.05 น."), { year: 2026, month: 10, day: 8, hour: 9, minute: 5, hasTime: true });
  assert.deepEqual(ok("29/2/2567"), { year: 2024, month: 2, day: 29, hour: 0, minute: 0, hasTime: false });
  for (const bad of ["", "abc", "29/2/2569", "31/4/2569", "32/1/2569", "1/13/2569", "8/10/256", "8/10", "8/10/2569 25:00", "8/10/2569 10:75", "1/1/2300"]) {
    assert.equal(ok(bad), null, `should reject "${bad}"`);
  }
});

t("the typed field round-trips", () => {
  const d = new Date("2026-10-08T07:30:00Z");
  assert.equal(formatThaiInput(d, false), "08/10/2569");
  assert.equal(formatThaiInput(d, true), "08/10/2569 14:30");
  const p = parseThaiDateInput(formatThaiInput(d, true))!;
  assert.equal(fromBangkokParts(p)!.getTime(), d.getTime());
  assert.equal(formatThaiInput(null, true), "");
});

t("parseInstant: ISO with zone, legacy zone-less values as Bangkok, junk rejected", () => {
  assert.equal(parseInstant("2026-10-08T07:30:00.000Z")!.toISOString(), "2026-10-08T07:30:00.000Z");
  assert.equal(parseInstant("2026-10-08T14:30:00+07:00")!.toISOString(), "2026-10-08T07:30:00.000Z");
  assert.equal(parseInstant("2026-10-08T14:30")!.toISOString(), "2026-10-08T07:30:00.000Z"); // Bangkok, not server tz
  assert.equal(parseInstant("2026-10-08")!.toISOString(), "2026-10-07T17:00:00.000Z");
  for (const bad of ["", null, undefined, "yesterday", "2026-02-30T10:00", "2026-13-01T00:00:00Z", "8/10/2569", "1800-01-01T00:00:00Z"]) {
    assert.equal(parseInstant(bad as string), null, `should reject ${String(bad)}`);
  }
});

t("day boundaries and day arithmetic", () => {
  const d = new Date("2026-10-08T07:30:00Z");
  assert.equal(startOfDayBangkok(d).toISOString(), "2026-10-07T17:00:00.000Z");
  assert.equal(endOfDayBangkok(d).toISOString(), "2026-10-08T16:59:59.999Z");
  assert.equal(addDaysBangkok(d, 14).toISOString(), "2026-10-22T07:30:00.000Z");
  assert.equal(formatThaiDate(addDaysBangkok(fromBangkokParts({ year: 2026, month: 12, day: 25 })!, 10), { style: "numeric" }), "04/01/2570"); // year rolls over, BE too
  assert.equal(diffCalendarDays(new Date("2026-10-08T00:30:00+07:00"), new Date("2026-10-08T23:30:00+07:00")), 0);
  assert.equal(diffCalendarDays(new Date("2026-10-08T23:30:00+07:00"), new Date("2026-10-09T00:30:00+07:00")), 1); // 1h apart, next calendar day
  assert.equal(diffCalendarDays(new Date("2026-10-09T00:00:00+07:00"), new Date("2026-10-08T00:00:00+07:00")), -1);
  assert.equal(diffCalendarDays(fromBangkokParts({ year: 2026, month: 2, day: 1 })!, fromBangkokParts({ year: 2026, month: 3, day: 1 })!), 28);
  assert.equal(diffCalendarDays(fromBangkokParts({ year: 2024, month: 2, day: 1 })!, fromBangkokParts({ year: 2024, month: 3, day: 1 })!), 29);
  assert.equal(diffCalendarDays(fromBangkokParts({ year: 2026, month: 1, day: 1 })!, fromBangkokParts({ year: 2027, month: 1, day: 1 })!), 365);
});

t("adding months clamps the day", () => {
  const jan31 = fromBangkokParts({ year: 2026, month: 1, day: 31, hour: 9 })!;
  assert.deepEqual(bangkokParts(addMonthsBangkok(jan31, 1)), { year: 2026, month: 2, day: 28, hour: 9, minute: 0 });
  assert.deepEqual(bangkokParts(addMonthsBangkok(fromBangkokParts({ year: 2024, month: 1, day: 31 })!, 1)), { year: 2024, month: 2, day: 29, hour: 0, minute: 0 });
  assert.deepEqual(bangkokParts(addMonthsBangkok(jan31, 12)), { year: 2027, month: 1, day: 31, hour: 9, minute: 0 });
  assert.deepEqual(bangkokParts(addMonthsBangkok(jan31, -2)), { year: 2025, month: 11, day: 30, hour: 9, minute: 0 });
});

t("last N months for charts, in Bangkok time", () => {
  const months = lastMonthsBangkok(6, new Date("2026-03-15T10:00:00Z"));
  assert.deepEqual(months.map((m) => `${m.year}-${m.month}`), ["2025-10", "2025-11", "2025-12", "2026-1", "2026-2", "2026-3"]);
  assert.equal(months[5].start.toISOString(), "2026-02-28T17:00:00.000Z"); // 1 Mar 00:00 Bangkok
  assert.equal(months[5].end.toISOString(), "2026-03-31T17:00:00.000Z");
  assert.equal(months[4].end.getTime(), months[5].start.getTime()); // no gaps, no overlap
  // a sign-up at 00:30 Bangkok on 1 Mar belongs to March even though it is 28 Feb in UTC
  const signup = new Date("2026-02-28T17:30:00Z");
  assert.ok(signup >= months[5].start && signup < months[5].end);
  assert.ok(!(signup >= months[4].start && signup < months[4].end));
});

t("calendar grid", () => {
  const grid = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
  assert.equal(grid.length, 42);
  assert.deepEqual(grid[4], { year: 2026, month: 10, day: 1, inMonth: true });
  assert.deepEqual(grid[0], { year: 2026, month: 9, day: 27, inMonth: false });
  assert.equal(grid.filter((c) => c.inMonth).length, 31);
  assert.equal(monthGrid(2024, 2).filter((c) => c.inMonth).length, 29);
});

console.log(process.exitCode ? "\nSome date tests FAILED" : `All ${passed} date test groups passed`);
