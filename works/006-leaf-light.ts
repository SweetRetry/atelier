// 叶隙 / Leaf Light
// Says: a girl looks away while noon light breaks through leaves onto her face. Focal point: the near amber eye,
// the one saturated note between dark hair and pale skin. Medium: opaque paint with a flat brush, a fine point for line.
//
// An experiment in dividing the work. The design (pose, proportion, line, light) was made by an image model,
// gpt-image-2.5-flare, from a written description of the style measured in 005. It is refs/006-design.png.
// This file only paints that design with the engine's brushes, by looking at it. No drawing decision here is the engine's or Claude's.
import { resolve } from "node:path";
import { grain, type Meta, type Painting, paintFrom, Reference, type StudyPass } from "../engine/index.ts";

export const meta: Meta = { width: 1632, height: 2907, seed: 3 };

// The design holds more dark and more contrast than 005, so the broad passes may drift further before a stroke ends.
const PASSES: StudyPass[] = [
  [220, 600, 3, 34, 0, 0.4],
  [110, 2600, 3, 26, 6, 0.35],
  [56, 9000, 3, 20, 6, 0.25],
  [28, 30000, 3.5, 16, 8, 0.1],
  [14, 80000, 5, 14, 10, 0],
  [6, 190000, 16, 22, 10, 0],
  [3.4, 320000, 30, 26, 11, 0],
  [2.4, 220000, 4, 26, 15, 0],
];

export default async function paint(p: Painting) {
  const ref = await Reference.load(resolve(import.meta.dir, "../refs/006-design.png"), meta.width, meta.height, 1824);
  const L = p.wet("paint", { impasto: 0.07, life: 40 });
  L.fill("#f6efe4");
  paintFrom(p, L, ref, PASSES);
  p.post(grain(0.012));
}
