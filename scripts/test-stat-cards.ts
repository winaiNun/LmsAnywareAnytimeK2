import assert from "node:assert/strict";
import { ICON_PATHS } from "../src/lib/icon-paths";
import { DEFAULT_STAT_CARDS, MAX_STAT_CARDS, MAX_STAT_LABEL, STAT_ICON_KEYS, STAT_METRICS, STAT_METRIC_KEYS, formatStat, isStatIcon, isStatMetric, statIcon, statLabel } from "../src/lib/stats/metrics";
import { parseCardInput } from "../src/lib/stats/validate";

// 1. the catalogue is complete and consistent
assert.ok(STAT_METRIC_KEYS.length >= 10);
for (const key of STAT_METRIC_KEYS) {
  const m = STAT_METRICS[key];
  assert.ok(m.label.trim().length > 0 && m.label.length <= MAX_STAT_LABEL, `${key}: default label fits the limit`);
  assert.ok(m.about.length > 10, `${key}: says what it counts`);
  assert.ok(Object.prototype.hasOwnProperty.call(ICON_PATHS, m.icon), `${key}: icon "${m.icon}" exists`);
}
assert.equal(new Set(STAT_METRIC_KEYS.map((k) => STAT_METRICS[k].label)).size, STAT_METRIC_KEYS.length, "default labels are all different");
for (const k of STAT_ICON_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(ICON_PATHS, k), `pickable icon ${k} exists`);
// no website-traffic numbers are offered
for (const k of STAT_METRIC_KEYS) assert.ok(!/view|visit|click|traffic|online/i.test(k), `${k} is not a traffic metric`);
console.log("ok catalogue");

// 2. the starter cards use real metrics, once each, and the four the owner asked for
assert.equal(DEFAULT_STAT_CARDS.length, 4);
assert.deepEqual(DEFAULT_STAT_CARDS.map((c) => c.metric), ["media", "courses", "creators", "students"]);
assert.equal(new Set(DEFAULT_STAT_CARDS.map((c) => c.id)).size, 4);
assert.ok(DEFAULT_STAT_CARDS.every((c) => isStatMetric(c.metric) && c.id.startsWith("stat_default_")));
assert.equal(statLabel({ metric: "creators", label: null, icon: null }), "ผู้สร้างสื่อ/วิทยากร");
assert.equal(statLabel({ metric: "students", label: null, icon: null }), "ผู้เรียน/นักเรียน");
console.log("ok defaults");

// 3. label and icon: own value wins, empty or unknown falls back
assert.equal(statLabel({ metric: "media", label: "  คลังความรู้ ", icon: null }), "คลังความรู้");
assert.equal(statLabel({ metric: "media", label: "   ", icon: null }), "สื่อการเรียนรู้");
assert.equal(statLabel({ metric: "gone", label: null, icon: null }), "gone", "a removed metric still shows something");
assert.equal(statIcon({ metric: "media", label: null, icon: "trophy" }), "trophy");
assert.equal(statIcon({ metric: "media", label: null, icon: "no-such-icon" }), "book-open");
assert.equal(statIcon({ metric: "gone", label: null, icon: null }), "sparkles");
assert.ok(isStatIcon("award") && !isStatIcon("<script>") && !isStatIcon(5));
console.log("ok fallbacks");

// 4. number format
assert.equal(formatStat(1234567), "1,234,567");
assert.equal(formatStat(0), "0");
assert.equal(formatStat(12.6), "13");
for (const bad of [-5, NaN, Infinity, "12", null, undefined]) assert.equal(formatStat(bad), "0", String(bad));
console.log("ok format");

// 5. the form
assert.deepEqual(parseCardInput({ metric: "courses", label: "  คอร์สเด่น   ของเรา ", icon: "trophy" }), { ok: true, data: { metric: "courses", label: "คอร์สเด่น ของเรา", icon: "trophy" } });
assert.deepEqual(parseCardInput({ metric: "media", label: "", icon: "" }), { ok: true, data: { metric: "media", label: null, icon: null } });
for (const bad of [{ metric: "" }, { metric: "views" }, { metric: "constructor" }, { metric: "media", label: "ก".repeat(MAX_STAT_LABEL + 1) }, { metric: "media", icon: "not-an-icon" }, {}]) {
  assert.equal(parseCardInput(bad as Record<string, unknown>).ok, false, JSON.stringify(bad));
}
assert.equal(parseCardInput({ metric: "media", label: "ก".repeat(MAX_STAT_LABEL) }).ok, true);
assert.ok(MAX_STAT_CARDS >= 4 && MAX_STAT_CARDS <= 12);
console.log("ok form");
console.log("stat cards: all groups passed");
