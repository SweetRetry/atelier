// 小日子 · 午睡 / Small Days · Nap. Second of four.
// Says: the afternoon is for sleeping. The cat is curled into a ball on a blue cushion.
// Focal point: the sleeping face at the left of the curl, pale orange against the blue of the cushion.
// Medium: colored pencil on warm paper, the same hand as 015.
import { grain, lch, loop, media, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1600, seed: 1 };

// ---------- the set: shared by 012 to 015, copied identically ----------
const PAPER = "#f6f0e3";
/** Light comes from the upper left, toward the viewer. */
const LIGHT = [-0.5, -0.6, 0.62] as const;
/** Slant of the hand. Every pencil leans this way, give or take. */
const HATCH = -0.9;
const fur = { light: lch(0.9, 0.08, 82), mid: lch(0.78, 0.14, 62), dark: lch(0.64, 0.15, 46), line: lch(0.47, 0.1, 42) };
const blush = lch(0.76, 0.12, 15);
const shadow = lch(0.56, 0.06, 300);
const leaf = { light: lch(0.8, 0.11, 125), mid: lch(0.64, 0.12, 150), dark: lch(0.46, 0.09, 165) };
const wood = { light: lch(0.9, 0.05, 85), mid: lch(0.76, 0.08, 68), line: lch(0.55, 0.08, 55) };
const wall = lch(0.86, 0.05, 55);
const pot = { light: lch(0.9, 0.03, 220), mid: lch(0.72, 0.06, 235), line: lch(0.5, 0.06, 245) };
type Tone = (x: number, y: number) => number;
type Coat = [string, Tone | number, number?];
/** Where a part sits: position, scale, and a tilt in radians. */
interface At {
  x: number;
  y: number;
  s: number;
  rot?: number;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const oval = (cx: number, cy: number, rx: number, ry: number, n = 48): Pt[] => Array.from({ length: n }, (_, i): Pt => [cx + rx * Math.cos((i / n) * 6.2832), cy + ry * Math.sin((i / n) * 6.2832)]);
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Local units to the sheet. */
const place = (at: At) => (pts: Pt[]): Pt[] => {
  const [c, s] = [Math.cos(at.rot ?? 0) * at.s, Math.sin(at.rot ?? 0) * at.s];
  return pts.map(([x, y, pr]): Pt => (pr === undefined ? [at.x + x * c - y * s, at.y + x * s + y * c] : [at.x + x * c - y * s, at.y + x * s + y * c, pr]));
};
/** The same window in every picture: its edges, the top of the sill under it, and the line of the hedge outside. */
const WIN = { x0: 290, y0: 250, x1: 1310, y1: 1090 };
const SILL = { top: 1090, edge: 1170, x0: 230, x1: 1370 };
const hedge = (x: number) => 680 + 46 * Math.sin(x / 83) + 30 * Math.sin(x / 37 + 1) + 22 * Math.sin(x / 19);
const bush: Tone = (x, y) => ss(-18, 18, y - hedge(x));
/** How much light a point on a rounded form of this size catches, 0..1. */
const round = (cx: number, cy: number, rx: number, ry: number): Tone => (x, y) => {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return clamp01(LIGHT[0] * nx + LIGHT[1] * ny + LIGHT[2] * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)));
};
/** Fur shading: a pale coat everywhere, orange where the form turns, a redder orange in the shadow. `white` thins all of it. */
const coat = (lit: Tone, white: Tone = () => 1): Coat[] => [
  [fur.light, (x, y) => 0.6 * white(x, y)],
  [fur.mid, (x, y) => (0.3 + 0.7 * (1 - lit(x, y))) * white(x, y)],
  [fur.dark, (x, y) => clamp01(0.75 - 1.5 * lit(x, y)) * white(x, y)],
];

function kit(p: Painting) {
  p.background = PAPER;
  const L = p.wet("pencil", { life: Infinity, impasto: 0 });
  const cp = { ...media.colored, size: 9 };
  /** Rub the shape back to paper, then lay pencils over each other. Each is [color, pressure, angle offset]. `keep` skips the rubbing out. */
  const form = (poly: Pt[], coats: Coat[], o: { size?: number; gap?: number; feather?: number; keep?: boolean } = {}) => {
    const { keep, ...rest } = o;
    if (!keep) L.lift(poly);
    coats.forEach(([color, tone, da], i) => L.hatch(poly, { ...cp, color, angle: HATCH + (da ?? [0, 0.22, -0.2, 0.4][i % 4]!), tone: typeof tone === "number" ? () => tone : tone, ...rest }));
  };
  /** A drawn line with a sharper point. */
  const line = (pts: Pt[], color: string, size = 5, o: Record<string, unknown> = {}) => L.stroke(pts, { ...media.colored, load: 0.85, tooth: 0.5, hardness: 0.7, color, size, thin: 0.6, taper: [0.08, 0.12], ...o });
  /** The contour of a form, pressed harder on the side away from the light. */
  const contour = (poly: Pt[], color: string, size = 5) => {
    const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length;
    const cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    // Long straight edges get points along them, so the line stays straight between corners.
    const pts: Pt[] = [];
    for (let i = 0; i <= poly.length; i++) {
      const [x0, y0] = poly[i % poly.length]!;
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      const k = i === poly.length ? 1 : Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 24));
      for (let j = 0; j < k; j++) {
        const [x, y] = [x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k];
        const d = Math.hypot(x - cx, y - cy) || 1;
        pts.push([x, y, 0.4 + 0.6 * clamp01(0.5 - 0.64 * ((LIGHT[0] * (x - cx)) / d + (LIGHT[1] * (y - cy)) / d))]);
      }
    }
    line(pts, color, size, { taper: [0.03, 0.03] });
  };
  /** A soft shadow lying on a surface. */
  const cast = (cx: number, cy: number, rx: number, ry: number, strength = 0.55) =>
    L.hatch(oval(cx, cy, rx, ry), { ...cp, color: shadow, angle: HATCH + 0.5, feather: ry * 0.9, tone: (x, y) => strength * (1 - Math.hypot((x - cx) / rx, (y - cy) / ry) ** 2) });
  /** The wall behind everything, as a vignette that fades into the paper. */
  const ground = (color: string, tone: Tone | number = 0.6) =>
    form(loop([[130, 840], [240, 300], [800, 190], [1360, 290], [1480, 840], [1390, 1400], [800, 1500], [220, 1410]]), [[color, tone]], { feather: 120, gap: 7 });

  /** The cat's head, 416 wide in its own units, origin at its middle. `face: false` is the back of it. */
  const catHead = (at: At, o: { face?: boolean } = {}) => {
    const T = place(at);
    const face = o.face ?? true;
    const S = at.s;
    const earL: Pt[] = [[-185, -60], [-158, -213], [-40, -135]];
    for (const ear of [earL, earL.map(([x, y]): Pt => [-x, y])]) {
      const e = loop(T(ear), 10);
      const [ex, ey] = T([[ear[1]![0] * 0.82, -135]])[0]!;
      form(e, coat(round(ex, ey, 90 * S, 90 * S)));
      if (face) form(loop(T(ear.map(([x, y]): Pt => [x * 0.9 + Math.sign(x) * 2, -135 + (y + 135) * 0.62])), 10), [[blush, 0.55]], { keep: true, size: 7 });
      contour(e, fur.line, 5);
    }
    const head = loop(T([[-208, 17], [-176, -83], [-86, -143], [0, -153], [86, -143], [176, -83], [208, 17], [150, 113], [0, 149], [-150, 113]]), 12);
    const [mx, my] = T([[0, 73]])[0]!;
    const muzzle: Tone = face ? (x, y) => ss(0.45, 1.1, Math.hypot((x - mx) / (92 * S), (y - my) / (62 * S))) : () => 1;
    form(head, coat(round(at.x, at.y, 215 * S, 160 * S), muzzle));
    contour(head, fur.line, 5.5);
    const stripe = (pts: Pt[]) => line(T(pts), fur.dark, 12 * S, { taper: [0.1, 0.5], load: 0.6 });
    if (!face) {
      for (const x of [-64, 0, 64]) stripe([[x, -147 + Math.abs(x) * 0.2], [x * 0.95, -80], [x * 0.85, -20]]);
      return;
    }
    for (const x of [-46, 0, 46]) stripe([[x, -147 + Math.abs(x) * 0.12], [x * 0.9, -117], [x * 0.8, -89]]);
    // Eyes shut, as two arcs.
    for (const sg of [-1, 1]) {
      line(T([[sg * 132, -3], [sg * 112, 13], [sg * 88, 19], [sg * 64, 13], [sg * 46, -3]]), fur.line, 6.5 * S, { load: 0.95, taper: [0.12, 0.12] });
      const [bx, by] = T([[sg * 138, 63]])[0]!;
      L.hatch(oval(bx, by, 44 * S, 28 * S), { ...cp, size: 7, color: blush, feather: 22 * S, tone: () => 0.6 });
      for (let k = 0; k < 3; k++) line(T([[sg * 150, 73 + k * 16, 0.9], [sg * 215, 59 + k * 24, 0.6], [sg * 262, 57 + k * 32, 0.1]]), fur.line, 3.5, { load: 0.6 });
    }
    form(loop(T([[-15, 43], [15, 43], [0, 61]]), 8), [[blush, 0.9], [fur.dark, 0.5]], { size: 6, gap: 2.5 });
    line(T([[0, 61], [0, 75]]), fur.line, 4);
    for (const sg of [-1, 1]) line(T([[0, 75], [sg * 14, 87], [sg * 30, 79]]), fur.line, 4, { taper: [0, 0.3] });
  };
  /** A fur shape: shaded, outlined, then striped. */
  const furry = (poly: Pt[], lit: Tone, white?: Tone) => {
    form(poly, coat(lit, white));
    contour(poly, fur.line, 5.5);
  };
  const stripe = (pts: Pt[], size = 12) => line(pts, fur.dark, size, { taper: [0.25, 0.35], load: 0.6 });
  /** The little plant in its blue pot, seen a little from above like the sill. x, y is the middle of the pot's foot. */
  const plant = (px: number, py: number) => {
    const foot = [-60, -40, -20, 0, 20, 40, 60].map((dx): Pt => [px + dx, py - 2 + 10 * Math.sqrt(1 - (dx / 62) ** 2)]);
    const shape: Pt[] = [[px - 78, py - 128], [px + 78, py - 128], ...foot.reverse()];
    form(shape, [[pot.light, 0.7], [pot.mid, (x) => 0.15 + 0.75 * ss(px - 50, px + 75, x)]]);
    contour(shape, pot.line, 5);
    const rim = oval(px, py - 128, 78, 15, 32);
    form(rim, [[wood.mid, 0.8], [fur.line, 0.5]], { size: 7 });
    contour(rim, pot.line, 4.5);
    for (const [dx, dy, r] of [[-70, -70, 40], [66, -50, 36], [-18, -150, 46], [50, -170, 34], [-92, -160, 30]] as const) {
      const [lx, ly] = [px + dx, py - 126 + dy];
      line([[px + dx * 0.08, py - 126, 0.6], [px + dx * 0.4, py - 126 + dy * 0.6, 0.8], [lx, ly, 0.5]], leaf.dark, 5);
      const d = oval(lx, ly, r, r * 0.9, 28);
      form(d, [[leaf.light, 0.75], [leaf.mid, (x, y) => 0.25 + 0.75 * (1 - round(lx, ly, r, r)(x, y))]], { size: 7 });
      contour(d, leaf.dark, 4);
    }
  };
  /** The window: a pale wooden frame and two panes filled by `view`. Returns the panes. */
  const win = (view: Coat[], o: { gap?: number } = {}) => {
    const { x0, y0, x1, y1 } = WIN;
    const frame = box(x0, y0, x1, y1);
    form(frame, [[wood.light, 0.8], [wood.mid, (_x, y) => 0.5 + 0.3 * ss(y0, y1, y)]]);
    const mid = (x0 + x1) / 2;
    const panes = [box(x0 + 44, y0 + 44, mid - 18, y1 - 20), box(mid + 18, y0 + 44, x1 - 44, y1 - 20)];
    for (const pane of panes) {
      form(pane, view, o);
      contour(pane, wood.line, 4);
    }
    contour(frame, wood.line, 5);
    return panes;
  };
  /** The windowsill everything sits on, seen a little from above: its top face, then its front. Nothing that rests on it may reach below SILL.edge. */
  const sill = () => {
    const top = box(SILL.x0, SILL.top, SILL.x1, SILL.edge);
    const front = box(SILL.x0 + 20, SILL.edge, SILL.x1 - 20, SILL.edge + 60);
    form(top, [[wood.light, 0.7], [wood.mid, 0.3]]);
    form(front, [[wood.light, 0.7], [wood.mid, 0.75], [shadow, 0.25]]);
    contour(top, wood.line, 5);
    contour(front, wood.line, 5);
  };
  /** Paper shows through evenly, so the sheet reads as one drawing. */
  const finish = () => p.post(grain(0.035, 2.4));
  return { L, cp, form, line, contour, cast, ground, catHead, furry, stripe, plant, win, sill, finish };
}
// ---------- end of the set ----------

const cush = { light: lch(0.86, 0.05, 262), mid: lch(0.68, 0.09, 258), dark: lch(0.5, 0.09, 268), line: lch(0.42, 0.08, 266) };
const yarn = { light: lch(0.86, 0.07, 10), mid: lch(0.7, 0.13, 8), line: lch(0.5, 0.11, 5) };

export default function paint(p: Painting) {
  const { form, line, contour, cast, ground, catHead, furry, stripe, finish } = kit(p);
  ground(wall, 0.5);

  // ---------- a round cushion, seen from above and a little to the front ----------
  cast(900, 1290, 560, 90, 0.9);
  const side = oval(800, 1010, 545, 310);
  form(side, [[cush.mid, 0.9], [cush.dark, (_x, y) => 0.25 + 0.6 * ss(1050, 1320, y)]]);
  contour(side, cush.line, 5.5);
  const top = oval(800, 950, 545, 310);
  form(top, [[cush.light, 0.75], [cush.mid, (x, y) => 0.3 + 0.6 * (1 - round(800, 950, 600, 350)(x, y))]]);
  contour(top, cush.line, 5.5);
  // A stitched seam round the top.
  for (let i = 0; i < 44; i++) {
    const [a, b] = [(i / 44) * 6.2832, ((i + 0.55) / 44) * 6.2832];
    line([[800 + 478 * Math.cos(a), 950 + 262 * Math.sin(a)], [800 + 478 * Math.cos(b), 950 + 262 * Math.sin(b)]], cush.line, 4, { load: 0.6 });
  }
  cast(900, 1010, 380, 200, 0.95);

  // ---------- the cat, curled. Body first, then tail, paw and head over it ----------
  const body = loop([[515, 900], [560, 735], [720, 645], [900, 635], [1060, 700], [1140, 840], [1110, 985], [980, 1075], [780, 1095], [600, 1045]], 14);
  furry(body, round(830, 860, 340, 245));
  for (let k = 0; k < 6; k++) {
    const a = -2.0 + k * 0.4;
    const q = (r: number): Pt => [830 + 312 * r * Math.cos(a), 868 + 228 * r * Math.sin(a)];
    stripe([q(0.99), q(0.86), q(0.7)]);
  }
  // The haunch, as one line.
  line([[1035, 760, 0.3], [945, 820, 0.8], [925, 930, 1], [985, 1030, 0.4]], fur.line, 5);
  const tail = loop([[1098, 1005], [1118, 1050], [1040, 1115], [860, 1145], [690, 1128], [655, 1092], [690, 1062], [860, 1078], [1000, 1050], [1062, 1000]], 10);
  furry(tail, round(880, 1095, 270, 62));
  for (const x of [1010, 930, 850, 770]) stripe([[x + 6, 1052 + (1010 - x) * 0.08], [x, 1092], [x - 8, 1128 - (x - 770) * 0.05]], 10);
  const paw = oval(742, 1062, 62, 33, 30);
  form(paw, [[fur.light, 0.45], [fur.mid, (_x, y) => 0.5 * ss(1040, 1095, y)]], { size: 7 });
  contour(paw, fur.line, 5);
  for (const t of [-16, 12]) line([[742 + t, 1076], [742 + t + 2, 1092]], fur.line, 3.5);
  catHead({ x: 610, y: 925, s: 0.9, rot: -0.2 });

  // ---------- sleep, and a ball of yarn ----------
  for (const [x, y, s] of [[395, 640, 26], [335, 560, 36], [262, 462, 48]] as const) {
    line([[x, y], [x + s, y - s * 0.12]], cush.line, 4.5);
    line([[x + s, y - s * 0.12], [x + s * 0.1, y + s * 0.9]], cush.line, 4.5);
    line([[x + s * 0.1, y + s * 0.9], [x + s * 1.1, y + s * 0.78]], cush.line, 4.5);
  }
  line([[1235, 1345, 0.8], [1120, 1395, 1], [1010, 1368, 0.8], [930, 1408, 0.9], [840, 1392, 0.5]], yarn.line, 4.5);
  cast(1320, 1362, 110, 22, 0.8);
  const ball = oval(1290, 1295, 82, 80, 36);
  form(ball, [[yarn.light, 0.75], [yarn.mid, (x, y) => 0.2 + 0.8 * (1 - round(1290, 1295, 82, 80)(x, y))]]);
  contour(ball, yarn.line, 5);
  for (const [a, w] of [[-0.6, 0.9], [-0.25, 0.55], [0.15, 0.2], [0.9, 0.6], [1.3, 0.25]] as const) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    line([-1, -0.5, 0, 0.5, 1].map((t): Pt => [1290 + 76 * (t * Math.sqrt(1 - w * w) * c - w * s * (1 - 0.25 * t * t)), 1295 + 76 * (t * Math.sqrt(1 - w * w) * s + w * c * (1 - 0.25 * t * t))]), yarn.line, 3.5, { load: 0.6 });
  }
  finish();
}
