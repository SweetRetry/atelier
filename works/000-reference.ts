// Proof for painting from a reference: the first painting, repainted in oil by looking at it.
// Big strokes block in everything. Smaller strokes go only where the reference has detail, and run along its forms.
import { resolve } from "node:path";
import { media, type Meta, type Painting, Reference } from "../engine/index.ts";

export const meta: Meta = { width: 1200, height: 1500, seed: 9 };

export default async function paint(p: Painting) {
  const ref = await Reference.load(resolve(import.meta.dir, "../out/001-someone-is-awake@full.png"), 1200, 1500);
  const L = p.wet("oil", { impasto: 0.35, life: 300 });
  L.fill("#3b3452");
  const r = p.rng.fork("hand");
  const passes: [size: number, count: number, minDetail: number, pickup: number][] = [
    [100, 450, 0, 0.5],
    [48, 1500, 0.03, 0.45],
    [22, 6000, 0.07, 0.25],
    [10, 16000, 0.14, 0.05],
    [5, 16000, 0.26, 0],
    [3.2, 14000, 0.34, 0],
  ];
  for (const [size, count, minDetail, pickup] of passes) {
    // Fine work goes over dry paint so it stays crisp.
    if (size < 20) L.dry();
    for (let i = 0; i < count; i++) {
      const x = r.float(0, 1200);
      const y = r.float(0, 1500);
      if (ref.detail(x, y) < minDetail) continue;
      L.stroke(ref.trace(x, y, size * (size < 4 ? 14 : size < 20 ? 2.2 : 2.6), r), { ...media.oil, color: ref.color(x, y), size, pickup, load: 0.85 });
    }
  }
}
