// 暗箱 · Obscura, the logo
// The mark beside the name, lettered by hand in the same chalk ink as the ring.
// Focal point: the light in the mark; the word reads second. Canvas ink on the room's dark,
// because the light's glow needs dark around it (and the engine has no transparent sheet).
import { grain, type Meta, type Painting, type Pt } from "../engine/index.ts";
import { CHALK, mark, ROOM, ROOM_LOW } from "./008-obscura-mark.ts";

export const meta: Meta = { width: 2260, height: 760, seed: 2 };

type Glyph = { w: number; strokes: [number, number, number?][][] };

// Lowercase brush script on a unit x-height. y is up from the baseline; the third value is pressure.
const GLYPHS: Record<string, Glyph> = {
  o: { w: 0.78, strokes: [[[0.5, 0.98], [0.2, 0.9], [0.04, 0.5], [0.18, 0.08], [0.42, 0], [0.68, 0.14], [0.76, 0.52], [0.62, 0.9], [0.4, 1.0, 0.6]]] },
  b: { w: 0.78, strokes: [[[0.1, 1.72, 0.5], [0.08, 1.2], [0.07, 0.5], [0.08, 0.02]], [[0.09, 0.55, 0.6], [0.3, 0.92], [0.55, 0.98], [0.74, 0.6], [0.62, 0.12], [0.36, 0], [0.12, 0.08, 0.5]]] },
  s: { w: 0.66, strokes: [[[0.6, 0.86, 0.5], [0.4, 1.0], [0.12, 0.88], [0.1, 0.64], [0.35, 0.5], [0.58, 0.36], [0.6, 0.12], [0.36, 0], [0.04, 0.1, 0.4]]] },
  c: { w: 0.68, strokes: [[[0.64, 0.84, 0.5], [0.42, 1.0], [0.14, 0.84], [0.04, 0.46], [0.18, 0.08], [0.44, 0], [0.66, 0.16, 0.4]]] },
  u: { w: 0.8, strokes: [[[0.06, 1.0, 0.5], [0.06, 0.6], [0.1, 0.2], [0.32, 0], [0.58, 0.1], [0.7, 0.5], [0.7, 1.0, 0.6]], [[0.7, 0.98, 0.7], [0.7, 0.4], [0.76, 0.0, 0.4]]] },
  r: { w: 0.56, strokes: [[[0.08, 1.0, 0.6], [0.08, 0.5], [0.08, 0.0]], [[0.08, 0.6, 0.5], [0.22, 0.88], [0.4, 1.0], [0.56, 0.96, 0.4]]] },
  a: { w: 0.8, strokes: [[[0.66, 0.82, 0.5], [0.42, 1.0], [0.14, 0.84], [0.04, 0.42], [0.2, 0.04], [0.42, 0.02], [0.64, 0.3, 0.6]], [[0.68, 1.0, 0.7], [0.68, 0.4], [0.72, 0.06], [0.82, 0.0, 0.4]]] },
};

export function word(p: Painting, text: string, x0: number, baseline: number, h: number) {
  const ink = p.layer("word");
  const r = p.rng.fork("word");
  let x = x0;
  for (const ch of text) {
    const g = GLYPHS[ch]!;
    for (const s of g.strokes) {
      const pts: Pt[] = s.map(([u, v, pr]) => [x + u * h + r.float(-1, 1) * h * 0.01, baseline - v * h + r.float(-1, 1) * h * 0.01, pr ?? 0.95]);
      ink.stroke("ink", pts, { color: CHALK, size: h * 0.105, rough: 0.3 });
    }
    x += (g.w + 0.14) * h;
  }
  return x;
}

export default function paint(p: Painting) {
  p.background = ROOM;
  p.layer("room").vgrad([ROOM, ROOM_LOW]);
  mark(p, 380, 380, 330);
  // The x-height sits on the ring's centre line; the b's ascender rises toward its top.
  const h = 230;
  word(p, "obscura", 790, 380 + h * 0.55, h);
  p.post(grain(0.03));
}
