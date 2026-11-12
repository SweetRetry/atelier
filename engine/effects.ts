import { fromOklab, toOklab } from "./core/color.ts";
import { boxBlur } from "./core/field.ts";
import { linToByte, toLin } from "./core/pigment.ts";
import type { Effect } from "./painting.ts";

/** Paper tooth plus fine speckle. Breaks the digital flatness of the final image. */
export function grain(amount = 0.06, toothSize = 2.5): Effect {
  return (d, w, h, p) => {
    const rng = p.rng.fork("grain");
    const f = 1 / (toothSize * p.scale);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = (p.noise(x * f, y * f) * 0.6 + (rng.next() - 0.5) * 0.9) * amount * 255;
        const i = (y * w + x) * 4;
        d[i] = d[i]! + n;
        d[i + 1] = d[i + 1]! + n;
        d[i + 2] = d[i + 2]! + n;
      }
    }
  };
}

/** Darken toward the corners. */
export function vignette(strength = 0.25): Effect {
  return (d, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x / w - 0.5;
        const dy = y / h - 0.5;
        const k = 1 - strength * Math.min(1, (dx * dx + dy * dy) * 2.2);
        const i = (y * w + x) * 4;
        d[i] = d[i]! * k;
        d[i + 1] = d[i + 1]! * k;
        d[i + 2] = d[i + 2]! * k;
      }
    }
  };
}

/** Woven silk ground: warp and weft threads with slow irregularity. For paintings on an aged ground. */
export function silk(amount = 0.05, thread = 3.2): Effect {
  return (d, w, h, p) => {
    const period = Math.max(2.4, thread * p.scale);
    const f = (Math.PI * 2) / period;
    const s = 1 / p.scale;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const slub = p.noise(x * s * 0.004, y * s * 0.05) * 1.4;
        const warp = Math.sin(x * f + p.noise(y * s * 0.006, 7) * 2);
        const weft = Math.sin(y * f + slub);
        const k = 1 + amount * (warp * 0.5 + weft * 0.7 + warp * weft * 0.5);
        const i = (y * w + x) * 4;
        d[i] = d[i]! * k;
        d[i + 1] = d[i + 1]! * k;
        d[i + 2] = d[i + 2]! * k;
      }
    }
  };
}

/** Light spilling out of the brightest areas. Everything above the threshold is blurred and screened back on. Radius in logical units. */
export function bloom(strength = 0.5, radius = 40, threshold = 0.75): Effect {
  return (d, w, h, p) => {
    const R = Math.max(1, Math.round((radius * p.scale) / 2));
    for (let c = 0; c < 3; c++) {
      let f: Float32Array = new Float32Array(w * h);
      for (let i = 0; i < f.length; i++) f[i] = Math.max(0, d[i * 4 + c]! / 255 - threshold) / (1 - threshold);
      for (let k = 0; k < 3; k++) f = boxBlur(f, w, h, R);
      for (let i = 0; i < f.length; i++) {
        const v = d[i * 4 + c]! / 255;
        d[i * 4 + c] = (1 - (1 - v) * (1 - strength * f[i]!)) * 255;
      }
    }
  };
}

export interface Levels {
  /** Lightness range of the picture as it is, 0..100, the scale `bun measure` prints. */
  from?: [number, number];
  /** Where that range should land. `from: [73, 96], to: [50, 96]` deepens the darks and keeps the lights. */
  to?: [number, number];
  /** Bends the middle. Above 1 darkens the midtones, below 1 lightens them. */
  gamma?: number;
  /** Multiplies colorfulness. 0 is grey. */
  chroma?: number;
  /** Turns every hue, in degrees. */
  hue?: number;
}

/** Lightness on the 0..100 scale of `bun measure` as OKLab lightness, exact for greys. */
const okL = (v: number) => Math.cbrt(v > 8 ? ((v + 16) / 116) ** 3 : v / 903.3);

/** Remap lightness, chroma and hue of pixels in place. Hue and chroma of each pixel are kept while its lightness moves. Alpha is untouched. */
export function adjust(d: Uint8ClampedArray, o: Levels): void {
  const [f0, f1] = (o.from ?? [0, 100]).map(okL) as [number, number];
  const [t0, t1] = (o.to ?? [0, 100]).map(okL) as [number, number];
  const [gamma, chroma] = [o.gamma ?? 1, o.chroma ?? 1];
  const [ch, sh] = [Math.cos(((o.hue ?? 0) * Math.PI) / 180) * chroma, Math.sin(((o.hue ?? 0) * Math.PI) / 180) * chroma];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [L, a, b] = toOklab(toLin(d[i]! / 255), toLin(d[i + 1]! / 255), toLin(d[i + 2]! / 255));
    const t = Math.min(1, Math.max(0, (L - f0) / (f1 - f0)));
    const [r, g, bl] = fromOklab(t0 + (t1 - t0) * (gamma === 1 ? t : t ** gamma), a * ch - b * sh, a * sh + b * ch);
    d[i] = linToByte(r);
    d[i + 1] = linToByte(g);
    d[i + 2] = linToByte(bl);
  }
}

/** Adjust the values and color of the whole picture. Measure first, then say where the range should go. */
export function levels(o: Levels): Effect {
  return (d) => adjust(d, o);
}
