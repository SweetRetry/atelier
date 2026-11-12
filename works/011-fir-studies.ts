// 杉 · Fir, three studies toward a mark that is drawn, not assembled
// Says: a film company's fir, made by a hand and by a machine together.
// Focal point: the warm light in each study. Brush ink on the dark of a screening room,
// because the hand must show, and the light needs dark around it to read as light.
import { grain, lch, rgba, type Meta, type Painting, type Pt } from "../engine/index.ts";
import { CHALK, LIGHT, LIGHT_CORE, ROOM, ROOM_LOW } from "./008-obscura-mark.ts";

export const meta: Meta = { width: 3072, height: 1024, seed: 3 };

const EMBER = lch(0.7, 0.17, 55);

function lamp(p: Painting, id: string, x: number, y: number, r: number) {
  p.layer(`${id}-glow`, { blend: "screen" }).stroke("round", [[x, y], [x + 0.1, y]], { color: LIGHT, size: r * 9, opacity: 0.7, hardness: 0 });
  const dot = p.layer(`${id}-lamp`);
  dot.stroke("round", [[x, y], [x + 0.1, y]], { color: LIGHT, size: r * 2, hardness: 0.92 });
  dot.stroke("round", [[x, y], [x + 0.1, y]], { color: LIGHT_CORE, size: r * 1.4, hardness: 0.55, opacity: 1 });
}

/**
 * I. 杉字. The character 杉 is 木 beside 彡. The 木 is written as a fir.
 * The 彡 is written as three shafts of projector light, which are also the stripes of a clapperboard.
 */
export function character(p: Painting, cx: number, cy: number, s: number) {
  const r = p.rng.fork("character");
  const j = () => r.float(-1, 1) * s * 0.008;
  const X = (u: number) => cx + u * s, Y = (v: number) => cy + v * s;
  const ink = p.layer("character-ink");
  // 木: the trunk first, top to bottom, pressing in and lifting off.
  const tx = -0.3;
  ink.stroke("ink", [[X(tx), Y(-0.82), 0.5], [X(tx + 0.008), Y(-0.4), 1], [X(tx - 0.004), Y(0.3), 0.9], [X(tx + 0.004), Y(0.86), 0.35]], { color: CHALK, size: s * 0.062, rough: 0.4 });
  // Then the boughs, each pair a 撇 and a 捺, longer toward the ground. The right ones stay short to leave room for the light.
  const boughs: [number, number, number][] = [[-0.56, 0.2, 0.15], [-0.22, 0.31, 0.2], [0.14, 0.42, 0.25]];
  for (const [v, wl, wr] of boughs) {
    ink.stroke("ink", [[X(tx) + j(), Y(v) + j(), 1], [X(tx - wl * 0.5), Y(v + wl * 0.42) + j(), 0.8], [X(tx - wl), Y(v + wl * 0.72), 0.12]], { color: CHALK, size: s * 0.085, rough: 0.45 });
    ink.stroke("ink", [[X(tx) + j(), Y(v) + j(), 0.7], [X(tx + wr * 0.55), Y(v + wr * 0.5) + j(), 0.95], [X(tx + wr), Y(v + wr * 0.8), 0.3]], { color: CHALK, size: s * 0.085, rough: 0.45 });
  }
  // 彡: three shafts falling from the upper right. Loaded where the brush lands, dry and streaked where it leaves.
  const glow = p.layer("character-glow", { blend: "screen" });
  const beams = p.layer("character-beams");
  const shafts: [number, number, number, number][] = [[0.52, -0.66, 0.16, -0.34], [0.64, -0.3, 0.1, 0.16], [0.76, 0.08, 0.02, 0.8]];
  shafts.forEach(([x0, y0, x1, y1], i) => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, sag = Math.sin(t * Math.PI) * 0.03;
      pts.push([X(x0 + (x1 - x0) * t + sag), Y(y0 + (y1 - y0) * t + sag), 1 - 0.6 * t ** 1.2]);
    }
    const c = [LIGHT_CORE, LIGHT, EMBER][i]!;
    glow.stroke("round", pts, { color: LIGHT, size: s * 0.3, opacity: 0.1, hardness: 0 });
    beams.stroke("ink", pts.slice(0, 9), { color: c, size: s * 0.085, rough: 0.5 });
    beams.stroke("dry", pts.slice(4), { color: c, size: s * 0.075, bristles: 46, dryness: 0.3, streak: 1.3, wobble: 0.5, opacity: 1 });
  });
}

/** Half width of the fir at distance d from its tip, both 0..1. Four tiers, each wider than the last. */
const TIERS = 4;
const firHalf = (d: number) => {
  const t = Math.min(TIERS - 1e-6, d * TIERS), k = Math.floor(t);
  return 0.045 + 0.085 * k + 0.2 * (t - k);
};

/**
 * II. 暗箱. A camera obscura. The fir below is the tree itself, drawn by hand.
 * Its light passes through one point and throws the tree upside down above, as scan lines.
 */
export function obscura(p: Painting, cx: number, cy: number, s: number) {
  const r = p.rng.fork("obscura");
  const H = s * 0.86;
  // The image above: the same outline as the tree, turned over, built line by line.
  const image = p.layer("obscura-image");
  image.draw(ctx => {
    const step = s * 0.021;
    for (let y = cy - s * 0.05; y > cy - H; y -= step) {
      const d = (cy - y) / H, half = firHalf(d) * s;
      ctx.fillStyle = rgba(d < 0.3 ? LIGHT_CORE : LIGHT, 1 - 0.3 * d);
      // Now and then a line drops out or slips sideways, as a signal does.
      if (r.float(0, 1) < 0.07) continue;
      const slip = r.float(0, 1) < 0.12 ? r.float(-1, 1) * s * 0.05 : 0;
      const cut = r.float(0, 1) < 0.3 ? r.float(-0.7, 0.7) * half : null;
      const h = s * 0.0095;
      if (cut === null) ctx.fillRect(cx - half + slip, y, half * 2, h);
      else {
        ctx.fillRect(cx - half + slip, y, half + cut - s * 0.012, h);
        ctx.fillRect(cx + cut + s * 0.012 + slip, y, half - cut - s * 0.012, h);
      }
    }
  });
  // The tree below: trunk, then each tier as two strokes thrown outward from it.
  const ink = p.layer("obscura-ink");
  ink.stroke("ink", [[cx, cy + s * 0.06, 0.3], [cx + s * 0.004, cy + H * 0.5, 0.9], [cx - s * 0.003, cy + H + s * 0.08, 0.5]], { color: CHALK, size: s * 0.05, rough: 0.4 });
  for (let k = 0; k < TIERS; k++) {
    const ya = cy + (H * k) / TIERS + s * 0.03, yb = cy + (H * (k + 1)) / TIERS;
    const w = firHalf((k + 1 - 1e-6) / TIERS) * s;
    for (const side of [-1, 1]) {
      const pts: Pt[] = [[cx + side * s * 0.01, ya, 1], [cx + side * w * 0.5, ya + (yb - ya) * 0.62 + r.float(-1, 1) * s * 0.01, 0.8], [cx + side * w, yb, 0.1]];
      ink.stroke("ink", pts, { color: CHALK, size: s * 0.085, rough: 0.5 });
      ink.stroke("dry", pts, { color: CHALK, size: s * 0.1, bristles: 40, dryness: 0.6, streak: 1.2, wobble: 0.5, opacity: 0.9 });
    }
  }
  lamp(p, "obscura", cx, cy, s * 0.038);
}

/**
 * III. 一笔. One stroke, top to bottom without lifting. It starts as the light, swings wider as a fir does,
 * and where the brush runs dry the stroke goes on as pixels.
 */
export function oneStroke(p: Painting, cx: number, cy: number, s: number) {
  const r = p.rng.fork("one-stroke");
  const top = cy - s * 0.8;
  const swings = 12;
  const node = (i: number): [number, number] => {
    const t = i / swings, side = i % 2 ? 1 : -1;
    return [cx + side * s * (0.06 + 0.5 * t ** 1.15) * (i === 0 ? 0 : 1), top + s * (0.1 + 1.5 * t ** 0.92)];
  };
  const HAND = 8; // the swings drawn in ink. The rest are pixels.
  const pts: Pt[] = [[cx, top, 0.5]];
  for (let i = 0; i <= HAND; i++) {
    const [x, y] = node(i);
    // Press on each turn, lighten across each swing.
    if (i > 0) {
      const [px, py] = node(i - 1);
      pts.push([(px + x) / 2 + r.float(-1, 1) * s * 0.01, (py + y) / 2 - s * 0.012, 0.62 - 0.03 * i]);
    }
    pts.push([x, y, i === HAND ? 0.3 : 1 - 0.04 * i]);
  }
  const ink = p.layer("one-stroke-ink");
  ink.stroke("ink", pts, { color: CHALK, size: s * 0.06, rough: 0.45 });
  ink.stroke("dry", pts.slice(-4), { color: CHALK, size: s * 0.06, bristles: 50, dryness: 0.5, streak: 1.3, wobble: 0.5, opacity: 1 });
  // The pixels: the same path, sampled onto a grid. They thin out and warm toward the end.
  const px = p.layer("one-stroke-pixels");
  px.draw(ctx => {
    const cell = s * 0.034;
    const seen = new Set<string>();
    for (let i = HAND; i < swings; i++) {
      const [ax, ay] = node(i), [bx, by] = node(i + 1);
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.5));
      for (let k = 0; k <= n; k++) {
        const t = (i - HAND + k / n) / (swings - HAND);
        for (const dy of [0, 1]) {
          const gx = Math.round((ax + (bx - ax) * (k / n)) / cell), gy = Math.round((ay + (by - ay) * (k / n)) / cell) + dy;
          const key = `${gx},${gy}`;
          if (seen.has(key) || r.float(0, 1) < t ** 1.5 * 0.8) continue;
          seen.add(key);
          ctx.fillStyle = r.float(0, 1) < 0.1 + 0.3 * t ? LIGHT : rgba(CHALK, 1 - 0.45 * t);
          const m = cell * 0.09;
          ctx.fillRect(gx * cell + m, gy * cell + m, cell - 2 * m, cell - 2 * m);
        }
      }
    }
  });
  lamp(p, "one-stroke", cx, top, s * 0.04);
}

export default function paint(p: Painting) {
  p.background = ROOM;
  p.layer("room").vgrad([ROOM, ROOM_LOW]);
  character(p, 512, 512, 420);
  obscura(p, 1536, 512, 440);
  oneStroke(p, 2560, 512, 440);
  p.post(grain(0.03));
}
