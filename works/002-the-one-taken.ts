// 选中的那一条 / The One Taken
// Every answer starts as a spread of things that could be said. One of them gets said.
import { clamp, grain, lch, type Meta, mix, type Painting, type Pt, vignette } from "../engine/index.ts";

export const meta: Meta = { width: 3000, height: 2000, seed: 12 };

const W = 3000;
const H = 2000;
const STEP = 14;
const ORIGIN: [number, number] = [330, 1120];
const GOAL: [number, number] = [2620, 560];

interface Branch {
  pts: Pt[];
  weight: number;
  depth: number;
  chosen: boolean;
}

export default function paint(p: Painting) {
  const r = p.rng.fork("work");
  const paper = lch(0.95, 0.02, 85);
  p.background = paper;

  // ---------- grow the tree of possibilities ----------
  const branches: Branch[] = [];
  const field = (x: number, y: number) => p.noise.fbm(x / 1000, y / 1000, 2) * 1.5;
  const grow = (x: number, y: number, a: number, weight: number, depth: number, chosen: boolean, bias: number) => {
    const pts: Pt[] = [];
    let budget = (160 + 1150 * weight ** 0.65) * r.float(0.6, 1.25);
    const w0 = weight;
    let gone = 0;
    for (;;) {
      pts.push([x, y]);
      if (chosen ? x > GOAL[0] : gone > budget) break;
      // Near the edge of the sheet a branch loses heart instead of hitting a wall.
      if (!chosen && (x < 260 || x > W - 260 || y < 240 || y > H - 240)) budget = Math.min(budget, gone + r.float(40, 160));
      let target = field(x, y) + bias;
      if (chosen) target = 0.75 * target * 1.5 + 0.4 * Math.atan2(GOAL[1] - y, GOAL[0] - x);
      a += (target - a) * 0.07 + r.gauss(0, 0.035);
      x += Math.cos(a) * STEP;
      y += Math.sin(a) * STEP;
      gone += STEP;
      const pSplit = chosen ? 0.1 : depth < 6 ? 0.045 : 0;
      if (gone > 50 && weight > 0.012 && r.chance(pSplit)) {
        const side = r.pick([-1, 1]);
        const dev = side * r.float(0.3, 0.95);
        const share = chosen ? r.float(0.12, 0.55) : weight * r.float(0.3, 0.6);
        grow(x, y, a + dev, share, depth + 1, false, bias * 0.5 + dev * 0.9);
        if (!chosen) weight *= 0.8;
      }
    }
    // Pressure: the chosen line breathes, the others give out.
    const n = pts.length;
    pts.forEach((q, i) => {
      const t = i / Math.max(1, n - 1);
      q[2] = chosen ? clamp(0.62 + 0.4 * p.noise(i / 34, 3.3) + 0.25 * (1 - t) ** 3, 0.3, 1) : 1 - 0.9 * t ** 1.2;
    });
    if (n > 2) branches.push({ pts, weight: w0, depth, chosen });
  };
  grow(ORIGIN[0], ORIGIN[1], -0.25, 1, 0, true, 0);

  // ---------- paper ----------
  const sheet = p.layer("sheet", { blend: "multiply" });
  for (let i = 0; i < 60; i++) {
    sheet.stroke("stamp", [[r.float(0, W), r.float(0, H)], [r.float(0, W), r.float(0, H)]], {
      color: lch(0.9, 0.035, r.float(60, 95)),
      size: r.float(300, 700),
      opacity: 0.07,
      scatter: 0.4,
    });
  }

  // ---------- what was not said ----------
  const ghosts = branches.filter((b) => !b.chosen).sort((a, b) => a.weight - b.weight);
  const bleed = p.layer("bleed", { blend: "multiply" });
  const ink = p.layer("ghosts", { blend: "multiply" });
  const near = lch(0.4, 0.035, 255);
  const far = lch(0.68, 0.025, 240);
  for (const b of ghosts) {
    const s = Math.sqrt(b.weight);
    const col = mix(far, near, clamp(s * 1.5));
    if (b.weight > 0.12) {
      bleed.stroke("wash", b.pts, { color: mix(paper, col, 0.5), size: 10 + 44 * s, opacity: 0.1, bleed: 0.5, films: 12 });
    }
    ink.stroke("ink", b.pts, { color: col, size: 2 + 17 * s, opacity: 0.22 + 0.45 * clamp(s * 1.3), rough: 0.7, thinning: 0.9, knockout: 0.3 });
    // Where a thought stops.
    const end = b.pts[b.pts.length - 1]!;
    if (b.weight > 0.03) ink.stroke("round", [[end[0], end[1]]], { color: col, size: 3 + 6 * s, opacity: 0.45, hardness: 0.7 });
  }
  ink.wetEdge(2.5, 0.7);

  // ---------- what was ----------
  const chosen = branches.find((b) => b.chosen)!;
  const red = lch(0.56, 0.21, 32);
  const warmth = p.layer("warmth", { blend: "multiply" });
  warmth.stroke("wash", chosen.pts, { color: lch(0.82, 0.1, 50), size: 80, opacity: 0.14, bleed: 0.8 });
  const line = p.layer("chosen");
  line.stroke("ink", chosen.pts, { color: red, size: 34, thinning: 0.85, rough: 0.9, taper: [0, 0.14] });
  line.stroke("dry", chosen.pts, { color: lch(0.42, 0.18, 28), size: 16, bristles: 12, opacity: 0.35, dryness: 0.6, streak: 8, wobble: 0.4 });
  line.wetEdge(4, 0.8);

  // ---------- where it all starts ----------
  const dot = p.layer("origin");
  dot.stroke("ink", [[ORIGIN[0] - 9, ORIGIN[1] + 3, 0.9], [ORIGIN[0] + 9, ORIGIN[1] - 3, 1]], { color: lch(0.16, 0.02, 260), size: 50, thinning: 0.2, rough: 1 });
  dot.wetEdge(4, 0.8);

  p.post(vignette(0.1));
  p.post(grain(0.035));
}
