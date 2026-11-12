// Proof sheet for a sheet with no paper. Expected: one soft-edged ink stroke and a red dot on nothing.
// The PNG is transparent wherever nothing is painted, so the mark can be laid over any ground.
import { lch, type Meta, oval, type Painting } from "../engine/index.ts";

export const meta: Meta = { width: 600, height: 300, seed: 1 };

export default function paint(p: Painting) {
  p.background = null;
  const L = p.layer("mark");
  L.stroke("ink", [[60, 200, 0.3], [220, 90, 1], [400, 190, 0.8], [540, 110, 0.2]], { color: lch(0.25, 0.03, 260), size: 34, rough: 0.4 });
  L.shape(oval(470, 70, 26), lch(0.6, 0.2, 30));
}
