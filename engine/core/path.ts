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

/** An ellipse as a polygon, optionally turned by `rot` radians. With one radius it is a circle. */
export function oval(cx: number, cy: number, rx: number, ry = rx, rot = 0, n = 64): Pt[] {
  const [c, s] = [Math.cos(rot), Math.sin(rot)];
  return Array.from({ length: n }, (_, i): Pt => {
    const [x, y] = [rx * Math.cos((i / n) * Math.PI * 2), ry * Math.sin((i / n) * Math.PI * 2)];
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}

/** A rectangle from corner to corner as a polygon. `r` rounds the corners. */
export function rect(x0: number, y0: number, x1: number, y1: number, r = 0): Pt[] {
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  r = Math.min(r, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
  const out: Pt[] = [];
  const corners: [number, number, number][] = [[x1 - r, y0 + r, -0.5], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 0.5], [x0 + r, y0 + r, 1]];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 8; k++) out.push([cx + r * Math.cos((a0 + k / 16) * Math.PI), cy + r * Math.sin((a0 + k / 16) * Math.PI)]);
  return out;
}

/** Where a group of points sits: moved to x, y, scaled by s (about the local origin), turned by rot radians, mirrored left to right by flip. */
export interface Placement {
  x?: number;
  y?: number;
  s?: number;
  rot?: number;
  flip?: boolean;
}

/**
 * Draw a part in its own coordinates and put it on the sheet with one transform. Pressure is kept.
 * Fix a proportion or move a whole figure by changing the placement, not every point. Placements nest: place(a)(place(b)(pts)).
 */
export function place(at: Placement): (pts: Pt[]) => Pt[] {
  const k = at.s ?? 1;
  const [c, s] = [Math.cos(at.rot ?? 0) * k, Math.sin(at.rot ?? 0) * k];
  const f = at.flip ? -1 : 1;
  return (pts) =>
    pts.map(([x, y, pr]): Pt => {
      const q: Pt = [(at.x ?? 0) + f * x * c - y * s, (at.y ?? 0) + f * x * s + y * c];
      if (pr !== undefined) q.push(pr);
      return q;
    });
}

/** The convex outline around a set of points, counter-clockwise on the sheet. */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src: Pt[]) => {
    const h: Pt[] = [];
    for (const q of src) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half(p.reverse())];
}

/** Douglas-Peucker on a closed ring: keep only the corners that stand more than `tol` off the line between kept corners. */
export function facet(ring: Pt[], tol: number): Pt[] {
  let far = 0;
  for (let i = 1; i < ring.length; i++) if (Math.hypot(ring[i]![0]! - ring[0]![0]!, ring[i]![1]! - ring[0]![1]!) > Math.hypot(ring[far]![0]! - ring[0]![0]!, ring[far]![1]! - ring[0]![1]!)) far = i;
  const keep = new Uint8Array(ring.length + 1);
  const at = (i: number) => ring[i % ring.length]!;
  const stack: [number, number][] = [[0, far], [far, ring.length]];
  keep[0] = keep[far] = 1;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay, bx, by] = [at(a)[0]!, at(a)[1]!, at(b)[0]!, at(b)[1]!];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let [m, md] = [-1, tol];
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((at(i)[0]! - ax) * (by - ay) - (at(i)[1]! - ay) * (bx - ax)) / len;
      if (d > md) [m, md] = [i, d];
    }
    if (m < 0) continue;
    keep[m] = 1;
    stack.push([a, m], [m, b]);
  }
  return ring.filter((_, i) => keep[i]);
}

/** A placement as one transform: what it does to points, to sizes and to directions. Layers use it for `at`. */
export interface Xf {
  /** x' = a x + c y + e, y' = b x + d y + f. */
  m: [a: number, b: number, c: number, d: number, e: number, f: number];
  pts(pts: Pt[]): Pt[];
  /** How much lengths grow. */
  k: number;
  /** A direction in radians, carried through the turn and the mirror. */
  angle(a: number): number;
}

/** The transform of a placement. Given `outer`, the placement happens inside it, as nested groups do. */
export function affine(at: Placement, outer?: Xf): Xf {
  const k = at.s ?? 1;
  const [c, s, f] = [Math.cos(at.rot ?? 0) * k, Math.sin(at.rot ?? 0) * k, at.flip ? -1 : 1];
  let m: Xf["m"] = [f * c, f * s, -s, c, at.x ?? 0, at.y ?? 0];
  if (outer) {
    const [A, B, C, D, E, F] = outer.m;
    m = [A * m[0] + C * m[1], B * m[0] + D * m[1], A * m[2] + C * m[3], B * m[2] + D * m[3], A * m[4] + C * m[5] + E, B * m[4] + D * m[5] + F];
  }
  return {
    m,
    k: Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])),
    pts: (pts) =>
      pts.map(([x, y, pr]): Pt => {
        const q: Pt = [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
        if (pr !== undefined) q.push(pr);
        return q;
      }),
    angle: (a) => Math.atan2(m[1] * Math.cos(a) + m[3] * Math.sin(a), m[0] * Math.cos(a) + m[2] * Math.sin(a)),
  };
}

/** An area carried through a transform. Polygons move. A mask is already in sheet coordinates and stays. */
export function moved<T>(area: T, xf?: Xf): T {
  if (!xf || !Array.isArray(area)) return area;
  return (typeof area[0]?.[0] === "number" ? xf.pts(area as Pt[]) : (area as Pt[][]).map((q) => xf.pts(q))) as T;
}
