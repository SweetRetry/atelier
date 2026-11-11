// Wet layer: paint that knows what is already on the canvas.
// Each pixel holds two films in float arrays outside Skia: a dry one underneath and a wet one on top.
// Only the wet film can be picked up, so a stroke over dry paint covers it cleanly and a stroke over wet paint mixes.
// Wet paint dries with time (counted in strokes) and is then merged into the dry film.
// The brush carries a row of bristle reservoirs. Each dab picks up wet paint under it and lays down what it carries,
// so strokes drag, blend and streak. Over dry paint a loaded stroke simply covers, which gives occlusion for free.
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { type Color, rgb, shift } from "../core/color.ts";
import { boxBlur } from "../core/field.ts";
import type { Painting } from "../painting.ts";
import { type Pt, spline, taper } from "../core/path.ts";
import { ksDec, ksEnc, linToByte, toLin } from "../core/pigment.ts";

export interface WetOpts {
  /** "pigment" mixes like paint (Kubelka-Munk). "light" mixes linear RGB. */
  mixing?: "pigment" | "light";
  /** Strokes until fresh paint is dry. Infinity keeps it workable forever, as graphite and charcoal are until fixed. */
  life?: number;
  /** Strength of the relief shading from paint thickness, 0 is flat. */
  impasto?: number;
}

export interface WetStroke {
  color?: Color;
  /** Diameter in logical units. */
  size: number;
  /** Paint on the brush, 0..1. 0 is a clean brush that only moves what is there. */
  load?: number;
  /** How readily the brush takes up wet paint, 0..1. */
  pickup?: number;
  /** 0 is a soft edge, 1 is hard. */
  hardness?: number;
  /** Depth of bristle streaks, 0 is a smooth knife, 1 is a coarse brush. */
  bristle?: number;
  /** Number of bristle clumps across the brush. */
  bristles?: number;
  /** Distance the load lasts, in units of size. Infinity never runs dry. */
  reach?: number;
  /** How much the paper tooth resists the mark, 0..1. 0 is fluid paint. High values skip over the valleys, as pencil and charcoal do. */
  tooth?: number;
  taper?: [number, number];
  /** Shape of the brush. "round" is a disc. "flat" is a chisel edge held across the stroke, so marks have straight sides and square ends. */
  tip?: "round" | "flat";
  /** Thickness of a flat tip along the stroke, as a fraction of size. */
  aspect?: number;
  /** How much pressure narrows the mark, 0..1. At 1 the mark closes to a point where pressure reaches 0. */
  thin?: number;
  /** How much pressure lightens the mark, 0..1. At 0 a narrowing mark stays fully loaded to its point. */
  fade?: number;
}

export interface BlockOpts extends WetStroke {
  /** Direction the brush travels, radians. */
  angle?: number;
  /** Lightness drift from stroke to stroke, in OKLCH lightness. Hue drifts with it. */
  vary?: number;
  /** Softness of the shape's edge, in logical units. 0 is cut with a knife. */
  feather?: number;
}

/** Starting points for common media. Spread one into a stroke and override what you need. */
export const media = {
  oil: { load: 0.8, pickup: 0.6, bristle: 0.6, hardness: 0.8 },
  knife: { load: 0.95, pickup: 0.3, bristle: 0.05, hardness: 0.95 },
  gouache: { load: 0.93, pickup: 0.25, bristle: 0.22, hardness: 0.9, tip: "flat", aspect: 0.3 },
  pencil: { load: 0.4, pickup: 0, bristle: 0, hardness: 0.7, tooth: 0.8 },
  charcoal: { load: 0.65, pickup: 0.15, bristle: 0.35, hardness: 0.45, tooth: 0.95 },
  pastel: { load: 0.9, pickup: 0.1, bristle: 0.2, hardness: 0.6, tooth: 0.65 },
} satisfies Record<string, Partial<WetStroke>>;

const BINS = 24;
const FINE = 256;

export class WetLayer {
  blend = "source-over";
  opacity = 1;
  private w: number;
  private h: number;
  private dk: Float32Array; // dry film color
  private dc: Float32Array; // dry film coverage
  private wk: Float32Array; // wet film color
  private wc: Float32Array; // wet film coverage
  private stamp: Float32Array; // stroke index when the wet film was last touched
  private thick: Float32Array;
  private now = 0;
  private cache?: Canvas;
  private pigment: boolean;
  private life: number;
  private impasto: number;
  private maskA?: Float32Array;

  constructor(readonly name: string, private p: Painting, o: WetOpts = {}) {
    this.w = p.pxW;
    this.h = p.pxH;
    const n = this.w * this.h;
    this.dk = new Float32Array(n * 3);
    this.dc = new Float32Array(n);
    this.wk = new Float32Array(n * 3);
    this.wc = new Float32Array(n);
    this.stamp = new Float32Array(n);
    this.thick = new Float32Array(n);
    this.pigment = (o.mixing ?? "pigment") === "pigment";
    this.life = o.life ?? 60;
    this.impasto = o.impasto ?? 0.3;
  }

  private enc(c: Color): [number, number, number] {
    const [r, g, b] = rgb(c).map((v) => toLin(v / 255)) as [number, number, number];
    return this.pigment ? [ksEnc(r), ksEnc(g), ksEnc(b)] : [r, g, b];
  }

  /** Cover the whole layer with dry paint. A ground to work on. */
  fill(color: Color): this {
    const [a, b, c] = this.enc(color);
    for (let i = 0; i < this.dc.length; i++) {
      this.dk[i * 3] = a;
      this.dk[i * 3 + 1] = b;
      this.dk[i * 3 + 2] = c;
    }
    this.dc.fill(1);
    this.wc.fill(0);
    this.thick.fill(0);
    this.cache = undefined;
    return this;
  }

  /** One film seen over another. Coverage is area, so the eye averages reflected light. This is not pigment mixing. */
  private over(under: number, top: number, t: number) {
    if (!this.pigment) return under + (top - under) * t;
    const r = ksDec(under);
    return ksEnc(r + (ksDec(top) - r) * t);
  }

  /** Sink the wet film of one pixel into the dry film. */
  private settle(i: number) {
    const a = this.wc[i]!;
    const b = this.dc[i]!;
    const an = a + b * (1 - a);
    const i3 = i * 3;
    if (b <= 0) {
      this.dk[i3] = this.wk[i3]!;
      this.dk[i3 + 1] = this.wk[i3 + 1]!;
      this.dk[i3 + 2] = this.wk[i3 + 2]!;
    } else {
      const t = a / an;
      this.dk[i3] = this.over(this.dk[i3]!, this.wk[i3]!, t);
      this.dk[i3 + 1] = this.over(this.dk[i3 + 1]!, this.wk[i3 + 1]!, t);
      this.dk[i3 + 2] = this.over(this.dk[i3 + 2]!, this.wk[i3 + 2]!, t);
    }
    this.dc[i] = an;
    this.wc[i] = 0;
  }

  /** Let everything dry. Later strokes cover instead of mixing. */
  dry(): this {
    for (let i = 0; i < this.wc.length; i++) if (this.wc[i]! > 0) this.settle(i);
    return this;
  }

  /** Run fn with every stroke confined to a polygon, as with masking film. Nested clips intersect. Feather softens the edge, in logical units. */
  clip(poly: Pt[], fn: () => void, feather = 0): this {
    const c = createCanvas(this.w, this.h);
    const g = c.getContext("2d");
    g.scale(this.p.scale, this.p.scale);
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    const d = g.getImageData(0, 0, this.w, this.h).data;
    let m: Float32Array = new Float32Array(this.w * this.h);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]! / 255;
    const R = Math.round((feather * this.p.scale) / 2);
    if (R >= 1) m = boxBlur(boxBlur(m, this.w, this.h, R), this.w, this.h, R);
    const prev = this.maskA;
    if (prev) for (let i = 0; i < m.length; i++) m[i] = m[i]! * prev[i]!;
    this.maskA = m;
    fn();
    this.maskA = prev;
    return this;
  }

  /** Lay a shape in with the brush: parallel strokes of uneven length across the polygon, cut to its edge. The inside keeps the marks, the outline stays clean. */
  block(poly: Pt[], o: BlockOpts): this {
    const rng = this.p.rng.fork(`${this.name}/block${this.now}`);
    const xs = poly.map((q) => q[0]);
    const ys = poly.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rad = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + o.size;
    const a = o.angle ?? 0;
    const [tx, ty, nx, ny] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
    const inside = (x: number, y: number) => x > Math.min(...xs) - o.size && x < Math.max(...xs) + o.size && y > Math.min(...ys) - o.size && y < Math.max(...ys) + o.size;
    const { angle: _a, vary, feather, ...stroke } = o;
    return this.clip(
      poly,
      () => {
        for (let v = -rad; v <= rad; v += o.size * 0.55) {
          let u = -rad - rng.float(0, o.size * 2);
          while (u < rad) {
            const len = o.size * rng.float(1.6, 4.5);
            const bow = rng.gauss(0, o.size * 0.12);
            const pt = (t: number, off: number): Pt => [cx + tx * (u + len * t) + nx * (v + off), cy + ty * (u + len * t) + ny * (v + off)];
            const pts = [pt(0, 0), pt(0.5, bow), pt(1, 0)];
            if (pts.some(([x, y]) => inside(x, y))) {
              const color = vary && o.color ? shift(o.color, { l: rng.gauss(0, vary), h: rng.gauss(0, vary * 80) }) : o.color;
              this.stroke(pts, { ...stroke, color });
            }
            u += len * rng.float(0.55, 0.9);
          }
        }
      },
      feather ?? 0,
    );
  }

  /** A clean brush dragged through the paint. */
  smudge(pts: Pt[], o: { size: number; strength?: number; hardness?: number; bristle?: number; taper?: [number, number] }): this {
    return this.stroke(pts, { ...o, load: 0, pickup: o.strength ?? 0.8 });
  }

  stroke(pts: Pt[], o: WetStroke): this {
    const s = this.p.scale;
    const load = Math.min(0.98, o.load ?? 0.8);
    const pickup = o.pickup ?? 0.5;
    const hard = Math.min(0.95, o.hardness ?? 0.8);
    const bristle = o.bristle ?? 0.6;
    const spacingFrac = 0.07;
    const path = spline(pts, Math.max(0.5 / s, o.size * spacingFrac));
    if (o.taper) taper(path, o.taper[0], o.taper[1]);
    const rng = this.p.rng.fork(`${this.name}/${this.now}`);
    const seed = rng.float(0, 1000);
    const nb = o.bristles ?? 18;

    // Fine bristle profile across the brush, constant along the stroke so it leaves streaks.
    // Two profiles are crossfaded as the stroke travels, so the streaks drift instead of ruling parallel lines.
    const profile = (k: number) => {
      const a = new Float32Array(FINE);
      for (let j = 0; j < FINE; j++) a[j] = Math.min(1, Math.max(0, 0.6 + 0.7 * this.p.noise.fbm((j / FINE) * nb, seed + k * 31, 3)));
      return a;
    };
    const fineA = profile(0);
    const fineB = profile(1);
    const fine = new Float32Array(FINE);
    // Reservoirs: color and remaining amount per bristle clump.
    const col = this.enc(o.color ?? "#000");
    const res = new Float32Array(BINS * 3);
    const amount = new Float32Array(BINS);
    const has = new Uint8Array(BINS);
    for (let b = 0; b < BINS; b++) {
      res.set(col, b * 3);
      amount[b] = load > 0 ? rng.float(0.75, 1) : 0;
      has[b] = load > 0 ? 1 : 0;
    }
    const flat = o.tip === "flat";
    const aspect = o.aspect ?? 0.3;
    const thin = o.thin ?? 0.55;
    const fade = o.fade ?? 1;
    // A flat tip passes over each point in fewer dabs than a disc does, so each dab lays down more.
    const flow = 1 - (1 - load) ** (flat ? (spacingFrac * 3) / aspect : spacingFrac * 3);
    const mask = this.maskA;
    const deplete = o.reach && Number.isFinite(o.reach) ? spacingFrac / o.reach : 0;
    const acc = new Float64Array(BINS * 4);
    const macc = new Float64Array(BINS);
    const taken = new Float64Array(BINS);
    const laid = new Float64Array(BINS);
    const clean = load === 0;
    // A clean brush still lays down whatever it has picked up.
    const flowDep = Math.max(flow, pickup * 0.3);
    const { w, h, wk, wc, stamp, thick } = this;
    const now = this.now;
    const invLife = 1 / this.life;
    const tooth = o.tooth ?? 0;
    const paper = tooth ? this.p.tooth : undefined;

    for (const sm of path) {
      const R = (o.size / 2) * s * (1 - thin + thin * sm.p);
      if (R < 0.4) continue;
      const cx = sm.x * s;
      const cy = sm.y * s;
      const nx = -Math.sin(sm.a) / R;
      const ny = Math.cos(sm.a) / R;
      const R2 = R * R;
      // Half thickness of a flat tip along the direction of travel. Never thinner than a pixel, and never thinner than
      // the step between dabs, or a mark that narrows to a point breaks into separate bars.
      const T = Math.max(1, R * aspect, o.size * spacingFrac * s);
      const tx = Math.cos(sm.a) / T;
      const ty = Math.sin(sm.a) / T;
      const E = flat ? Math.hypot(R, T) : R;
      const x0 = Math.max(0, Math.floor(cx - E));
      const x1 = Math.min(w - 1, Math.ceil(cx + E));
      const y0 = Math.max(0, Math.floor(cy - E));
      const y1 = Math.min(h - 1, Math.ceil(cy + E));
      acc.fill(0);
      macc.fill(0);
      taken.fill(0);
      laid.fill(0);
      const mixAB = 0.5 + 0.5 * this.p.noise(sm.d / (o.size * 2.5), seed + 77);
      for (let j = 0; j < FINE; j++) fine[j] = fineA[j]! + (fineB[j]! - fineA[j]!) * mixAB;
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - cy;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const across = dx * nx + dy * ny;
          let rr: number;
          let along = 1;
          if (flat) {
            const va = dx * tx + dy * ty;
            rr = Math.abs(across);
            if (rr >= 1 || va >= 1 || va <= -1) continue;
            along = 1 - va * va;
          } else {
            const d2 = dx * dx + dy * dy;
            if (d2 >= R2) continue;
            rr = Math.sqrt(d2 / R2);
          }
          let fall = rr < hard ? 1 : 1 - (rr - hard) / (1 - hard);
          fall *= fall * along;
          const u = (across + 1) * 0.5;
          const bin = Math.min(BINS - 1, (u * BINS) | 0);
          const f = fine[Math.min(FINE - 1, (u * FINE) | 0)]!;
          const i = y * w + x;
          let m = fall * (1 - fade * (1 - sm.p)) * (1 - bristle * (1 - f));
          if (mask) m *= mask[i]!;
          if (m < 0.004) continue;
          const i3 = i * 3;
          const b3 = bin * 3;
          let a = wc[i]!;
          let we = 0;
          if (a > 0) {
            we = 1 - (now - stamp[i]!) * invLife;
            if (we <= 0) {
              this.settle(i);
              a = 0;
              we = 0;
            }
          }
          // What the brush takes up here. Only the wet film moves.
          const wg = m * a * we;
          if (wg > 0) {
            const a4 = bin * 4;
            acc[a4] = acc[a4]! + wk[i3]! * wg;
            acc[a4 + 1] = acc[a4 + 1]! + wk[i3 + 1]! * wg;
            acc[a4 + 2] = acc[a4 + 2]! + wk[i3 + 2]! * wg;
            acc[a4 + 3] = acc[a4 + 3]! + wg;
            // A clean brush moves paint: what it takes leaves the canvas. A loaded brush is fed from its own supply,
            // so it only gets tinted. Otherwise it would refill from its own trail and never run dry.
            if (clean) {
              const take = wg * pickup * 0.5 * (1 - amount[bin]!);
              a -= take;
              wc[i] = a;
              taken[bin] = taken[bin]! + take;
            }
          }
          macc[bin] = macc[bin]! + m;
          // What it lays down, into the wet film.
          if (!has[bin]) continue;
          let k = m * (flowDep * amount[bin]! + pickup * we * a * 0.35);
          if (paper) {
            // Light contact touches only the peaks of the paper. Pressure reaches into the valleys.
            const r = (paper[i]! + m * 1.2 - tooth) / 0.3;
            if (r <= 0) continue;
            if (r < 1) k *= r * r * (3 - 2 * r);
          }
          if (k <= 0) continue;
          if (k > 1) k = 1;
          const an = k + a * (1 - k);
          const t = k / an;
          wk[i3] = wk[i3]! + (res[b3]! - wk[i3]!) * t;
          wk[i3 + 1] = wk[i3 + 1]! + (res[b3 + 1]! - wk[i3 + 1]!) * t;
          wk[i3 + 2] = wk[i3 + 2]! + (res[b3 + 2]! - wk[i3 + 2]!) * t;
          wc[i] = an;
          laid[bin] = laid[bin]! + k;
          thick[i] = thick[i]! + (f - thick[i]!) * k;
          stamp[i] = now;
        }
      }
      for (let b = 0; b < BINS; b++) {
        const wsum = acc[b * 4 + 3]!;
        if (wsum > 0) {
          // A brush holding little paint is quickly taken over by what it picks up. A loaded one is only tinted.
          const got = pickup * 0.04 * Math.min(1, wsum / macc[b]!);
          const g = has[b] ? got / (0.12 + amount[b]! + got) : 1;
          for (let c = 0; c < 3; c++) res[b * 3 + c] = res[b * 3 + c]! + (acc[b * 4 + c]! / wsum - res[b * 3 + c]!) * g;
          has[b] = 1;
        }
        // A clean brush only has what it took, and runs out as it lays that down.
        if (clean && macc[b]! > 0) amount[b] = Math.min(1, Math.max(0, amount[b]! + (taken[b]! - laid[b]! * 0.6) / macc[b]!));
        if (deplete) amount[b] = Math.max(0, amount[b]! - deplete);
      }
    }
    this.now++;
    this.cache = undefined;
    return this;
  }

  /** Baked to a canvas for compositing. Rebuilt only after new strokes. */
  get canvas(): Canvas {
    if (this.cache) return this.cache;
    const { w, h, dk, dc, wk, wc, thick } = this;
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    const img = g.createImageData(w, h);
    const d = img.data;
    const relief = this.impasto * 0.9;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const aw = wc[i]!;
        const a = aw + dc[i]! * (1 - aw);
        if (a <= 0) continue;
        const t = aw / a;
        // Light from the upper left across the paint surface.
        let shade = 1;
        if (relief && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
          const up = thick[i - w - 1]!;
          const dn = thick[i + w + 1]!;
          shade = 1 + (dn - up) * relief;
        }
        const i3 = i * 3;
        const o = i * 4;
        // Decode each film to reflected light first, then average by coverage.
        for (let c = 0; c < 3; c++) {
          let v: number;
          if (aw <= 0) v = this.pigment ? ksDec(dk[i3 + c]!) : dk[i3 + c]!;
          else if (t >= 0.999) v = this.pigment ? ksDec(wk[i3 + c]!) : wk[i3 + c]!;
          else {
            const under = this.pigment ? ksDec(dk[i3 + c]!) : dk[i3 + c]!;
            const top = this.pigment ? ksDec(wk[i3 + c]!) : wk[i3 + c]!;
            v = under + (top - under) * t;
          }
          d[o + c] = linToByte(v * shade);
        }
        d[o + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.cache = c;
    return c;
  }
}
