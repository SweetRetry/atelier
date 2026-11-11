import { getStroke } from "perfect-freehand";
import { lerp, smooth } from "./rng.ts";

type PathCtx = { beginPath(): void; moveTo(x: number, y: number): void; quadraticCurveTo(a: number, b: number, c: number, d: number): void; closePath(): void };

/** Control point: x, y, optional pressure 0..1 (default 1). */
export type Pt = [number, number, number?];

/** One resampled position along a stroke. Brushes consume these. */
export interface Sample {
  x: number;
  y: number;
  /** Pressure 0..1. */
  p: number;
  /** Travel direction in radians. */
  a: number;
  /** Progress 0..1 along the stroke. */
  t: number;
  /** Distance travelled from the start. */
  d: number;
}

const cr = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

/** Catmull-Rom through the control points, resampled at even spacing. */
export function spline(pts: Pt[], spacing = 2): Sample[] {
  const n = pts.length;
  if (n === 0) return [];
  const at = (i: number) => pts[Math.min(n - 1, Math.max(0, i))]!;
  const dense: [number, number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < 16; k++) {
      const u = k / 16;
      dense.push([
        cr(a[0], b[0], c[0], d[0], u),
        cr(a[1], b[1], c[1], d[1], u),
        lerp(b[2] ?? 1, c[2] ?? 1, u),
      ]);
    }
  }
  const last = at(n - 1);
  dense.push([last[0], last[1], last[2] ?? 1]);

  const out: Sample[] = [{ x: dense[0]![0], y: dense[0]![1], p: dense[0]![2], a: 0, t: 0, d: 0 }];
  let need = spacing;
  let dist = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1]!;
    const b = dense[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let rem = L;
    let pos = 0;
    while (rem >= need && L > 0) {
      pos += need;
      rem -= need;
      dist += need;
      need = spacing;
      const u = pos / L;
      out.push({ x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), p: lerp(a[2], b[2], u), a: 0, t: 0, d: dist });
    }
    need -= rem;
    dist += rem;
  }
  const total = out[out.length - 1]!.d || 1;
  for (let i = 0; i < out.length; i++) {
    const s = out[i]!;
    const q = out[Math.min(out.length - 1, i + 1)]!;
    const r = out[Math.max(0, i - 1)]!;
    s.a = Math.atan2(q.y - r.y, q.x - r.x);
    s.t = s.d / total;
  }
  return out;
}

/** Fade pressure in and out. Fractions of stroke length. */
export function taper(samples: Sample[], inFrac: number, outFrac: number): Sample[] {
  for (const s of samples) {
    const a = inFrac > 0 ? smooth(s.t / inFrac) : 1;
    const b = outFrac > 0 ? smooth((1 - s.t) / outFrac) : 1;
    s.p *= a * b;
  }
  return samples;
}

/** Outline polygon of a pressure-shaped stroke. */
export function ribbon(path: Sample[], size: number, thinning: number): number[][] {
  return getStroke(
    path.map((s) => [s.x, s.y, s.p]),
    { size, thinning, smoothing: 0.5, streamline: 0, simulatePressure: false, last: true },
  );
}

/** Trace a closed smooth path through polygon points. Caller fills or clips. */
export function tracePoly(ctx: PathCtx, poly: number[][]) {
  ctx.beginPath();
  if (poly.length < 3) return;
  const mid = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  const m0 = mid(poly[poly.length - 1]!, poly[0]!);
  ctx.moveTo(m0[0]!, m0[1]!);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const m = mid(a, poly[(i + 1) % poly.length]!);
    ctx.quadraticCurveTo(a[0]!, a[1]!, m[0]!, m[1]!);
  }
  ctx.closePath();
}


/** A closed smooth outline through the control points, as a polygon. For bodies, petals, puddles. */
export function loop(pts: Pt[], per = 12): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b, c, d] = [pts[(i - 1 + n) % n]!, pts[i]!, pts[(i + 1) % n]!, pts[(i + 2) % n]!];
    for (let k = 0; k < per; k++) out.push([cr(a[0], b[0], c[0], d[0], k / per), cr(a[1], b[1], c[1], d[1], k / per)]);
  }
  return out;
}

/** Whether a point lies inside a polygon. For scattering marks within a shape. */
export function inPoly(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
