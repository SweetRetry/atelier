// 临摹 · 逆光侧脸 / Study after a reference: profile in noon light
// Says: a face turned away into light so strong the forms nearly dissolve. Focal point: the grey-blue eye, the only cool note.
// Medium: opaque paint with a flat brush for the masses, a fine round point for the drawn line, because the source is flat paint under pencil.
//
// This is a study of another artist's picture, made as practice. It is not an original work.
// Source: refs/cd87cb6c600f9962f30f9d54c68c7775.jpg, watermarked "Xiaohongshu ID: 916722332" as far as it can be read. The watermark is not copied.
//
// Study of the source (816 x 1456), all measured from the file unless marked.
// - Crop: a head seen from behind the cheek, facing right, cut by all four edges. Eye at (0.60, 0.21), ear at (0.20, 0.39),
//   lips at (0.93, 0.43), earring at (0.28, 0.47), jaw meets neck at (0.75, 0.58). Positions read from the image by eye.
// - Values: lightness runs 0.34 to 1.00 with mean 0.81. 95% of the sheet is lighter than 0.7. Only the line is dark.
// - Palette: paper #fbf9fa, hair #e5c7a5 to #d6b892, skin #e3c0ac, lit skin #f6e9d9, deep skin #dbb294, lip #e1a38c,
//   iris #b4bbc3, line #9b7864, cloth shadow #d7c7ba. Colors are taken from the file while painting, not from these constants.
// - Edges: masses meet in cut edges, light patches are cut shapes, the top left burns out to white.
// - Line: thin warm brown pencil, broken, restated, crossing the masses.
// - Three details that carry it: the speckled iris, the pale earring, the sliver of light under the eye.
//
// Method: paint in passes from a broad brush to a fine point. Before each pass, compare the sheet with the source
// and put the brush only where the two still differ. Each stroke follows the form in the source and stops where the color changes.
import { resolve } from "node:path";
import { grain, type Meta, type Painting, paintFrom, Reference, type StudyPass } from "../engine/index.ts";

export const meta: Meta = { width: 1632, height: 2912, seed: 3 };

const W = 1632;
const H = 2912;
/** Where the source carries its watermark, in logical units. Only the broad passes go here. */
const inMark = (x: number, y: number) => (x > W * 0.62 && y > H * 0.968) || (x > W * 0.88 && x < W * 0.975 && y > H * 0.94 && y < H * 0.968);

// size, attempts, length in sizes, how far the color may drift along a stroke (0..255), least error worth a stroke (0..255), pickup.
const PASSES: StudyPass[] = [
  [220, 500, 3, 26, 0, 0.4],
  [110, 2200, 3, 20, 6, 0.35],
  [56, 8000, 3, 16, 6, 0.25],
  [28, 26000, 3.5, 13, 8, 0.1],
  [14, 70000, 5, 12, 10, 0],
  // The drawn line. A line keeps its color along its length and differs sharply from what it crosses,
  // so these strokes may drift further in color and run long, which keeps a contour in one piece.
  [6, 170000, 16, 20, 10, 0],
  [3.4, 300000, 30, 24, 11, 0],
  // Dabs, for the speckle of the iris and the ends of lashes.
  [2.4, 200000, 4, 24, 15, 0],
];

export default async function paint(p: Painting) {
  const ref = await Reference.load(resolve(import.meta.dir, "../refs/cd87cb6c600f9962f30f9d54c68c7775.jpg"), W, H, 1456);
  const L = p.wet("paint", { impasto: 0.07, life: 40 });
  L.fill("#f3e6d3");
  paintFrom(p, L, ref, PASSES, { rng: p.rng.fork("hand"), skip: (x, y, size) => size < 60 && inMark(x, y) });
  p.post(grain(0.012));
}
