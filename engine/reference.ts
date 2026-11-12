// Reference image: something to look at while painting. It gives color, tone, and the direction forms run in,
// so strokes can follow what is there instead of coordinates worked out by hand.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { boxBlur } from "./core/field.ts";
import { facet, type Pt } from "./core/path.ts";
import type { Rng } from "./core/rng.ts";
import { media, type WetLayer } from "./layers/wet.ts";
import type { Painting } from "./painting.ts";

export class Reference {
  private constructor(
    private w: number,
    private h: number,
    private k: number, // reference pixels per logical unit
    private px: Uint8ClampedArray,
    private ori: Float32Array,
    private coh: Float32Array,
    private edge: Float32Array,
  ) {}

  /** Load an image and stretch it over a sheet of the given logical size. */
  static async load(file: string, width: number, height: number, maxRes = 1100): Promise<Reference> {
    const img = await loadImage(file);
    const k = Math.min(1, maxRes / Math.max(width, height));
    const w = Math.round(width * k);
    const h = Math.round(height * k);
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    let lum: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!) / 255;
    lum = boxBlur(boxBlur(lum, w, h, 2), w, h, 2);
    let gx: Float32Array = new Float32Array(w * h);
    let gy: Float32Array = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        gx[i] = lum[i + 1]! - lum[i - 1]!;
        gy[i] = lum[i + w]! - lum[i - w]!;
      }
    }
    const edge = new Float32Array(w * h);
    // Structure tensor. Squaring the gradient before smoothing keeps the orientation of a thin line,
    // whose two sides have opposite gradients that would cancel if averaged directly.
    let jxx: Float32Array = new Float32Array(w * h);
    let jyy: Float32Array = new Float32Array(w * h);
    let jxy: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      edge[i] = Math.hypot(gx[i]!, gy[i]!);
      jxx[i] = gx[i]! * gx[i]!;
      jyy[i] = gy[i]! * gy[i]!;
      jxy[i] = gx[i]! * gy[i]!;
    }
    jxx = boxBlur(boxBlur(jxx, w, h, 4), w, h, 4);
    jyy = boxBlur(boxBlur(jyy, w, h, 4), w, h, 4);
    jxy = boxBlur(boxBlur(jxy, w, h, 4), w, h, 4);
    const ori = new Float32Array(w * h);
    const coh = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const d = jxx[i]! - jyy[i]!;
      ori[i] = 0.5 * Math.atan2(2 * jxy[i]!, d) + Math.PI / 2;
      coh[i] = Math.sqrt(d * d + 4 * jxy[i]! * jxy[i]!) / (jxx[i]! + jyy[i]! + 1e-9);
    }
    return new Reference(w, h, k, px, ori, coh, boxBlur(edge, w, h, 3));
  }

  private at(x: number, y: number) {
    const xi = Math.min(this.w - 1, Math.max(0, Math.round(x * this.k)));
    const yi = Math.min(this.h - 1, Math.max(0, Math.round(y * this.k)));
    return yi * this.w + xi;
  }

  /** Color at a logical position, as a hex string. */
  color(x: number, y: number): string {
    const i = this.at(x, y) * 4;
    return `#${[0, 1, 2].map((c) => this.px[i + c]!.toString(16).padStart(2, "0")).join("")}`;
  }

  /** Lightness 0..1. */
  lum(x: number, y: number): number {
    const i = this.at(x, y) * 4;
    return (0.2126 * this.px[i]! + 0.7152 * this.px[i + 1]! + 0.0722 * this.px[i + 2]!) / 255;
  }

  /** Direction that runs along the form here, in radians. Strokes laid this way wrap edges instead of crossing them. */
  along(x: number, y: number): number {
    return this.ori[this.at(x, y)]!;
  }

  /** How strongly the forms here agree on one direction, 0..1. High along edges and thin lines, low in flat or noisy areas. */
  coherence(x: number, y: number): number {
    return this.coh[this.at(x, y)]!;
  }

  /** How much is going on here, 0..1. Small strokes belong where this is high. */
  detail(x: number, y: number): number {
    return Math.min(1, this.edge[this.at(x, y)]! * 14);
  }

  private directed(x: number, y: number) {
    return this.detail(x, y) > 0.04 && this.coherence(x, y) > 0.3;
  }

  /** A stroke path starting at x, y that follows the form for `length`. Stops when it would cross an edge into a different tone. */
  trace(x: number, y: number, length: number, rng: Rng, fallback = 0): Pt[] {
    const step = Math.max(3, length / 6);
    const pts: Pt[] = [[x, y, 0.7]];
    const start = this.lum(x, y);
    let a = this.directed(x, y) ? this.along(x, y) : fallback + rng.gauss(0, 0.35);
    if (rng.chance(0.5)) a += Math.PI;
    for (let s = step; s <= length; s += step) {
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      if (Math.abs(this.lum(x, y) - start) > 0.12) break;
      pts.push([x, y, 1]);
      if (this.directed(x, y)) {
        // Keep heading the same general way. The field has no sign, so pick the closer of the two directions.
        let n = this.along(x, y);
        if (Math.cos(n - a) < 0) n += Math.PI;
        a = n;
      }
    }
    if (pts.length < 2) pts.push([x + Math.cos(a) * step * 0.5, y + Math.sin(a) * step * 0.5, 0.8]);
    return pts;
  }

  /**
   * The image as flat patches: each run of one color is one polygon with a faceted outline, largest first.
   * Fill them in order with `layer.shape` and every boundary is a single hard line, which strokes laid side by side cannot give.
   * `colors` is the palette size, `min` the smallest patch kept (logical area), `facet` how far an edge may leave the true outline (logical units).
   * `inside` limits the work to part of the sheet, for cutting a figure from its backdrop.
   */
  planes(o: { rng: Rng; colors?: number; min?: number; facet?: number; inside?: (x: number, y: number) => boolean }): { poly: Pt[]; color: string; area: number }[] {
    const [w, h, px] = [this.w, this.h, this.px];
    const n = w * h;
    const inside = new Uint8Array(n);
    for (let i = 0; i < n; i++) inside[i] = !o.inside || o.inside(((i % w) + 0.5) / this.k, (Math.floor(i / w) + 0.5) / this.k) ? 1 : 0;
    const [min, tol] = [(o.min ?? 60) * this.k * this.k, (o.facet ?? 4) * this.k];
    // 1. Palette by k-means over the marked pixels.
    const idx: number[] = [];
    for (let i = 0; i < n; i += 3) if (inside[i]) idx.push(i);
    const colors = o.colors ?? 16;
    const cen = Array.from({ length: colors }, () => {
      const i = idx[Math.floor(o.rng.float(0, idx.length))]!;
      return [px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!];
    });
    const nearest = (i: number) => {
      let [best, bd] = [0, Infinity];
      for (let k = 0; k < cen.length; k++) {
        const c = cen[k]!;
        const d = (px[i * 4]! - c[0]!) ** 2 + (px[i * 4 + 1]! - c[1]!) ** 2 + (px[i * 4 + 2]! - c[2]!) ** 2;
        if (d < bd) [best, bd] = [k, d];
      }
      return best;
    };
    for (let it = 0; it < 10; it++) {
      const sum = cen.map(() => [0, 0, 0, 0]);
      for (const i of idx) {
        const s = sum[nearest(i)]!;
        s[0]! += px[i * 4]!;
        s[1]! += px[i * 4 + 1]!;
        s[2]! += px[i * 4 + 2]!;
        s[3]!++;
      }
      sum.forEach((s, k) => s[3] && (cen[k] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!]));
    }
    // 2. Label map, then a 3x3 majority vote twice to drop speckle. 255 is outside.
    let lab = new Uint8Array(n).fill(255);
    for (let i = 0; i < n; i++) if (inside[i]) lab[i] = nearest(i);
    for (let it = 0; it < 2; it++) {
      const out = lab.slice();
      const cnt = new Uint16Array(256);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (lab[i] === 255) continue;
          cnt.fill(0);
          let [best, bc] = [lab[i]!, 0];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const l = lab[i + dy * w + dx]!;
            if (l === 255) continue;
            if (++cnt[l]! > bc) [best, bc] = [l, cnt[l]!];
          }
          if (bc >= 5) out[i] = best;
        }
      }
      lab = out;
    }
    // 3. Connected patches. Patches under `min` take the label of their most common neighbour, then patches are found again.
    const comp = new Int32Array(n);
    let sizes: number[] = [];
    const find = () => {
      comp.fill(-1);
      sizes = [];
      const stack: number[] = [];
      for (let s = 0; s < n; s++) {
        if (lab[s] === 255 || comp[s] !== -1) continue;
        const id = sizes.length;
        let a = 0;
        stack.push(s);
        comp[s] = id;
        while (stack.length) {
          const i = stack.pop()!;
          a++;
          const x = i % w;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
            if (j < 0 || j >= n || comp[j] !== -1 || lab[j] !== lab[s]) continue;
            comp[j] = id;
            stack.push(j);
          }
        }
        sizes.push(a);
      }
    };
    for (let it = 0; it < 3; it++) {
      find();
      const votes = new Map<number, Map<number, number>>();
      for (let i = 0; i < n; i++) {
        const c = comp[i]!;
        if (c < 0 || sizes[c]! >= min) continue;
        const x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (j < 0 || j >= n || lab[j] === 255 || comp[j] === c) continue;
          const v = votes.get(c) ?? votes.set(c, new Map()).get(c)!;
          v.set(lab[j]!, (v.get(lab[j]!) ?? 0) + 1);
        }
      }
      if (!votes.size) break;
      const to = new Map<number, number>();
      for (const [c, v] of votes) to.set(c, [...v].sort((a, b) => b[1] - a[1])[0]![0]);
      for (let i = 0; i < n; i++) {
        const t = to.get(comp[i]!);
        if (t !== undefined) lab[i] = t;
      }
    }
    find();
    // 4. Outline of each patch, walked along pixel edges with the patch on the right, then cut down to facets.
    const first = new Int32Array(sizes.length).fill(-1);
    const sum = sizes.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const c = comp[i]!;
      if (c < 0) continue;
      if (first[c] === -1) first[c] = i;
      const s = sum[c]!;
      s[0]! += px[i * 4]!;
      s[1]! += px[i * 4 + 1]!;
      s[2]! += px[i * 4 + 2]!;
    }
    const out: { poly: Pt[]; color: string; area: number }[] = [];
    for (let c = 0; c < sizes.length; c++) {
      if (sizes[c]! < min) continue;
      const isIn = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && comp[y * w + x] === c;
      const [sx, sy] = [first[c]! % w, Math.floor(first[c]! / w)];
      let [vx, vy, dx, dy] = [sx, sy, 1, 0];
      const ring: Pt[] = [];
      do {
        ring.push([vx, vy]);
        vx += dx;
        vy += dy;
        const [rx, ry] = [-dy, dx];
        const right = isIn(vx + (dx + rx - 1) / 2, vy + (dy + ry - 1) / 2);
        const left = isIn(vx + (dx - rx - 1) / 2, vy + (dy - ry - 1) / 2);
        if (!right) [dx, dy] = [rx, ry];
        else if (left) [dx, dy] = [-rx, -ry];
      } while (vx !== sx || vy !== sy || dx !== 1 || dy !== 0);
      const poly = facet(ring, tol).map(([x, y]) => [x! / this.k, y! / this.k] as Pt);
      if (poly.length < 3) continue;
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const [a, b] = [poly[i]!, poly[(i + 1) % poly.length]!];
        area += a[0]! * b[1]! - b[0]! * a[1]!;
      }
      const s = sum[c]!;
      out.push({ poly, area: Math.abs(area) / 2, color: `#${s.map((v) => Math.round(v / sizes[c]!).toString(16).padStart(2, "0")).join("")}` });
    }
    return out.sort((a, b) => b.area - a.area);
  }
}

/** One pass of paintFrom: brush size, attempts, stroke length in sizes, how far the color may drift along a stroke (0..255), least error worth a stroke (0..255), pickup. */
export type StudyPass = [size: number, attempts: number, length: number, drift: number, floor: number, pickup: number];

type RGB = [number, number, number];
const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Paint a reference onto a wet layer by looking. Before each pass the sheet is compared with the reference,
 * and the brush goes only where the two still differ, most often where they differ most.
 * Each stroke follows the form in the reference both ways from where it lands and ends where the color drifts.
 * Passes run from a broad flat brush to a fine point. Sizes under 10 use a round point, for line.
 */
export function paintFrom(p: Painting, L: WetLayer, ref: Reference, passes: StudyPass[], o: { rng?: Rng; skip?: (x: number, y: number, size: number) => boolean } = {}) {
  const [W, H] = [p.width, p.height];
  const r = o.rng ?? p.rng.fork("paintFrom");
  const col = (x: number, y: number) => hexRgb(ref.color(x, y));
  // The sheet as it stands, sampled on a grid of G logical units, as distance from the reference.
  const G = 4;
  const gw = Math.ceil(W / G);
  const gh = Math.ceil(H / G);
  const look = () => {
    const d = L.canvas.getContext("2d").getImageData(0, 0, p.pxW, p.pxH).data;
    const e = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const [x, y] = [(gx + 0.5) * G, (gy + 0.5) * G];
        const i = (Math.min(p.pxH - 1, Math.floor(y * p.scale)) * p.pxW + Math.min(p.pxW - 1, Math.floor(x * p.scale))) * 4;
        e[gy * gw + gx] = dist([d[i]!, d[i + 1]!, d[i + 2]!], col(x, y));
      }
    }
    return e;
  };
  const follow = (x: number, y: number, length: number, size: number, tol: number): Pt[] => {
    const c0 = col(x, y);
    const step = Math.max(2, size * 0.5);
    const directed = (qx: number, qy: number) => ref.detail(qx, qy) > 0.03 && ref.coherence(qx, qy) > 0.25;
    const a0 = directed(x, y) ? ref.along(x, y) : -0.95 + r.gauss(0, 0.5);
    const arm = (a: number): Pt[] => {
      const out: Pt[] = [];
      let [qx, qy] = [x, y];
      for (let s = step; s <= length / 2; s += step) {
        qx += Math.cos(a) * step;
        qy += Math.sin(a) * step;
        if (qx < -size || qy < -size || qx > W + size || qy > H + size) break;
        if (dist(col(qx, qy), c0) > tol) break;
        out.push([qx, qy, 1]);
        if (directed(qx, qy)) {
          let n = ref.along(qx, qy);
          if (Math.cos(n - a) < 0) n += Math.PI;
          a = n;
        }
      }
      return out;
    };
    const back = arm(a0 + Math.PI).reverse();
    const fwd = arm(a0);
    const pts: Pt[] = [...back, [x, y, 1], ...fwd];
    if (pts.length < 2) pts.push([x + Math.cos(a0) * step, y + Math.sin(a0) * step, 1]);
    // A lifted end, so marks do not stop like cut tape.
    pts[0]![2] = 0.6;
    pts[pts.length - 1]![2] = 0.6;
    return pts;
  };
  for (const [size, attempts, len, tol, floor, pickup] of passes) {
    L.dry();
    const e = look();
    const fine = size < 10;
    const tip = fine ? { load: 0.85, pickup: 0, bristle: 0.08, hardness: 0.75, thin: 0.5, fade: 0.3 } : { ...media.gouache, bristle: 0.25, pickup, thin: 0.35, fade: 0.2 };
    for (let i = 0; i < attempts; i++) {
      const x = r.float(0, W);
      const y = r.float(0, H);
      const err = e[Math.min(gh - 1, Math.floor(y / G)) * gw + Math.min(gw - 1, Math.floor(x / G))]!;
      if (err < floor || err < r.float(0, 40)) continue;
      if (o.skip?.(x, y, size)) continue;
      // A broad brush is loaded with the average of what lies under it, not with one pixel of the reference.
      let color = ref.color(x, y);
      if (!fine) {
        const q = size / 4;
        const cs = [col(x, y), col(x - q, y), col(x + q, y), col(x, y - q), col(x, y + q)];
        color = `#${[0, 1, 2].map((c) => Math.round(cs.reduce((t, v) => t + v[c]!, 0) / 5).toString(16).padStart(2, "0")).join("")}`;
      }
      L.stroke(follow(x, y, size * len, size, tol), { ...tip, color, size });
    }
  }
}
