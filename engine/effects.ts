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
