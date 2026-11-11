// Proof sheet for the watercolor layer. Each panel isolates one behaviour.
import { lch, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1100, seed: 5 };

const blob = (cx: number, cy: number, r: number, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r * 0.5, cy + Math.sin((i / n) * Math.PI * 2) * r * 0.5] as Pt);

export default function paint(p: Painting) {
  p.background = "#f4efe4";
  const L = p.water("wc");
  const blue = lch(0.45, 0.14, 255);
  const red = lch(0.55, 0.2, 25);
  const yellow = lch(0.85, 0.16, 95);
  const sienna = lch(0.5, 0.11, 55);

  // 1. One wash on dry paper. Expect an irregular edge and a darker rim.
  L.stroke([[80, 130], [300, 110], [520, 140]], { color: blue, size: 110, water: 0.9, pigment: 0.7 });
  L.stroke([[80, 300], [300, 280], [520, 310]], { color: blue, size: 110, water: 0.35, pigment: 0.7 });

  // 2. Wet in wet. The paper is flooded first, then color is touched in. Expect feathering.
  L.wetArea(blob(820, 210, 260), { size: 150, water: 1 });
  L.wetArea([[820, 210]], { size: 300, water: 1 });
  L.stroke([[760, 200], [800, 210]], { color: red, size: 50, water: 0.6, pigment: 1 });
  L.stroke([[880, 230], [900, 220]], { color: blue, size: 44, water: 0.6, pigment: 1 });
  L.flow(120);

  // 3. Two colors meeting while wet. Expect green where they run together.
  L.stroke([[1120, 120], [1250, 200], [1150, 300]], { color: yellow, size: 130, water: 1, pigment: 0.9 });
  L.stroke([[1400, 120], [1300, 210], [1420, 300]], { color: blue, size: 130, water: 1, pigment: 0.8 });
  L.flow(120);
  L.dry();

  // 4. Glazing. Dry washes laid over each other. Expect clean darker overlaps, no mixing.
  L.stroke([[80, 520], [520, 520]], { color: yellow, size: 120, water: 0.5, pigment: 0.8 });
  L.dry();
  L.stroke([[190, 440], [190, 620]], { color: red, size: 100, water: 0.5, pigment: 0.6 });
  L.dry();
  L.stroke([[400, 440], [400, 620]], { color: blue, size: 100, water: 0.5, pigment: 0.6 });
  L.dry();

  // 5. Bloom. A drop of clean water into a half-dry wash. Expect a pale centre with a dark crinkled edge.
  L.stroke([[680, 480], [820, 540], [960, 500]], { color: sienna, size: 170, water: 0.8, pigment: 0.9 });
  L.stroke([[690, 580], [820, 600], [950, 590]], { color: sienna, size: 150, water: 0.8, pigment: 0.9 });
  L.flow(70);
  L.wetArea([[780, 530]], { size: 60, water: 1.4 });
  L.wetArea([[900, 570]], { size: 40, water: 1.4 });
  L.dry();

  // 6. Granulation, low and high, on a separate layer for the second.
  L.stroke([[1090, 480], [1500, 480]], { color: lch(0.4, 0.1, 280), size: 110, water: 0.8, pigment: 0.6 });
  const G = p.water("grainy", { granulation: 1 });
  G.stroke([[1090, 620], [1500, 620]], { color: lch(0.4, 0.1, 280), size: 110, water: 0.8, pigment: 0.6 });

  // 7. A small sky, to see the behaviours work together.
  const S = p.water("sky", { evaporation: 0.7 });
  S.wetArea([[100, 880], [800, 860], [1500, 890]], { size: 330, water: 1 });
  S.stroke([[80, 790], [800, 770], [1520, 800]], { color: lch(0.5, 0.12, 250), size: 120, water: 0.9, pigment: 0.8 });
  S.stroke([[80, 990], [800, 1000], [1520, 985]], { color: lch(0.75, 0.13, 60), size: 110, water: 0.9, pigment: 0.7 });
  S.flow(60);
  S.stroke([[300, 880], [520, 860], [700, 890]], { color: lch(0.35, 0.06, 280), size: 60, water: 0.5, pigment: 0.9 });
  S.stroke([[980, 900], [1150, 880], [1330, 905]], { color: lch(0.35, 0.06, 280), size: 50, water: 0.5, pigment: 0.9 });
  S.dry();
  L.dry();
  G.dry();
}
