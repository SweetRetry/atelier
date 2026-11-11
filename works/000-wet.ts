// Proof sheet for the wet layer. Each panel isolates one behaviour.
import { lch, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1800, height: 1500, seed: 4 };

const yellow = "#f2c81d";
const blue = "#1f4fa8";
const h = (x0: number, x1: number, y: number, wob = 0): Pt[] => [[x0, y], [(x0 + x1) / 2, y + wob], [x1, y]];
const v = (x: number, y0: number, y1: number, wob = 0): Pt[] => [[x, y0], [x + wob, (y0 + y1) / 2], [x, y1]];

export default function paint(p: Painting) {
  p.background = "#efe8d8";

  // 1. Pigment vs light. Blue dragged through wet yellow. Left should turn green, right should turn grey.
  (["pigment", "light"] as const).forEach((mixing, k) => {
    const L = p.wet(mixing, { mixing });
    const ox = 80 + k * 880;
    for (let i = 0; i < 4; i++) L.stroke(v(ox + 250 + i * 70, 70, 430), { color: yellow, size: 90, load: 0.95 });
    for (let i = 0; i < 3; i++) L.stroke(h(ox, ox + 760, 130 + i * 120, 20), { color: blue, size: 80, load: 0.8, pickup: 0.7 });
  });

  const L = p.wet("demo", { impasto: 0.7 });
  // 2. Smudge. A clean brush through wet stripes, strength rising left to right.
  const cols = [lch(0.55, 0.19, 28), lch(0.8, 0.15, 85), lch(0.5, 0.12, 160), lch(0.4, 0.13, 265), lch(0.93, 0.02, 90)];
  cols.forEach((c, i) => L.stroke(h(80, 840, 560 + i * 62), { color: c, size: 70, load: 0.95, bristle: 0.3 }));
  [0.3, 0.6, 0.9].forEach((s, i) => L.smudge(v(230 + i * 230, 520, 850, 50), { size: 110, strength: s }));

  // 3. Wet over wet versus wet over dry. Same white stroke across the same red bar.
  const red = lch(0.5, 0.2, 28);
  const white = lch(0.95, 0.02, 90);
  L.stroke(h(960, 1280, 690), { color: red, size: 150, load: 0.95 });
  L.stroke(v(1120, 530, 850), { color: white, size: 70, load: 0.85, pickup: 0.8 });
  L.stroke(h(1400, 1720, 690), { color: red, size: 150, load: 0.95 });
  L.dry();
  L.stroke(v(1560, 530, 850), { color: white, size: 70, load: 0.85, pickup: 0.8 });

  // 4. Bristle and reach. Knife, brush, coarse brush, then a brush that runs dry.
  L.stroke(h(80, 840, 960, 30), { color: lch(0.45, 0.14, 250), size: 90, bristle: 0 });
  L.stroke(h(80, 840, 1080, 30), { color: lch(0.45, 0.14, 250), size: 90, bristle: 0.6 });
  L.stroke(h(80, 840, 1200, 30), { color: lch(0.45, 0.14, 250), size: 90, bristle: 1, bristles: 9 });
  L.stroke(h(80, 840, 1330, 30), { color: lch(0.45, 0.14, 250), size: 90, bristle: 0.8, reach: 6 });

  // 5. Alla prima. Many loaded strokes worked into each other.
  const r = p.rng.fork("alla");
  const pal = [lch(0.6, 0.17, 40), lch(0.8, 0.14, 80), lch(0.45, 0.13, 20), lch(0.9, 0.04, 90), lch(0.5, 0.1, 150)];
  for (let i = 0; i < 70; i++) {
    const x = r.float(1000, 1640);
    const y = r.float(960, 1360);
    const a = r.float(-0.6, 0.6);
    const len = r.float(60, 200);
    L.stroke([[x, y, 0.8], [x + Math.cos(a) * len, y + Math.sin(a) * len, 1]], { color: r.pick(pal), size: r.float(40, 90), load: 0.75, pickup: 0.8, bristle: 0.7 });
  }
}
