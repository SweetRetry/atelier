// Textured brush tips. A tip is an alpha mask generated once from noise, then tinted and stamped.
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { rgba } from "../core/color.ts";
import { clamp, makeNoise, type Noise, Rng, smooth } from "../core/rng.ts";

const N = 96;
/** Alpha at u, v in -1..1. r is distance from center. */
export type TipFn = (u: number, v: number, r: number, noise: Noise, rng: Rng) => number;

const masks = new Map<string, Canvas[]>();
const tinted = new Map<string, Canvas>();

/** Register a tip shape. Variants differ by seed so repeated dabs do not show a pattern. */
export function defineTip(name: string, fn: TipFn, variants = 4) {
  const list: Canvas[] = [];
  for (let k = 0; k < variants; k++) {
    const rng = new Rng(1).fork(`${name}/${k}`);
    const noise = makeNoise(rng);
    const c = createCanvas(N, N);
    const g = c.getContext("2d");
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x / (N - 1)) * 2 - 1;
        const v = (y / (N - 1)) * 2 - 1;
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = clamp(fn(u, v, Math.hypot(u, v), noise, rng)) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    list.push(c);
  }
  masks.set(name, list);
}

export const tipNames = () => [...masks.keys()];

export function tintedTip(name: string, color: string, rng: Rng): Canvas {
  const list = masks.get(name);
  if (!list) throw new Error(`unknown tip "${name}". have: ${tipNames().join(", ")}`);
  const k = Math.floor(rng.next() * list.length);
  const key = `${name}/${k}/${color}`;
  let c = tinted.get(key);
  if (!c) {
    c = createCanvas(N, N);
    const g = c.getContext("2d");
    g.drawImage(list[k]!, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = rgba(color);
    g.fillRect(0, 0, N, N);
    tinted.set(key, c);
  }
  return c;
}

const disc = (r: number, soft: number) => smooth((1 - r) / soft);

/** Blotchy, organic. Foliage masses, rock, mottled slopes, clouds. */
defineTip("sponge", (u, v, r, n) => disc(r, 0.5) * smooth((n.fbm(u * 1.6, v * 1.6, 4) + 0.25) / 0.5));
/** Fine dry grit. Pastel, rim light, dry scumbling. */
defineTip("chalk", (u, v, r, n) => disc(r, 0.25) * smooth((n.fbm(u * 7, v * 7, 3) + 0.05) / 0.3) * 0.9);
/** Sparse dots. Spatter, sparkle, pollen, snow. */
defineTip("speckle", (u, v, r, n, rng) => (r < 0.95 && n(u * 14, v * 14) > 0.62 && rng.next() < 0.9 ? 1 : 0));
