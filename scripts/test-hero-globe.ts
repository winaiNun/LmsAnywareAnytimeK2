import assert from "node:assert/strict";
import { fibonacciSphere, nearestEdges, pointCountFor, project, rotate } from "../src/lib/hero-globe";

const len = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// 1. points sit on the unit sphere, evenly: both poles are used and the top and bottom halves hold about the same number
for (const n of [1, 2, 72, 110, 140]) {
  const pts = fibonacciSphere(n);
  assert.equal(pts.length, n);
  for (const p of pts) assert.ok(near(len(p), 1, 1e-9), `unit length (n=${n})`);
}
const pts = fibonacciSphere(140);
assert.ok(near(pts[0].y, 1) && near(pts[139].y, -1), "poles");
assert.ok(Math.abs(pts.filter((p) => p.y > 0).length - pts.filter((p) => p.y < 0).length) <= 2, "balanced halves");
assert.equal(new Set(pts.map((p) => p.x.toFixed(6) + p.y.toFixed(6) + p.z.toFixed(6))).size, 140, "no two points coincide");
assert.deepEqual(fibonacciSphere(0).length, 1, "at least one point");
console.log("ok sphere");

// 2. edges: each pair once (a < b), nothing joined to itself, every point has a line, bounded count
const edges = nearestEdges(pts, 3);
assert.ok(edges.every(([a, b]) => a < b), "ordered pairs");
assert.equal(new Set(edges.map(([a, b]) => `${a}-${b}`)).size, edges.length, "no duplicates");
const touched = new Set(edges.flat());
assert.equal(touched.size, 140, "every point is connected");
assert.ok(edges.length >= 140 * 3 / 2 && edges.length <= 140 * 3, `edge count ${edges.length} within 1.5n..3n`);
assert.deepEqual(nearestEdges(fibonacciSphere(1), 3), [], "one point has no neighbours");
assert.deepEqual(nearestEdges(pts, 0), [], "k = 0 draws no lines");
// the lines are short ones: the longest is far below the diameter
const dmax = Math.max(...edges.map(([a, b]) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y, pts[a].z - pts[b].z)));
assert.ok(dmax < 0.6, `longest line ${dmax.toFixed(2)} of a diameter of 2`);
console.log("ok edges");

// 3. rotation keeps lengths, zero rotation changes nothing, a quarter turn about the vertical axis moves +z to +x
const p = { x: 0.3, y: -0.5, z: Math.sqrt(1 - 0.09 - 0.25) };
for (const [ax, ay] of [[0, 0], [0.4, 1.3], [-1, 6], [2, -3]]) assert.ok(near(len(rotate(p, ax, ay)), 1, 1e-9), `length kept (${ax},${ay})`);
const same = rotate(p, 0, 0);
assert.ok(near(same.x, p.x) && near(same.y, p.y) && near(same.z, p.z));
const q = rotate({ x: 0, y: 0, z: 1 }, 0, Math.PI / 2);
assert.ok(near(q.x, 1, 1e-9) && near(q.y, 0, 1e-9) && near(q.z, 0, 1e-9), "quarter turn");
const tip = rotate({ x: 0, y: 0, z: 1 }, Math.PI / 2, 0);
assert.ok(near(tip.y, -1, 1e-9) && near(tip.z, 0, 1e-9), "tipping by +ax lifts the near point up the screen (screen y points down)");
console.log("ok rotation");

// 4. projection: the near side is bigger, brighter (depth) and farther from the centre than the far side
const front = project({ x: 0.5, y: 0, z: 0.8 }, 100, 100, 50);
const back = project({ x: 0.5, y: 0, z: -0.8 }, 100, 100, 50);
assert.ok(front.scale > back.scale && front.depth > back.depth);
assert.ok(front.x - 100 > back.x - 100, "perspective pushes near points outwards");
const mid = project({ x: 0, y: 0, z: 0 }, 100, 100, 50);
assert.deepEqual([mid.x, mid.y, mid.scale, mid.depth], [100, 100, 1, 0.5]);
assert.ok(front.depth <= 1 && back.depth >= 0);
console.log("ok projection");

// 5. fewer points on narrow screens
assert.ok(pointCountFor(360) < pointCountFor(800) && pointCountFor(800) < pointCountFor(1400));
assert.equal(pointCountFor(639), pointCountFor(320));
console.log("hero globe: all groups passed");
