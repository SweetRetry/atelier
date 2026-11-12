// What it says: the concept painting 4-design-e-2 restated as a character design plate. Same design, cleaner marks.
// Focal point: the helmet and chest, white plate against the dark gauntlet and the cyan blades.
// Medium: flat polygons on a canvas layer, one per patch of color, so every plate edge is a single hard line instead of a smear.
// Study of refs/design-e-2.png (a Midjourney image from the user's own exploration). Colors are sampled from the file.
import { resolve } from "node:path";
import { type Meta, type Painting, Reference } from "../engine/index.ts";

export const meta: Meta = { width: 1792, height: 2688, seed: 1 };
const [W, H] = [1792, 2688];
const BG = "#77777a"; // sampled near the top left of the reference

export default async function paint(p: Painting) {
  const ref = await Reference.load(resolve(import.meta.dir, "../refs/design-e-2.png"), W, H, 1344);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // The backdrop of the reference is a vertical gradient. A point is backdrop when it matches the left or right edge of its row.
  // The reference lightens toward the middle, so the tolerance is wide. The flood fill below keeps it from eating grey plates.
  // Low on the sheet the backdrop turns to sand, which is light and warm where the armor is cool.
  const isBg = (x: number, y: number) => {
    const c = rgb(ref.color(x, y));
    if (y > H * 0.84 && c[0]! - c[2]! > 26 && c[0]! > 120) return true;
    return [30, W - 30].some((ex) => Math.hypot(...rgb(ref.color(ex, y)).map((v, i) => v - c[i]!)) < 44);
  };
  // Figure mask at reference resolution. Backdrop is what matches its row edge and connects to the border,
  // so grey plates inside the figure are not cut out.
  const [mw, mh] = [W / 2, H / 2];
  const bg = new Float32Array(mw * mh);
  const flood = (seeds: number[], pass: (x: number, y: number) => boolean) => {
    const seen = new Uint8Array(mw * mh);
    const stack = [...seeds];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i]) continue;
      seen[i] = 1;
      const x = i % mw;
      const y = (i - x) / mw;
      if (!pass(x * 2 + 1, y * 2 + 1)) continue;
      bg[i] = 1;
      if (x > 0) stack.push(i - 1);
      if (x < mw - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - mw);
      if (y < mh - 1) stack.push(i + mw);
    }
  };
  const border: number[] = [];
  for (let x = 0; x < mw; x++) border.push(x, (mh - 1) * mw + x);
  for (let y = 0; y < mh; y++) border.push(y * mw, y * mw + mw - 1);
  flood(border, isBg);
  // Pockets of backdrop closed in by the figure, placed by eye on the preview. Each spreads while the color stays near its seed.
  const POCKETS: [x: number, y: number, tol: number][] = [
    [634, 1190, 30], // between the gauntlet and the thigh
    [576, 2016, 30], // between the gauntlet and the shin
    [480, 2208, 30], // under the cape, left of the feet
    [845, 806, 30], // between the upper arm and the waist
    [490, 2314, 34], // sand showing under the cape hem
  ];
  for (const [sx, sy, tol] of POCKETS) {
    const c0 = rgb(ref.color(sx, sy));
    flood([Math.floor(sy / 2) * mw + Math.floor(sx / 2)], (x, y) => Math.hypot(...rgb(ref.color(x, y)).map((v, i) => v - c0[i]!)) < tol);
  }
  // The sand keeps thin flat streaks of cast shadow. Low on the sheet, a column of figure shorter than GROUND pixels is one of those.
  for (let x = 0; x < mw; x++) {
    for (let y = Math.floor(mh * 0.895); y < mh; ) {
      if (bg[y * mw + x]) { y++; continue; }
      let e = y;
      while (e < mh && !bg[e * mw + x]) e++;
      if (e - y < GROUND && (y === 0 || bg[(y - 1) * mw + x])) for (let q = y; q < e; q++) bg[q * mw + x] = 1;
      y = e;
    }
  }
  // Two 3x3 averages and a threshold, so the cut edge is smooth instead of stepped.
  const blur3 = (src: Float32Array) => {
    const out = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        let t = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += src[Math.min(mh - 1, Math.max(0, y + dy)) * mw + Math.min(mw - 1, Math.max(0, x + dx))]!;
        out[y * mw + x] = t / 9;
      }
    }
    return out;
  };
  const soft = blur3(blur3(bg));
  for (let i = 0; i < mw * mh; i++) bg[i] = soft[i]! >= 0.5 ? 1 : 0;
  // Specks of figure cut loose from the body, such as the dashes of shadow on the sand, go to backdrop too.
  const seen = new Uint8Array(mw * mh);
  for (let s = 0; s < mw * mh; s++) {
    if (bg[s] || seen[s]) continue;
    const isle = [s];
    seen[s] = 1;
    for (let q = 0; q < isle.length; q++) {
      const i = isle[q]!;
      const x = i % mw;
      for (const j of [x > 0 ? i - 1 : -1, x < mw - 1 ? i + 1 : -1, i - mw, i + mw]) {
        if (j < 0 || j >= mw * mh || bg[j] || seen[j]) continue;
        seen[j] = 1;
        isle.push(j);
      }
    }
    if (isle.length < ISLAND) for (const i of isle) bg[i] = 1;
  }
  const figure = (x: number, y: number) => !bg[Math.min(mh - 1, Math.floor(y / 2)) * mw + Math.min(mw - 1, Math.floor(x / 2))];

  p.background = BG;
  // Facets of neighbouring patches are cut separately and leave slivers between them.
  // The same patches with nearly exact outlines go underneath (pixel steps shaved off), so a sliver shows the right color instead of backdrop.
  const cut = (facet: number) => ref.planes({ rng: p.rng.fork("planes"), colors: COLORS, min: MIN, facet, inside: figure });
  const under = p.layer("exact");
  for (const pl of cut(2.6)) under.shape(pl.poly, pl.color);
  const top = p.layer("planes");
  for (const pl of cut(FACET)) top.shape(pl.poly, pl.color);
}

const COLORS = 16; // palette size. a guess, picked from a sheet of three settings
const MIN = 64; // smallest patch kept, logical area. a guess
const FACET = 4.4; // how far a facet may leave the traced outline, logical units. a guess
const ISLAND = 300; // smallest loose piece of figure kept, in reference pixels. a guess
const GROUND = 12; // tallest streak of ground shadow removed, in reference pixels. a guess
