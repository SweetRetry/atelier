import { createNoise2D } from "simplex-noise";

/** Seeded randomness. Every painting is reproducible from its seed. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** mulberry32, uniform in [0, 1). */
  next = (): number => {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  float(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.float(a, b + 1));
  }
  chance(p: number) {
    return this.next() < p;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)]!;
  }
  /** Normal distribution, Box-Muller. */
  gauss(mean = 0, sd = 1) {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Independent child stream, so adding draws in one place does not shift another. */
  fork(label: string | number) {
    let h = this.s ^ 0x9e3779b9;
    for (const ch of String(label)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    return new Rng(h);
  }
}

export type Noise = {
  /** Simplex noise in [-1, 1]. */
  (x: number, y: number): number;
  /** Fractal sum, roughly [-1, 1]. */
  fbm(x: number, y: number, octaves?: number, gain?: number): number;
};

export function makeNoise(rng: Rng): Noise {
  const n = createNoise2D(rng.next) as Noise;
  n.fbm = (x, y, octaves = 4, gain = 0.5) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * n(x * f, y * f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  };
  return n;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
