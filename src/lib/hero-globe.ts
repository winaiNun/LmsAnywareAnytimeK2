/**
 * Geometry of the home-banner globe: points spread evenly on a sphere, joined to their nearest neighbours, turned and
 * projected to the screen. Pure maths (no DOM), so it is easy to test; the canvas drawing lives in components/hero-globe.tsx.
 */
export type P3 = { x: number; y: number; z: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** n points spread evenly over the unit sphere (Fibonacci spiral). */
export function fibonacciSphere(n: number): P3[] {
  const count = Math.max(1, Math.floor(n));
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * GOLDEN_ANGLE;
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
  });
}

const dist2 = (a: P3, b: P3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

/** Every point is joined to its `k` nearest neighbours; a pair is listed once (a < b). The globe is rigid, so this is computed once. */
export function nearestEdges(points: P3[], k: number): [number, number][] {
  const seen = new Set<number>();
  const edges: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const near = points
      .map((p, j) => ({ j, d: j === i ? Infinity : dist2(points[i], p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(0, k));
    for (const { j } of near) {
      if (!Number.isFinite(dist2(points[i], points[j])) || i === j) continue;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = a * points.length + b;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }
  return edges;
}

/** Turn around the vertical axis by `ay`, then tip forward/back around the horizontal axis by `ax` (radians). */
export function rotate(p: P3, ax: number, ay: number): P3 {
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  return { x: x1, y: p.y * cx - z1 * sx, z: p.y * sx + z1 * cx };
}

export type Projected = { x: number; y: number; scale: number; depth: number };

/** z > 0 is towards the viewer. `depth` runs 0 (far side) to 1 (near side); `scale` is the perspective size factor. */
export function project(p: P3, cx: number, cy: number, radius: number, perspective = 0.35): Projected {
  const scale = 1 / (1 - p.z * perspective);
  return { x: cx + p.x * radius * scale, y: cy + p.y * radius * scale, scale, depth: (p.z + 1) / 2 };
}

/** How many points suit a banner this wide (fewer on phones: smoother and lighter on the battery). */
export const pointCountFor = (width: number) => (width < 640 ? 72 : width < 1100 ? 110 : 140);
