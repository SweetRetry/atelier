// Proof for Reference.planes: a picture restated as flat patches with faceted outlines.
// It reads out/001-someone-is-awake@full.png, so render that first.
import { resolve } from "node:path";
import { type Meta, type Painting, Reference } from "../engine/index.ts";

export const meta: Meta = { width: 2400, height: 1500, seed: 3 };

export default async function paint(p: Painting) {
  const ref = await Reference.load(resolve(import.meta.dir, "../out/001-someone-is-awake@full.png"), 1200, 1500);
  p.background = "#ff00ff";
  const L = p.layer("planes");
  // Left panel. Expected: the lake picture in 8 flat colors. Every boundary between two colors is one run of straight facets,
  // no soft edge anywhere. Magenta slivers may show between patches, because each outline is simplified on its own.
  for (const pl of ref.planes({ rng: p.rng.fork("a"), colors: 8, min: 80, facet: 6 })) L.shape(pl.poly, pl.color);
  // Right panel. Expected: only the lower half is painted (`inside`), with facet 0, so outlines follow the pixels of the reference
  // in small steps and patches tile with no magenta between them. The upper half stays magenta.
  const R = p.layer("exact");
  for (const pl of ref.planes({ rng: p.rng.fork("a"), colors: 8, min: 80, facet: 0, inside: (_x, y) => y > 750 })) {
    R.shape(pl.poly.map(([x, y]) => [x! + 1200, y!]), pl.color);
  }
}
