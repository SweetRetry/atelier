// Proof sheet for dry media on paper tooth.
import { lch, media, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1100, seed: 2 };

export default function paint(p: Painting) {
  p.background = "#f1ece0";
  const L = p.wet("drawing", { life: Infinity, impasto: 0 });
  const graphite = lch(0.3, 0.01, 260);

  // Pencil: single lines at rising pressure, then hatching, then cross-hatching.
  [0.25, 0.5, 0.75, 1].forEach((pr, i) => L.stroke([[60, 70 + i * 36, pr], [300, 60 + i * 36, pr], [520, 76 + i * 36, pr]], { ...media.pencil, color: graphite, size: 5 }));
  for (let i = 0; i < 60; i++) {
    const x = 60 + i * 7.6;
    const pr = 0.25 + 0.75 * (i / 59);
    L.stroke([[x, 330, pr * 0.8], [x + 40, 240, pr]], { ...media.pencil, color: graphite, size: 5 });
    if (i > 30) L.stroke([[x + 40, 330, pr * 0.7], [x, 240, pr * 0.7]], { ...media.pencil, color: graphite, size: 5 });
  }
  // Side of the lead: broad soft tone, light to heavy.
  for (let k = 0; k < 4; k++) L.stroke([[60, 400 + k * 22, 0.2], [300, 400 + k * 22, 0.6], [520, 400 + k * 22, 1]], { ...media.pencil, color: graphite, size: 34, hardness: 0.3 });

  // Charcoal: broad strokes, then the same strokes smudged with a finger.
  const coal = lch(0.18, 0.01, 60);
  const row = (y: number): Pt[] => [[620, y, 0.5], [800, y - 20, 1], [1000, y + 10, 0.6]];
  [90, 180].forEach((y) => L.stroke(row(y), { ...media.charcoal, color: coal, size: 46 }));
  [330, 420].forEach((y) => L.stroke(row(y), { ...media.charcoal, color: coal, size: 46 }));
  L.smudge([[700, 290], [730, 380], [700, 470]], { size: 80, strength: 0.8, bristle: 0.1, hardness: 0.3 });
  L.smudge([[900, 290], [930, 380], [900, 470]], { size: 80, strength: 0.8, bristle: 0.1, hardness: 0.3 });

  // Pastel: saturated color layered over color. The paper shows through at light pressure.
  const cols = [lch(0.62, 0.19, 30), lch(0.8, 0.15, 90), lch(0.6, 0.13, 240), lch(0.95, 0.02, 90)];
  cols.forEach((c, i) => L.stroke([[1090, 80 + i * 70, 0.35], [1300, 70 + i * 70, 0.7], [1540, 90 + i * 70, 1]], { ...media.pastel, color: c, size: 58 }));
  L.stroke([[1180, 40, 0.6], [1200, 200, 0.8], [1170, 340, 0.6]], { ...media.pastel, color: lch(0.45, 0.14, 300), size: 50 });
  L.stroke([[1420, 40, 0.3], [1440, 200, 0.4], [1410, 340, 0.3]], { ...media.pastel, color: lch(0.96, 0.02, 90), size: 50 });

  // A ball, to check that tone can be built by pressure alone.
  const cx = 330;
  const cy = 780;
  const R = 210;
  for (let i = 0; i < 900; i++) {
    const a = p.rng.float(0, Math.PI * 2);
    const rr = Math.sqrt(p.rng.next()) * R;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    // Lambert from the upper left.
    const nx = (x - cx) / R;
    const ny = (y - cy) / R;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = Math.max(0, -0.55 * nx - 0.6 * ny + 0.58 * nz);
    const pr = 0.12 + 0.88 * (1 - lit) ** 1.6;
    const t = Math.atan2(ny, nx) + Math.PI / 2;
    const len = 26;
    L.stroke([[x - Math.cos(t) * len, y - Math.sin(t) * len, pr * 0.7], [x + Math.cos(t) * len, y + Math.sin(t) * len, pr]], { ...media.pencil, color: graphite, size: 7 });
  }
  for (let i = 0; i < 120; i++) {
    const x = cx - 120 + p.rng.float(0, 460);
    const y = cy + R - 14 + p.rng.gauss(0, 12);
    L.stroke([[x - 30, y, 0.5], [x + 30, y + 2, 0.7]], { ...media.pencil, color: graphite, size: 8 });
  }

  // Charcoal landscape scrap: tone massed, then lifted with a pale pastel.
  for (let i = 0; i < 26; i++) {
    const y = 620 + i * 14;
    L.stroke([[700, y, 0.3 + i / 40], [1100, y + p.rng.gauss(0, 10), 0.4 + i / 45], [1540, y, 0.3 + i / 40]], { ...media.charcoal, color: coal, size: 40 });
  }
  L.smudge([[720, 700], [1100, 680], [1520, 720]], { size: 120, strength: 0.7, bristle: 0.1, hardness: 0.2 });
  L.stroke([[980, 660, 0.5], [1100, 640, 1], [1220, 665, 0.5]], { ...media.pastel, color: lch(0.96, 0.02, 90), size: 44, tooth: 0.5 });
}
