// Watercolor layer: water and pigment simulated on a grid.
// Water spreads through wet paper and creeps slowly into dry paper. Pigment rides the water, settles into the paper,
// and can be lifted again. Edges dry first, so water flows outward and leaves dark rims. Fresh water pushed into a
// damp wash makes blooms. Pigment is stored as K/S, which is additive, so glazes darken like transparent paint.
// The grid is fixed in logical units, so a preview and a full render run the same simulation.
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { type Color, rgb } from "../core/color.ts";
import type { Painting } from "../painting.ts";
import { type Pt, spline, taper } from "../core/path.ts";
import { ksDec, ksEnc, linToByte, toLin } from "../core/pigment.ts";
import { makeNoise } from "../core/rng.ts";

export interface WaterOpts {
  /** Simulation cell in logical units. Smaller is finer and slower. */
  cell?: number;
  /** Simulation steps run after every stroke, so earlier strokes keep drying while you paint. */
  settle?: number;
  /** How much pigment collects in the valleys of the paper, 0..1. */
  granulation?: number;
  /** Drying speed. Higher gives harder edges and less flow. */
  evaporation?: number;
}

export interface WaterStroke {
  color?: Color;
  size: number;
  /** Water on the brush, 0..1. More water flows further. */
  water?: number;
  /** Pigment strength, 0..1. 0 is clean water. */
  pigment?: number;
  hardness?: number;
  /** Irregularity of the brush footprint, 0 is a clean capsule, 1 is very broken. */
  ragged?: number;
  taper?: [number, number];
}

const EPS = 0.004;

export class WaterLayer {
  blend = "multiply";
  opacity = 1;
  private gw: number;
  private gh: number;
  private cell: number;
  private W: Float32Array;
  private S: Float32Array[]; // suspended pigment, three channels
  private D: Float32Array[]; // deposited pigment
  private dW: Float32Array;
  private dS: Float32Array[];
  private absorb: Float32Array;
  private valley: Float32Array;
  private box = [Infinity, Infinity, -Infinity, -Infinity];
  private cache?: Canvas;
  private settle: number;
  private gran: number;
  private evap: number;
  private noise: ReturnType<typeof makeNoise>;

  constructor(readonly name: string, private p: Painting, o: WaterOpts = {}) {
    this.cell = o.cell ?? 3;
    this.gw = Math.ceil(p.width / this.cell);
    this.gh = Math.ceil(p.height / this.cell);
    const n = this.gw * this.gh;
    const f = () => new Float32Array(n);
    this.W = f();
    this.dW = f();
    this.S = [f(), f(), f()];
    this.D = [f(), f(), f()];
    this.dS = [f(), f(), f()];
    this.absorb = f();
    this.valley = f();
    this.settle = o.settle ?? 6;
    this.gran = o.granulation ?? 0.5;
    this.evap = o.evaporation ?? 1;
    const noise = makeNoise(p.rng.fork(`water/${name}`));
    this.noise = noise;
    for (let y = 0; y < this.gh; y++) {
      for (let x = 0; x < this.gw; x++) {
        // Uneven sizing of the paper: some patches drink water sooner than others. This is what makes edges irregular.
        this.absorb[y * this.gw + x] = 1.3 + 1.1 * noise.fbm(x / 9, y / 9, 3) + 0.5 * noise(x / 2.2, y / 2.2);
        this.valley[y * this.gw + x] = 0.5 - 0.5 * noise(x / 1.6 + 50, y / 1.6);
      }
    }
  }

  /** Clean water, to pre-wet paper or to push a bloom into a damp wash. */
  wetArea(pts: Pt[], o: { size: number; water?: number; hardness?: number }): this {
    return this.stroke(pts, { ...o, pigment: 0 });
  }

  stroke(pts: Pt[], o: WaterStroke): this {
    const water = o.water ?? 0.7;
    const pig = o.pigment ?? 0.6;
    const hard = Math.min(0.97, o.hardness ?? 0.9);
    const path = spline(pts, Math.max(this.cell * 0.5, o.size * 0.15));
    if (o.taper) taper(path, o.taper[0], o.taper[1]);
    const c = rgb(o.color ?? "#000").map((v) => ksEnc(toLin(v / 255)) * pig * 0.09);
    const { gw, gh, W, S, box } = this;
    const rag = (o.ragged ?? 0.5) * 0.34;
    for (const sm of path) {
      const R = Math.max(0.6, ((o.size / 2) * (0.5 + 0.5 * sm.p)) / this.cell);
      const cx = sm.x / this.cell;
      const cy = sm.y / this.cell;
      const x0 = Math.max(0, Math.floor(cx - R));
      const x1 = Math.min(gw - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R));
      const y1 = Math.min(gh - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          // The footprint wobbles with a fixed pattern in the paper, so successive dabs agree on one ragged outline.
          const rr = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (R * (1 + rag * (this.noise(x / 7, y / 7) + 0.5 * this.noise(x / 2.3 + 30, y / 2.3))));
          if (rr >= 1) continue;
          const fall = rr < hard ? 1 : 1 - (rr - hard) / (1 - hard);
          const i = y * gw + x;
          W[i] = Math.min(1.6, Math.max(W[i]!, water * fall) + water * fall * 0.06);
          const m = Math.min(1, fall * 3) * sm.p;
          S[0]![i] = S[0]![i]! + c[0]! * m;
          S[1]![i] = S[1]![i]! + c[1]! * m;
          S[2]![i] = S[2]![i]! + c[2]! * m;
        }
      }
      box[0] = Math.min(box[0]!, x0);
      box[1] = Math.min(box[1]!, y0);
      box[2] = Math.max(box[2]!, x1);
      box[3] = Math.max(box[3]!, y1);
    }
    this.flow(this.settle);
    return this;
  }

  /** Run the simulation. Call with a large number to let a passage spread before the next stroke. */
  flow(steps: number): this {
    const { gw, gh, W, S, D, dW, dS, absorb, valley, box } = this;
    const evap = 0.0035 * this.evap;
    for (let n = 0; n < steps; n++) {
      if (box[0]! > box[2]!) break;
      const x0 = Math.max(0, box[0]! - 1);
      const y0 = Math.max(0, box[1]! - 1);
      const x1 = Math.min(gw - 1, box[2]! + 1);
      const y1 = Math.min(gh - 1, box[3]! + 1);
      // Exchange between each cell and its right and lower neighbour.
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const a = y * gw + x;
          const wa = W[a]!;
          for (let dir = 0; dir < 2; dir++) {
            if (dir === 0 ? x === x1 : y === y1) continue;
            const b = dir === 0 ? a + 1 : a + gw;
            const wb = W[b]!;
            if (wa < EPS && wb < EPS) continue;
            let f: number; // water moving from a to b
            if (wa >= EPS && wb >= EPS) {
              f = 0.22 * (wa - wb);
              // Pigment also diffuses on its own through standing water.
              // Stability: a cell has four neighbours, so everything leaving it per step must stay under 1. Diffusion is capped at 0.12 per pair.
              const dp = 0.08 * Math.min(wa, wb, 1) * Math.min(1.5, Math.max(0.3, absorb[b]!));
              for (let c = 0; c < 3; c++) {
                const q = dp * (S[c]![a]! - S[c]![b]!);
                dS[c]![a] = dS[c]![a]! - q;
                dS[c]![b] = dS[c]![b]! + q;
              }
            } else {
              // Wet meeting dry: the front only advances when there is enough water to overcome the paper.
              const wet = wa >= EPS ? a : b;
              const dry = wa >= EPS ? b : a;
              const push = W[wet]! - 0.2 * absorb[dry]!;
              if (push <= 0) continue;
              f = (wa >= EPS ? 1 : -1) * 0.28 * push;
            }
            const src = f > 0 ? a : b;
            const dst = f > 0 ? b : a;
            const amt = Math.abs(f);
            dW[src] = dW[src]! - amt;
            dW[dst] = dW[dst]! + amt;
            const frac = Math.min(0.12, amt / (W[src]! + 1e-6));
            for (let c = 0; c < 3; c++) {
              const q = S[c]![src]! * frac;
              dS[c]![src] = dS[c]![src]! - q;
              dS[c]![dst] = dS[c]![dst]! + q;
            }
          }
        }
      }
      // Apply, then evaporate, settle and lift.
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * gw + x;
          const inflow = dW[i]! > 0 ? dW[i]! : 0;
          let w = W[i]! + dW[i]!;
          dW[i] = 0;
          for (let c = 0; c < 3; c++) {
            S[c]![i] = Math.max(0, S[c]![i]! + dS[c]![i]!);
            dS[c]![i] = 0;
          }
          if (w < EPS) {
            if (w > 0 || S[0]![i]! + S[1]![i]! + S[2]![i]! > 0) {
              for (let c = 0; c < 3; c++) {
                D[c]![i] = D[c]![i]! + S[c]![i]!;
                S[c]![i] = 0;
              }
            }
            W[i] = 0;
            continue;
          }
          // Cells at the rim of a puddle lose water faster. Water then flows outward and carries pigment to the edge.
          let dryN = 0;
          if (x > 0 && W[i - 1]! < EPS) dryN++;
          if (x < gw - 1 && W[i + 1]! < EPS) dryN++;
          if (y > 0 && W[i - gw]! < EPS) dryN++;
          if (y < gh - 1 && W[i + gw]! < EPS) dryN++;
          w -= evap * (1 + 4 * dryN);
          const settleRate = Math.min(1, (0.0035 * (1 + this.gran * 2 * valley[i]!)) / (w + 0.1));
          // Water rushing in stirs settled pigment back up. This is what lets a drop of clean water push a bloom outward.
          const lift = Math.min(0.6, 0.02 * Math.min(1, w) + 2.5 * inflow);
          for (let c = 0; c < 3; c++) {
            const s = S[c]![i]!;
            const d = D[c]![i]!;
            const down = s * settleRate;
            const up = d * lift;
            S[c]![i] = s - down + up;
            D[c]![i] = d + down - up;
          }
          W[i] = w > 0 ? w : 0;
          if (w >= EPS) {
            if (x < bx0) bx0 = x;
            if (x > bx1) bx1 = x;
            if (y < by0) by0 = y;
            if (y > by1) by1 = y;
          }
        }
      }
      box[0] = bx0;
      box[1] = by0;
      box[2] = bx1;
      box[3] = by1;
    }
    this.cache = undefined;
    return this;
  }

  /** Let everything dry completely. */
  dry(): this {
    this.flow(600);
    return this;
  }

  /** Baked to a canvas. Still-wet pigment is shown where it is. */
  get canvas(): Canvas {
    if (this.cache) return this.cache;
    const { gw, gh, S, D } = this;
    const w = this.p.pxW;
    const h = this.p.pxH;
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    const img = g.createImageData(w, h);
    const d = img.data;
    const tooth = this.gran > 0 ? this.p.tooth : undefined;
    const k = 1 / (this.cell * this.p.scale);
    for (let y = 0; y < h; y++) {
      const gy = Math.min(gh - 1.001, Math.max(0, (y + 0.5) * k - 0.5));
      const yi = gy | 0;
      const fy = gy - yi;
      for (let x = 0; x < w; x++) {
        const gx = Math.min(gw - 1.001, Math.max(0, (x + 0.5) * k - 0.5));
        const xi = gx | 0;
        const fx = gx - xi;
        const i00 = yi * gw + xi;
        const o = (y * w + x) * 4;
        // Fine grain: a little more pigment in the valleys of the paper, at full pixel resolution.
        const grain = tooth ? 1 + this.gran * 0.9 * (0.5 - tooth[y * w + x]!) : 1;
        for (let ch = 0; ch < 3; ch++) {
          const Sc = S[ch]!;
          const Dc = D[ch]!;
          const v00 = Sc[i00]! + Dc[i00]!;
          const v10 = Sc[i00 + 1]! + Dc[i00 + 1]!;
          const v01 = Sc[i00 + gw]! + Dc[i00 + gw]!;
          const v11 = Sc[i00 + gw + 1]! + Dc[i00 + gw + 1]!;
          const v = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
          d[o + ch] = linToByte(ksDec(v * grain));
        }
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.cache = c;
    return c;
  }
}
