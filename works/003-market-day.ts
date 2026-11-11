// 赶集图 / Market Day
// An old town on market day, seen from above the near rooftops. Ruled-line buildings, a canal with an arch bridge,
// and a crowd that is generated figure by figure. Ink line and mineral color on aged silk.
import { clamp, type Ctx, grain, type Layer, lch, lerp, type Meta, mix, type Painting, rgba, type Rng, shift, silk, vignette } from "../engine/index.ts";

export const meta: Meta = { width: 3600, height: 2300, seed: 7 };

const W = 3600;
const H = 2300;
type V = [number, number];

// ---------- projection: parallel oblique. x runs along the street, z goes into depth, h is height. ----------
const G0 = 2230;
const KX = 0.3;
const KY = 0.5;
const P = (x: number, z: number, h = 0): V => [x + KX * z, G0 - KY * z - h];
/** Height of an adult in logical units. Nothing shrinks with distance, as in a handscroll. */
const FH = 118;

// ---------- palette ----------
const SILK = lch(0.8, 0.055, 82);
const INK = lch(0.25, 0.02, 60);
const HAIR = lch(0.2, 0.01, 60);
const DARK = lch(0.31, 0.03, 50);
const TILE = lch(0.5, 0.022, 235);
const WOOD = lch(0.52, 0.07, 55);
const WOODR = lch(0.44, 0.1, 35);
const PLASTER = lch(0.87, 0.03, 88);
const STONE = lch(0.74, 0.02, 85);
const STRAW = lch(0.76, 0.08, 85);
const WATER = lch(0.71, 0.04, 185);
const RED = lch(0.55, 0.16, 30);
const GOLD = lch(0.8, 0.11, 85);
const FONT = '"Songti SC"';
const far = (c: string, f: number) => (f ? mix(c, SILK, f) : c);

const WHITE = lch(0.9, 0.02, 90);
const PLAIN = [WHITE, WHITE, lch(0.8, 0.03, 85), lch(0.7, 0.03, 240), lch(0.62, 0.015, 80), lch(0.72, 0.06, 75), lch(0.5, 0.05, 250)];
const ROBE = [WHITE, lch(0.47, 0.06, 255), lch(0.38, 0.05, 262), lch(0.68, 0.085, 75), lch(0.52, 0.06, 55), lch(0.6, 0.075, 155), lch(0.72, 0.03, 240), lch(0.55, 0.14, 32), lch(0.46, 0.06, 330), lch(0.8, 0.08, 92)];
const BRIGHT = [lch(0.6, 0.14, 28), lch(0.8, 0.06, 15), lch(0.64, 0.08, 155), lch(0.78, 0.05, 140), WHITE, lch(0.8, 0.09, 92), lch(0.6, 0.07, 250)];
const SKIRT = [WHITE, lch(0.62, 0.08, 155), lch(0.55, 0.14, 30), lch(0.5, 0.06, 255), lch(0.82, 0.05, 20), lch(0.7, 0.08, 80)];
const KID = [lch(0.6, 0.16, 30), lch(0.66, 0.1, 150), lch(0.82, 0.1, 92), WHITE];
const TROUSER = [WHITE, lch(0.78, 0.03, 85), lch(0.6, 0.02, 240), lch(0.5, 0.04, 255), lch(0.66, 0.05, 70)];
const SASH = [DARK, lch(0.55, 0.14, 32), lch(0.4, 0.05, 255), lch(0.7, 0.085, 80)];
const SKINS = [lch(0.83, 0.05, 62), lch(0.79, 0.06, 60), lch(0.74, 0.065, 58)];
const CLOTHS = [lch(0.55, 0.14, 30), lch(0.47, 0.06, 255), lch(0.64, 0.08, 155), WHITE, lch(0.78, 0.09, 88), lch(0.8, 0.06, 15)];

// ---------- drawing primitives ----------
function trace(ctx: Ctx, pts: V[], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
function paintPath(ctx: Ctx, fill: string | null, line: string | null, lw: number) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (line && lw > 0) {
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function shape(ctx: Ctx, pts: V[], fill: string | null, line: string | null = INK, lw = 1.5, close = true) {
  trace(ctx, pts, close);
  paintPath(ctx, fill, line, lw);
}
/** Closed blob with every corner rounded. */
function soft(ctx: Ctx, pts: V[], fill: string | null, line: string | null = INK, lw = 1.3) {
  const n = pts.length;
  const mid = (a: V, b: V): V => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const m0 = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i]!, pts[(i + 1) % n]!);
    ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], m[0], m[1]);
  }
  ctx.closePath();
  paintPath(ctx, fill, line, lw);
}
function dot(ctx: Ctx, x: number, y: number, rx: number, fill: string | null, line: string | null = null, lw = 1, ry = rx) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  paintPath(ctx, fill, line, lw);
}
function seg(ctx: Ctx, a: V, b: V, col: string = INK, lw = 1.2) {
  shape(ctx, [a, b], null, col, lw, false);
}
/** An outlined tube: sleeves, legs, necks. */
function limb(ctx: Ctx, pts: V[], w: number, col: string, lw = 1.2) {
  trace(ctx, pts, false);
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + lw * 2;
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
}
/** Rectangle in a plane facing the viewer. */
function fr(ctx: Ctx, x0: number, x1: number, z: number, h0: number, h1: number, fill: string | null, line: string | null = INK, lw = 1.3) {
  shape(ctx, [P(x0, z, h0), P(x1, z, h0), P(x1, z, h1), P(x0, z, h1)], fill, line, lw);
}
function label(ctx: Ctx, s: string, x: number, y: number, size: number, col: string, vertical = true) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = col;
  if (vertical) [...s].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.08));
  else ctx.fillText(s, x, y);
}

// ---------- figures ----------
interface Fig {
  x: number;
  z: number;
  h?: number;
  s: number;
  dir: 1 | -1;
  back: boolean;
  kind: "robe" | "short" | "woman" | "child" | "monk";
  c1: string;
  c2: string;
  hat: string;
  arm: string;
  prop?: string;
  walk: boolean;
  skin: string;
  beard: boolean;
  /** Per-figure variation, 0..1. */
  v: number;
}

function mkFig(r: Rng, x: number, z: number, o: Partial<Fig> = {}): Fig {
  const u = r.next();
  const kind = o.kind ?? (u < 0.36 ? "short" : u < 0.67 ? "robe" : u < 0.85 ? "woman" : u < 0.97 ? "child" : "monk");
  const s = kind === "child" ? r.float(0.52, 0.7) : kind === "woman" ? r.float(0.9, 0.96) : r.float(0.96, 1.05);
  const c1 = kind === "short" ? r.pick(PLAIN) : kind === "woman" ? r.pick(BRIGHT) : kind === "child" ? r.pick(KID) : kind === "monk" ? lch(0.6, 0.03, 80) : r.pick(ROBE);
  const c2 = kind === "woman" ? r.pick(SKIRT) : kind === "short" || kind === "child" ? r.pick(TROUSER) : r.pick(SASH);
  const hat =
    kind === "short" ? r.pick(["knot", "knot", "douli", "scarf", "douli"]) : kind === "robe" ? r.pick(["futou", "futou", "knot", "scarf"]) : kind === "woman" ? r.pick(["bun", "bun", "scarf"]) : kind === "child" ? "tufts" : "bald";
  const arm = r.pick(kind === "robe" || kind === "monk" ? ["sleeves", "sleeves", "down", "point", "hold"] : ["down", "down", "hold", "point"]);
  let prop: string | undefined;
  if (kind === "short" && r.chance(0.42)) prop = r.pick(["pole", "pole", "sack", "backbasket", "bundle"]);
  else if (kind === "robe" && r.chance(0.28)) prop = r.pick(["fan", "umbrella", "staff", "cage"]);
  else if (kind === "woman" && r.chance(0.4)) prop = r.pick(["basket", "umbrella", "basket"]);
  else if (kind === "child" && r.chance(0.4)) prop = "pinwheel";
  return { x, z, s, kind, c1, c2, hat, arm, prop, dir: r.chance(0.5) ? 1 : -1, back: false, walk: r.chance(0.7), skin: r.pick(SKINS), beard: kind === "robe" && r.chance(0.35), v: r.next(), ...o };
}

function figure(ctx: Ctx, f: Fig) {
  const [sx, sy] = P(f.x, f.z, f.h ?? 0);
  const k = (FH / 100) * f.s;
  ctx.save();
  ctx.translate(sx, sy);
  dot(ctx, 3, 1, 17 * k, rgba(INK, 0.13), null, 0, 4.5 * k);
  ctx.scale(f.dir * k, k);
  ctx.rotate(f.walk ? 0.03 + f.v * 0.06 : (f.v - 0.5) * 0.05);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const long = f.kind === "robe" || f.kind === "woman" || f.kind === "monk";
  const prop = f.prop;
  const arm = prop === "pole" || prop === "sack" || prop === "bundle" ? "carry" : prop === "cage" || prop === "basket" ? "down" : prop && prop !== "backbasket" ? "hold" : f.arm;
  const sw = long ? 7.5 : 5.5;
  const st = f.walk ? 8 : 3;
  const c1d = shift(f.c1, { l: -0.06 });
  const v2 = (f.v * 7.3) % 1;

  if (prop === "backbasket") {
    shape(ctx, [[-18, -83], [-7, -83], [-8, -55], [-16, -55]], STRAW, INK, 1.1);
    dot(ctx, -12.5, -84, 6, v2 < 0.5 ? lch(0.62, 0.09, 140) : lch(0.6, 0.05, 60), INK, 1, 4);
  }
  // Far arm.
  const sway = f.walk ? 4 : 0;
  const farArm: V[] = arm === "sleeves" ? [[-2, -78], [4, -61], [13, -59]] : prop === "pole" ? [[-3, -78], [-10, -76], [-11, -85]] : [[-3, -78], [-6 - sway, -62], [-7 - sway * 1.6, -47]];
  limb(ctx, farArm, sw, c1d);
  // Legs and shoes.
  if (!long) {
    limb(ctx, [[-2, -46], [-st - 1, -24], [-st, -5]], 6.5, shift(f.c2, { l: -0.05 }));
    limb(ctx, [[2, -46], [st + 2, -25], [st, -5]], 6.5, f.c2);
    dot(ctx, -st + 2, -2.5, 5, DARK, null, 0, 2.4);
    dot(ctx, st + 2.5, -2.5, 5, DARK, null, 0, 2.4);
  } else {
    dot(ctx, -4, -2.5, 5, DARK, null, 0, 2.4);
    dot(ctx, 7 + (f.walk ? 4 : 0), -2.5, 5, DARK, null, 0, 2.4);
  }
  // Body.
  const fold = rgba(INK, 0.45);
  if (f.kind === "woman") {
    shape(ctx, [[-7, -60], [7, -60], [13 + (f.walk ? 2 : 0), -5], [-12, -4]], f.c2, INK, 1.2);
    for (const [a, b] of [[-3, -8], [1, -1], [4, 7]] as V[]) seg(ctx, [a, -56], [b, -6], fold, 0.8);
    shape(ctx, [[-7.5, -81], [0, -85], [7.5, -81], [9, -57], [-9, -57]], f.c1, INK, 1.2);
    if (!f.back) seg(ctx, [2, -57], [5, -22], v2 < 0.5 ? RED : lch(0.8, 0.09, 92), 2);
  } else if (long) {
    shape(ctx, [[-8.5, -81], [0, -85], [8.5, -81], [10, -62], [8.5, -49], [14 + (f.walk ? 2 : 0), -7], [-13, -6], [-8.5, -49], [-10, -64]], f.c1, INK, 1.2);
    seg(ctx, [-2, -46], [-5, -8], fold, 0.8);
    seg(ctx, [4, -46], [8, -9], fold, 0.8);
    shape(ctx, [[-8.7, -53], [8.7, -53], [8.7, -48.5], [-8.7, -48.5]], f.c2, INK, 0.8);
    if (f.kind === "monk") seg(ctx, [-8, -80], [9, -55], lch(0.62, 0.11, 70), 4.5);
  } else {
    shape(ctx, [[-8.5, -81], [0, -85], [8.5, -81], [10, -60], [9.5, -39], [-9.5, -39], [-10, -62]], f.c1, INK, 1.2);
    shape(ctx, [[-9.6, -52], [9.6, -52], [9.6, -48], [-9.6, -48]], v2 < 0.3 ? RED : DARK, null);
  }
  if (!f.back) shape(ctx, [[-3.5, -84.5], [3.5, -84.5], [1, -75]], WHITE, INK, 0.7);
  // Near arm.
  let hand: V | null = null;
  let nearArm: V[];
  if (arm === "sleeves") nearArm = [[3, -78], [6, -62], [13, -60]];
  else if (arm === "point") [nearArm, hand] = [[[3, -78], [12, -73], [23, -80]], [24.5, -81]];
  else if (arm === "hold") [nearArm, hand] = [[[3, -78], [7, -63], [15, -60]], [16.5, -60]];
  else if (arm === "carry") [nearArm, hand] = [[[3, -78], [10, -76], [9, -86]], [9, -87.5]];
  else if (arm === "up") [nearArm, hand] = [[[3, -78], [10, -89], [12, -99]], [12.5, -101]];
  else if (arm === "push") [nearArm, hand] = [[[3, -78], [12, -66], [22, -58]], [23.5, -57.5]];
  else [nearArm, hand] = [[[3, -78], [5 + sway * 0.6, -62], [6 + sway, -46]], [6 + sway, -43.5]];
  limb(ctx, nearArm, sw, f.c1);
  if (hand) dot(ctx, hand[0], hand[1], 2.3, f.skin, INK, 0.7);
  // Head.
  shape(ctx, [[-2, -87], [2.5, -87], [2.5, -82], [-2, -82]], f.skin, null);
  const bald = f.hat === "bald";
  dot(ctx, 1, -92, 5.8, f.back && !bald ? HAIR : f.skin, INK, 1, 6.6);
  if (!f.back) {
    if (!bald) shape(ctx, [[-5.2, -89], [-5.7, -95], [-1, -98.8], [4.5, -98], [6.6, -94.5], [2, -95.5], [-1.5, -93], [-2, -88]], HAIR, null);
    dot(ctx, 4.3, -91.6, 0.75, INK);
    if (f.beard) shape(ctx, [[2.5, -87], [6.8, -87.6], [5, -80.5]], HAIR, null);
  }
  switch (f.hat) {
    case "knot":
      dot(ctx, -0.5, -100.3, 2.7, HAIR);
      seg(ctx, [-3, -98.4], [2, -98.6], v2 < 0.5 ? WHITE : lch(0.5, 0.06, 250), 1.4);
      break;
    case "futou":
      shape(ctx, [[-6.2, -91], [-6, -97], [-2, -101.5], [3, -101], [6.8, -96], [6.5, -94.5], [-1, -94]], HAIR, null);
      seg(ctx, [-5, -93], [-11.5, -88], HAIR, 1.3);
      seg(ctx, [-5, -94], [-11, -91.5], HAIR, 1.3);
      break;
    case "scarf":
      shape(ctx, [[-6.2, -91], [-6, -97], [-2, -100.5], [3.5, -100], [6.8, -96], [6.5, -94.5], [-1, -94]], f.kind === "woman" ? lch(0.52, 0.06, 250) : WHITE, INK, 0.8);
      break;
    case "douli":
      shape(ctx, [[-16, -94], [1, -106.5], [18, -94.5], [1, -91.5]], STRAW, INK, 1);
      seg(ctx, [1, -106], [-6, -93], rgba(INK, 0.4), 0.7);
      seg(ctx, [1, -106], [8, -93], rgba(INK, 0.4), 0.7);
      break;
    case "bun":
      dot(ctx, -1.5, -101, 3.8, HAIR);
      dot(ctx, -4.5, -98.5, 2.6, HAIR);
      dot(ctx, 2.3, -100.5, 1.2, v2 < 0.5 ? RED : GOLD);
      break;
    case "tufts":
      dot(ctx, -4, -98, 2.1, HAIR);
      dot(ctx, 4.8, -98, 2.1, HAIR);
      break;
  }
  // Things carried.
  const basket = (e: number, top: number) => {
    seg(ctx, [e, top - 37], [e - 7, top], rgba(INK, 0.7), 0.8);
    seg(ctx, [e, top - 37], [e + 7, top], rgba(INK, 0.7), 0.8);
    if (f.v < 0.5) {
      shape(ctx, [[e - 9, top], [e + 9, top], [e + 7, top + 17], [e - 7, top + 17]], STRAW, INK, 1);
      seg(ctx, [e - 8, top + 6], [e + 8, top + 6], rgba(INK, 0.4), 0.7);
      seg(ctx, [e - 7.5, top + 11.5], [e + 7.5, top + 11.5], rgba(INK, 0.4), 0.7);
      dot(ctx, e, top, 8.5, [lch(0.62, 0.1, 140), lch(0.62, 0.15, 35), WHITE, lch(0.75, 0.11, 80)][Math.floor(v2 * 4)]!, INK, 0.8, 4.5);
    } else if (f.v < 0.75) {
      shape(ctx, [[e - 7, top], [e + 7, top], [e + 6, top + 17], [e - 6, top + 17]], WOOD, INK, 1);
      seg(ctx, [e - 6.6, top + 5], [e + 6.6, top + 5], DARK, 1);
      seg(ctx, [e - 6.2, top + 12], [e + 6.2, top + 12], DARK, 1);
    } else {
      shape(ctx, [[e - 8, top - 10], [e + 8, top - 10], [e + 8, top + 17], [e - 8, top + 17]], lch(0.42, 0.1, 30), INK, 1);
      seg(ctx, [e - 8, top - 1], [e + 8, top - 1], GOLD, 0.9);
      seg(ctx, [e - 8, top + 8], [e + 8, top + 8], GOLD, 0.9);
    }
  };
  switch (prop) {
    case "pole":
      ctx.strokeStyle = lch(0.4, 0.06, 55);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-37, -82);
      ctx.quadraticCurveTo(0, -90, 37, -82);
      ctx.stroke();
      basket(-35, -45);
      basket(35, -45);
      break;
    case "sack":
      soft(ctx, [[-17, -92], [-8, -100], [8, -99], [13, -92], [6, -85], [-12, -84]], lch(0.84, 0.035, 85), INK, 1.1);
      break;
    case "bundle":
      seg(ctx, [10, -84], [-17, -93], lch(0.4, 0.06, 55), 1.8);
      dot(ctx, -18, -92, 7, [lch(0.5, 0.06, 250), lch(0.62, 0.1, 80), WHITE][Math.floor(v2 * 3)]!, INK, 1, 6);
      break;
    case "umbrella":
      seg(ctx, [16.5, -56], [14, -122], lch(0.4, 0.06, 55), 1.5);
      shape(ctx, [[-10, -113], [14, -127], [38, -113], [14, -116.5]], v2 < 0.5 ? lch(0.7, 0.1, 78) : lch(0.55, 0.1, 40), INK, 1);
      for (const e of [-1, 7, 21, 29]) seg(ctx, [14, -127], [e, -115], rgba(INK, 0.45), 0.7);
      break;
    case "fan":
      seg(ctx, [16.5, -60], [20, -66], DARK, 1.2);
      dot(ctx, 22, -70, 5.5, WHITE, INK, 0.8);
      break;
    case "staff":
      seg(ctx, [18, 0], [15.5, -80], lch(0.38, 0.05, 55), 1.9);
      break;
    case "cage":
      seg(ctx, [6 + sway, -43], [8 + sway, -37], INK, 0.8);
      shape(ctx, [[2 + sway, -37], [14 + sway, -37], [14 + sway, -22], [2 + sway, -22]], rgba(STRAW, 0.6), INK, 0.9);
      for (const e of [5, 8, 11]) seg(ctx, [e + sway, -37], [e + sway, -22], INK, 0.5);
      break;
    case "basket":
      shape(ctx, [[0 + sway, -40], [13 + sway, -40], [11 + sway, -29], [2 + sway, -29]], STRAW, INK, 0.9);
      dot(ctx, 6.5 + sway, -40, 6, v2 < 0.5 ? lch(0.62, 0.1, 140) : lch(0.62, 0.15, 35), INK, 0.7, 3);
      break;
    case "pinwheel":
      seg(ctx, [16.5, -60], [20, -82], DARK, 1);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + f.v * 3;
        shape(ctx, [[20, -82], [20 + Math.cos(a) * 6, -82 + Math.sin(a) * 6], [20 + Math.cos(a + 0.9) * 4.5, -82 + Math.sin(a + 0.9) * 4.5]], i % 2 ? RED : lch(0.82, 0.1, 92), INK, 0.6);
      }
      break;
    case "tanghulu":
      seg(ctx, [14, 0], [15.5, -128], lch(0.4, 0.06, 55), 2);
      soft(ctx, [[8, -108], [16, -134], [24, -108]], STRAW, INK, 1);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        const b: V = [16 + Math.cos(a) * 9, -121 + Math.sin(a) * 9];
        const e: V = [16 + Math.cos(a) * 25, -121 + Math.sin(a) * 25];
        seg(ctx, b, e, DARK, 0.7);
        for (let j = 0; j < 3; j++) dot(ctx, lerp(b[0], e[0], 0.45 + j * 0.25), lerp(b[1], e[1], 0.45 + j * 0.25), 2.1, RED, null);
      }
      break;
    case "whip":
      seg(ctx, [16.5, -60], [30, -92], DARK, 1);
      shape(ctx, [[30, -92], [40, -84], [38, -70]], null, rgba(INK, 0.7), 0.7, false);
      break;
  }
  ctx.restore();
}

// ---------- animals and vehicles ----------
function beast(ctx: Ctx, x: number, z: number, dir: number, kind: "donkey" | "ox" | "horse" | "dog", col: string, packs = false) {
  const [sx, sy] = P(x, z);
  const k = { donkey: 1.1, ox: 1.38, horse: 1.5, dog: 0.46 }[kind];
  ctx.save();
  ctx.translate(sx, sy);
  dot(ctx, 0, 1, 40 * k, rgba(INK, 0.13), null, 0, 6 * k);
  ctx.scale(dir * k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const cd = shift(col, { l: -0.07 });
  limb(ctx, [[-20, -40], [-24, -20], [-21, -3]], 5.5, cd);
  limb(ctx, [[20, -40], [24, -20], [21, -3]], 5.5, cd);
  ctx.strokeStyle = kind === "horse" ? HAIR : INK;
  ctx.lineWidth = kind === "horse" ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(-30, -55);
  if (kind === "dog") ctx.quadraticCurveTo(-40, -62, -38, -76);
  else ctx.quadraticCurveTo(-39, -46, -35, -26);
  ctx.stroke();
  const hd: V = kind === "ox" ? [45, -52] : kind === "horse" ? [41, -84] : kind === "dog" ? [40, -64] : [43, -73];
  const mz: V = [hd[0] + 13, hd[1] + (kind === "ox" ? 6 : 9)];
  limb(ctx, [[23, -51], hd], kind === "ox" ? 16 : 12, col);
  if (kind === "horse") seg(ctx, [22, -60], [37, -88], HAIR, 3.5);
  if (kind === "donkey") {
    limb(ctx, [[hd[0] - 3, hd[1] - 4], [hd[0] - 7, hd[1] - 19]], 3, col, 1);
    limb(ctx, [[hd[0] + 1, hd[1] - 5], [hd[0] + 1, hd[1] - 20]], 3, col, 1);
  } else if (kind === "ox") {
    shape(ctx, [[hd[0] - 3, hd[1] - 6], [hd[0] - 1, hd[1] - 15], [hd[0] + 7, hd[1] - 19]], null, lch(0.85, 0.03, 90), 3, false);
    shape(ctx, [[hd[0] - 3, hd[1] - 6], [hd[0] - 1, hd[1] - 15], [hd[0] + 7, hd[1] - 19]], null, INK, 0.9, false);
  } else {
    limb(ctx, [[hd[0] - 2, hd[1] - 5], [hd[0] - 3, hd[1] - 11]], 2.5, col, 1);
  }
  limb(ctx, [hd, mz], kind === "ox" ? 11 : 8, col);
  dot(ctx, hd[0] + 3, hd[1] - 1, 1.1, INK);
  soft(ctx, [[-32, -56], [-12, -65], [16, -63], [31, -56], [32, -40], [14, -32], [-14, -32], [-32, -42]], col, INK, 1.3);
  limb(ctx, [[-24, -40], [-21, -20], [-25, -3]], 6, col);
  limb(ctx, [[24, -40], [20, -20], [25, -3]], 6, col);
  for (const e of [-25, 25, -21, 21]) dot(ctx, e, -2, 3.4, DARK, null, 0, 2.2);
  if (packs) {
    soft(ctx, [[-22, -62], [-18, -78], [-2, -80], [2, -62], [-2, -48], [-18, -48]], lch(0.82, 0.04, 85), INK, 1.2);
    soft(ctx, [[0, -63], [4, -79], [20, -78], [23, -62], [18, -49], [3, -49]], lch(0.74, 0.06, 80), INK, 1.2);
    seg(ctx, [-10, -79], [-10, -48], rgba(INK, 0.6), 0.9);
    seg(ctx, [12, -79], [12, -49], rgba(INK, 0.6), 0.9);
  }
  ctx.restore();
}

function cart(ctx: Ctx, x: number, z: number, dir: number) {
  const [sx, sy] = P(x, z);
  ctx.save();
  ctx.translate(sx, sy);
  dot(ctx, 0, 2, 80, rgba(INK, 0.13), null, 0, 9);
  ctx.scale(dir * 1.18, 1.18);
  const wood = lch(0.46, 0.06, 50);
  seg(ctx, [40, -52], [118, -62], INK, 5.4);
  seg(ctx, [40, -52], [118, -62], wood, 3);
  shape(ctx, [[-62, -58], [48, -58], [48, -48], [-62, -48]], wood, INK, 1.3);
  // Load of sacks under a mat.
  for (const [a, b] of [[-45, -70], [-18, -72], [10, -70], [-32, -90], [-4, -91]] as V[]) dot(ctx, a, b, 17, lch(0.83, 0.04, 86), INK, 1.2, 12);
  soft(ctx, [[-40, -104], [8, -106], [26, -92], [-4, -97], [-52, -92]], STRAW, INK, 1.2);
  shape(ctx, [[-62, -58], [-62, -92]], null, INK, 2.4, false);
  shape(ctx, [[48, -58], [48, -86]], null, INK, 2.4, false);
  // Wheel.
  dot(ctx, -4, -36, 36, rgba(SILK, 0.35), INK, 2);
  dot(ctx, -4, -36, 31, null, wood, 5);
  dot(ctx, -4, -36, 28, null, INK, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    seg(ctx, [-4 + Math.cos(a) * 6, -36 + Math.sin(a) * 6], [-4 + Math.cos(a) * 28, -36 + Math.sin(a) * 28], INK, 1.5);
  }
  dot(ctx, -4, -36, 6.5, wood, INK, 1.2);
  ctx.restore();
}

function sedan(ctx: Ctx, x: number, z: number) {
  const [sx, sy] = P(x, z);
  ctx.save();
  ctx.translate(sx, sy);
  dot(ctx, 0, 2, 44, rgba(INK, 0.13), null, 0, 7);
  seg(ctx, [-100, -72], [100, -72], INK, 5);
  seg(ctx, [-100, -72], [100, -72], WOODR, 2.8);
  shape(ctx, [[-30, -16], [30, -16], [30, -104], [-30, -104]], lch(0.5, 0.07, 150), INK, 1.4);
  shape(ctx, [[-17, -90], [17, -90], [17, -52], [-17, -52]], lch(0.86, 0.04, 88), INK, 1);
  shape(ctx, [[-17, -90], [17, -90], [17, -74], [-17, -74]], RED, INK, 0.9);
  for (const e of [-9, 0, 9]) seg(ctx, [e, -74], [e, -52], rgba(INK, 0.35), 0.7);
  shape(ctx, [[-36, -104], [36, -104], [24, -118], [-24, -118]], lch(0.36, 0.05, 150), INK, 1.3);
  dot(ctx, 0, -121, 4, GOLD, INK, 0.9);
  shape(ctx, [[-30, -16], [30, -16], [30, -24], [-30, -24]], WOODR, INK, 1);
  ctx.restore();
}

function barrow(ctx: Ctx, x: number, z: number, dir: number) {
  const [sx, sy] = P(x, z);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(dir * 1.18, 1.18);
  const wood = lch(0.46, 0.06, 50);
  dot(ctx, 22, -17, 17, rgba(SILK, 0.3), INK, 1.6);
  dot(ctx, 22, -17, 14, null, wood, 3.4);
  for (let i = 0; i < 8; i++) seg(ctx, [22, -17], [22 + Math.cos((i * Math.PI) / 4) * 13, -17 + Math.sin((i * Math.PI) / 4) * 13], INK, 1);
  limb(ctx, [[34, -22], [-6, -38], [-30, -50]], 3, wood);
  seg(ctx, [-8, -38], [-10, -6], INK, 2.4);
  dot(ctx, 14, -50, 16, lch(0.83, 0.04, 86), INK, 1.2, 11);
  dot(ctx, -3, -52, 14, lch(0.76, 0.06, 80), INK, 1.2, 10);
  dot(ctx, 6, -67, 14, lch(0.83, 0.04, 86), INK, 1.2, 9);
  ctx.restore();
}

function boat(ctx: Ctx, x: number, z: number, len: number, f: number, covered: boolean) {
  const [cx, cy] = P(x, z, -40);
  const ux = (KX * len) / 2;
  const uy = (-KY * len) / 2;
  const bw = 34;
  const line = rgba(INK, 0.9 - f * 0.5);
  soft(ctx, [[cx - ux * 1.15, cy - uy * 1.15], [cx - ux * 0.6 + bw, cy - uy * 0.6], [cx + ux * 0.6 + bw, cy + uy * 0.6], [cx + ux * 1.15, cy + uy * 1.15], [cx + ux * 0.6 - bw, cy + uy * 0.6], [cx - ux * 0.6 - bw, cy - uy * 0.6]], far(lch(0.42, 0.05, 55), f), line, 1.5);
  soft(ctx, [[cx - ux * 0.95, cy - uy * 0.95 - 4], [cx - ux * 0.5 + bw * 0.7, cy - uy * 0.5 - 5], [cx + ux * 0.5 + bw * 0.7, cy + uy * 0.5 - 5], [cx + ux * 0.95, cy + uy * 0.95 - 4], [cx + ux * 0.5 - bw * 0.7, cy + uy * 0.5 - 5], [cx - ux * 0.5 - bw * 0.7, cy - uy * 0.5 - 5]], far(lch(0.62, 0.06, 70), f), line, 1);
  if (covered) {
    const a: V = [cx - ux * 0.4, cy - uy * 0.4];
    const b: V = [cx + ux * 0.45, cy + uy * 0.45];
    shape(ctx, [[a[0] - bw * 0.75, a[1] - 6], [a[0] - bw * 0.4, a[1] - 34], [a[0] + bw * 0.4, a[1] - 34], [a[0] + bw * 0.75, a[1] - 6], [b[0] + bw * 0.75, b[1] - 6], [b[0] + bw * 0.4, b[1] - 34], [b[0] - bw * 0.4, b[1] - 34], [b[0] - bw * 0.75, b[1] - 6]], far(STRAW, f), line, 1.2);
    soft(ctx, [[a[0] - bw * 0.78, a[1] - 4], [a[0] - bw * 0.45, a[1] - 38], [a[0] + bw * 0.45, a[1] - 38], [a[0] + bw * 0.78, a[1] - 4]], far(lch(0.66, 0.07, 80), f), line, 1.2);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      seg(ctx, [lerp(a[0], b[0], t) - bw * 0.4, lerp(a[1], b[1], t) - 34], [lerp(a[0], b[0], t) + bw * 0.4, lerp(a[1], b[1], t) - 34], rgba(INK, 0.3 * (1 - f)), 0.8);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const t = (i - 2) * 0.22;
      dot(ctx, cx + ux * t + (i % 2 ? 6 : -6), cy + uy * t - 12, 13, far(i % 2 ? lch(0.83, 0.04, 86) : lch(0.72, 0.07, 80), f), line, 1.1, 9);
    }
  }
}

// ---------- architecture ----------
interface Bld {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  eave: number;
  rise: number;
  /** Atmospheric fade toward the silk, 0..1. */
  f: number;
  kind: "shop" | "plain" | "tavern";
  sign?: string;
  trade?: string;
}

function roof(ctx: Ctx, x0: number, x1: number, zE: number, hE: number, zR: number, hR: number, f: number, tile = TILE) {
  const sag = (hR - hE) * 0.14;
  const pt = (x: number, t: number): V => {
    const lift = (1 - t) * 10 * (Math.exp(-(x - x0) / 45) + Math.exp(-(x1 - x) / 45));
    return P(x, lerp(zE, zR, t), lerp(hE, hR, t) - sag * Math.sin(Math.PI * t) + lift);
  };
  const N = 8;
  const line = rgba(INK, 0.9 - f * 0.55);
  const out: V[] = [];
  for (let x = x0; x < x1; x += 18) out.push(pt(x, 0));
  for (let i = 0; i <= N; i++) out.push(pt(x1, i / N));
  for (let i = N; i >= 0; i--) out.push(pt(x0, i / N));
  shape(ctx, out, far(tile, f), line, 1.6);
  // Weathering: a lighter band below the ridge, a darker one above the eave.
  const band = (t0: number, t1: number, col: string) => {
    const b: V[] = [];
    for (let x = x0 + 4; x <= x1 - 4; x += 30) b.push(pt(x, t0));
    for (let x = x1 - 4; x >= x0 + 4; x -= 30) b.push(pt(x, t1));
    shape(ctx, b, col, null);
  };
  band(0.62, 0.97, rgba(SILK, 0.16));
  band(0.02, 0.22, rgba(INK, 0.1 * (1 - f)));
  // Tile rows.
  ctx.strokeStyle = rgba(INK, 0.42 * (1 - f));
  ctx.lineWidth = 1.1;
  for (let x = x0 + 8; x < x1 - 4; x += 12) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = pt(x, i / N);
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.stroke();
    if (f < 0.3) {
      const e = pt(x, 0);
      dot(ctx, e[0], e[1] + 1, 2.4, far(lch(0.66, 0.015, 235), f), line, 0.6);
    }
  }
  // Ridge and its end ornaments.
  const a = pt(x0 - 4, 1);
  const b = pt(x1 + 4, 1);
  seg(ctx, a, b, line, 9.5);
  seg(ctx, a, b, far(lch(0.4, 0.02, 240), f), 7);
  seg(ctx, [a[0], a[1] - 1.5], [b[0], b[1] - 1.5], rgba(SILK, 0.3), 1.2);
  for (const [e, d] of [[a, -1], [b, 1]] as [V, number][]) {
    shape(ctx, [[e[0] - d * 5, e[1] + 4], [e[0] + d * 7, e[1] + 3], [e[0] + d * 10, e[1] - 15], [e[0] + d * 3, e[1] - 10], [e[0] - d * 3, e[1] - 5]], far(lch(0.4, 0.02, 240), f), line, 1);
  }
}

function lantern(ctx: Ctx, x: number, y: number, s = 1) {
  seg(ctx, [x, y - 16 * s], [x, y - 9 * s], INK, 0.8);
  dot(ctx, x, y, 7.5 * s, RED, INK, 0.9, 9 * s);
  seg(ctx, [x - 4 * s, y - 9 * s], [x + 4 * s, y - 9 * s], GOLD, 2);
  seg(ctx, [x - 4 * s, y + 9 * s], [x + 4 * s, y + 9 * s], GOLD, 2);
  seg(ctx, [x, y + 10 * s], [x, y + 18 * s], RED, 1.2);
}

function goods(ctx: Ctx, r: Rng, kind: string, at: (u: number, v: number) => V, n = 9) {
  const spots = Array.from({ length: n }, () => at(r.float(0.08, 0.92), r.float(0.12, 0.88))).sort((a, b) => a[1] - b[1]);
  for (const [x, y] of spots) {
    switch (kind) {
      case "melon":
        dot(ctx, x, y - 5, 9, r.chance(0.7) ? lch(0.6, 0.09, 140) : lch(0.78, 0.1, 100), INK, 1, 7);
        seg(ctx, [x - 4, y - 10], [x - 3, y], rgba(INK, 0.35), 0.8);
        seg(ctx, [x + 3, y - 11], [x + 4, y - 1], rgba(INK, 0.35), 0.8);
        break;
      case "fruit":
        dot(ctx, x, y - 3, 11, STRAW, INK, 1, 6);
        for (let i = 0; i < 7; i++) dot(ctx, x + r.gauss(0, 4), y - 5 + r.gauss(0, 1.6), 2.7, r.pick([RED, lch(0.72, 0.14, 60), lch(0.8, 0.12, 95)]), rgba(INK, 0.5), 0.4);
        break;
      case "pottery":
        soft(ctx, [[x - 5, y], [x - 8, y - 9], [x - 3, y - 18], [x + 3, y - 18], [x + 8, y - 9], [x + 5, y]], r.pick([lch(0.7, 0.05, 160), lch(0.5, 0.07, 50), WHITE, lch(0.42, 0.05, 250)]), INK, 1);
        break;
      case "cloth":
        shape(ctx, [[x - 14, y - 2], [x + 14, y - 5], [x + 14, y - 12], [x - 14, y - 9]], r.pick(CLOTHS), INK, 1);
        break;
      case "bun":
        dot(ctx, x, y - 4, 13, STRAW, INK, 1, 6.5);
        for (let i = 0; i < 5; i++) dot(ctx, x + (i - 2) * 4.4, y - 6 + (i % 2) * 2.4, 3.2, WHITE, rgba(INK, 0.6), 0.5);
        break;
      case "fish":
        soft(ctx, [[x - 12, y - 4], [x - 2, y - 8], [x + 10, y - 5], [x + 15, y - 9], [x + 15, y], [x + 10, y - 3], [x - 2, y]], lch(0.78, 0.02, 230), INK, 0.9);
        break;
      case "toy":
        dot(ctx, x, y - 6, 4.5, r.pick(CLOTHS), INK, 0.8);
        seg(ctx, [x, y - 2], [x, y - 16], DARK, 0.9);
        dot(ctx, x, y - 17, 2.6, r.pick([RED, GOLD]), INK, 0.5);
        break;
      case "greens":
        dot(ctx, x, y - 4, 11, lch(0.6, 0.1, 140), INK, 1, 5);
        seg(ctx, [x - 9, y - 3], [x - 15, y - 2], WHITE, 3);
        break;
      default:
        shape(ctx, [[x - 9, y - 1], [x + 9, y - 3], [x + 9, y - 9], [x - 9, y - 7]], WHITE, INK, 0.9);
    }
  }
}

function shopFront(ctx: Ctx, r: Rng, b: Bld, top: number) {
  const { x0, x1, z0, f } = b;
  const line = rgba(INK, 0.9 - f * 0.55);
  const nb = Math.max(2, Math.round((x1 - x0) / 140));
  const bw = (x1 - x0) / nb;
  const trade = b.trade ?? "pottery";
  for (let i = 0; i < nb; i++) {
    const a = x0 + i * bw + 6;
    const c = x0 + (i + 1) * bw - 6;
    const m = (a + c) / 2;
    const kind = i === Math.floor(nb / 2) ? "open" : r.pick(["open", "open", "lattice", "door"]);
    if (kind === "lattice") {
      fr(ctx, a, c, z0, 12, 66, far(WOOD, f), line, 1);
      fr(ctx, a, c, z0, 66, top, far(lch(0.86, 0.045, 92), f), line, 1);
      ctx.strokeStyle = rgba(WOODR, 0.75 * (1 - f));
      ctx.lineWidth = 1;
      for (let x = a + 9; x < c - 2; x += 9) seg(ctx, P(x, z0, 66), P(x, z0, top), ctx.strokeStyle as string, 1);
      for (let h = 75; h < top - 2; h += 9) seg(ctx, P(a, z0, h), P(c, z0, h), rgba(WOODR, 0.75 * (1 - f)), 1);
      continue;
    }
    fr(ctx, a, c, z0, 12, top, far(DARK, f), line, 1.1);
    if (kind === "door") {
      fr(ctx, a, a + bw * 0.2, z0, 12, top, far(WOOD, f), line, 1);
      fr(ctx, c - bw * 0.2, c, z0, 12, top, far(WOOD, f), line, 1);
      const cc = far(r.pick([lch(0.45, 0.06, 255), lch(0.5, 0.12, 30), lch(0.55, 0.07, 150)]), f);
      fr(ctx, a + bw * 0.2, c - bw * 0.2, z0, top - 52, top, cc, line, 1);
      seg(ctx, P(m, z0, top - 52), P(m, z0, top), line, 0.8);
      continue;
    }
    // Shelves at the back, a keeper, a counter with wares.
    for (const sh of [top - 34, top - 66]) {
      seg(ctx, P(a + 4, z0, sh), P(c - 4, z0, sh), far(WOOD, f), 2.5);
      for (let x = a + 12; x < c - 8; x += r.float(11, 17)) {
        const [px, py] = P(x, z0, sh + 2);
        if (trade === "cloth") shape(ctx, [[px - 5, py], [px + 5, py], [px + 5, py - 12], [px - 5, py - 12]], far(r.pick(CLOTHS), f), line, 0.6);
        else if (trade === "herb") shape(ctx, [[px - 6, py], [px + 6, py], [px + 6, py - 14], [px - 6, py - 14]], far(r.pick([lch(0.55, 0.07, 55), lch(0.62, 0.07, 65)]), f), line, 0.7);
        else if (trade === "wine") {
          soft(ctx, [[px - 4.5, py], [px - 7, py - 8], [px - 3, py - 15], [px + 3, py - 15], [px + 7, py - 8], [px + 4.5, py]], far(r.pick([lch(0.42, 0.06, 45), lch(0.5, 0.07, 55), lch(0.34, 0.04, 50)]), f), line, 0.6);
          shape(ctx, [[px - 3, py - 15], [px + 3, py - 15], [px + 2.5, py - 18.5], [px - 2.5, py - 18.5]], far(RED, f), null);
        }
        else soft(ctx, [[px - 3.5, py], [px - 5, py - 7], [px - 2, py - 13], [px + 2, py - 13], [px + 5, py - 7], [px + 3.5, py]], far(r.pick([lch(0.7, 0.05, 160), lch(0.55, 0.07, 50), WHITE, lch(0.6, 0.12, 35)]), f), line, 0.6);
      }
    }
    if (f < 0.2) figure(ctx, mkFig(r, m + r.float(-12, 12), z0, { h: 6, kind: r.pick(["robe", "robe", "short"]), walk: false, prop: undefined, arm: r.pick(["hold", "point", "sleeves"]) }));
    fr(ctx, a, c, z0, 12, 54, far(lch(0.48, 0.075, 48), f), line, 1.1);
    seg(ctx, P(a, z0, 46), P(c, z0, 46), line, 0.8);
    if (f < 0.2) goods(ctx, r, trade, (u, v) => P(lerp(a + 6, c - 6, u), z0, 55 + v * 3), 5);
  }
  for (let i = 0; i <= nb; i++) fr(ctx, x0 + i * bw - 6, x0 + i * bw + 6, z0, 0, top + 14, far(WOODR, f), line, 1.1);
  fr(ctx, x0 - 5, x1 + 5, z0, 0, 12, far(STONE, f), line, 1.1);
  fr(ctx, x0, x1, z0, top, top + 13, far(lch(0.38, 0.07, 40), f), line, 1.1);
  if (b.sign && f < 0.2) {
    const m = (x0 + x1) / 2;
    const half = b.sign.length * 15 + 8;
    fr(ctx, m - half, m + half, z0, top - 34, top - 2, lch(0.27, 0.03, 150), INK, 1.4);
    const [px, py] = P(m, z0, top - 18);
    label(ctx, b.sign, px, py, 25, GOLD, false);
  }
}

function building(ctx: Ctx, r: Rng, b: Bld) {
  const { x0, x1, z0, z1, eave, rise, f } = b;
  const zm = (z0 + z1) / 2;
  const line = rgba(INK, 0.9 - f * 0.55);
  // Side wall with its gable and timber frame.
  shape(ctx, [P(x1, z0), P(x1, z1), P(x1, z1, eave), P(x1, zm, eave + rise - 6), P(x1, z0, eave)], far(lch(0.79, 0.035, 85), f), line, 1.4);
  const timber = far(WOODR, f);
  seg(ctx, P(x1, zm), P(x1, zm, eave + rise - 8), timber, 3);
  seg(ctx, P(x1, z0, eave * 0.52), P(x1, z1, eave * 0.52), timber, 3);
  seg(ctx, P(x1, z0, eave - 12), P(x1, z1, eave - 12), timber, 3);
  // Front.
  fr(ctx, x0, x1, z0, 0, eave, far(PLASTER, f), line, 1.4);
  if (b.kind === "shop") shopFront(ctx, r, b, eave - 48);
  else {
    fr(ctx, x0 - 4, x1 + 4, z0, 0, 14, far(STONE, f), line, 1);
    for (let x = x0 + 70; x < x1 - 60; x += r.float(110, 170)) fr(ctx, x, x + 34, z0, eave * 0.42, eave * 0.42 + 30, far(DARK, f), line, 1);
  }
  // Bargeboard on the gable side, then the roof.
  shape(ctx, [P(x1 + 10, z0 - 36, eave - 14), P(x1 + 10, zm, eave + rise), P(x1 + 10, z1 + 36, eave - 14)], null, far(lch(0.36, 0.06, 40), f), 5, false);
  roof(ctx, x0 - 14, x1 + 14, z0 - 38, eave - 14, zm, eave + rise, f);
}

function tavern(ctx: Ctx, r: Rng, b: Bld) {
  const { x0, x1, z0, z1 } = b;
  const zm = (z0 + z1) / 2;
  const F2 = 245;
  const E2 = 420;
  shape(ctx, [P(x1, z0), P(x1, z1), P(x1, z1, E2), P(x1, zm, E2 + 108), P(x1, z0, E2)], lch(0.79, 0.035, 85), INK, 1.4);
  for (const h of [F2, E2 - 12, 120]) seg(ctx, P(x1, z0, h), P(x1, z1, h), WOODR, 3);
  seg(ctx, P(x1, zm), P(x1, zm, E2 + 100), WOODR, 3);
  // Ground floor.
  fr(ctx, x0, x1, z0, 0, F2, PLASTER, INK, 1.4);
  shopFront(ctx, r, { ...b, f: 0, trade: "wine", sign: undefined }, 150);
  // Upper floor: open bays with drinkers, a railing in front.
  fr(ctx, x0, x1, z0, F2, E2, PLASTER, INK, 1.4);
  const nb = 4;
  const bw = (x1 - x0) / nb;
  for (let i = 0; i < nb; i++) {
    const a = x0 + i * bw + 7;
    const c = x0 + (i + 1) * bw - 7;
    fr(ctx, a, c, z0, F2, E2 - 34, lch(0.36, 0.035, 50), INK, 1.1);
    for (let k = 0; k < 2; k++) {
      const fx = lerp(a + 24, c - 24, k) + r.float(-8, 8);
      figure(ctx, mkFig(r, fx, z0, { h: F2 - 28, kind: r.pick(["robe", "robe", "woman"]), walk: false, prop: r.chance(0.3) ? "fan" : undefined, dir: k ? -1 : 1, arm: r.pick(["hold", "point", "sleeves"]) }));
    }
    // Table between them with a wine jug.
    const [tx, ty] = P((a + c) / 2, z0, F2 + 44);
    shape(ctx, [[tx - 20, ty], [tx + 20, ty], [tx + 20, ty + 6], [tx - 20, ty + 6]], WOODR, INK, 0.9);
    soft(ctx, [[tx - 4, ty], [tx - 6, ty - 8], [tx - 2, ty - 15], [tx + 2, ty - 15], [tx + 6, ty - 8], [tx + 4, ty]], WHITE, INK, 0.8);
    // Rolled bamboo blind.
    fr(ctx, a, c, z0, E2 - 50, E2 - 34, STRAW, INK, 0.9);
    for (let h = E2 - 46; h < E2 - 36; h += 4) seg(ctx, P(a, z0, h), P(c, z0, h), rgba(INK, 0.3), 0.6);
  }
  for (let i = 0; i <= nb; i++) fr(ctx, x0 + i * bw - 6, x0 + i * bw + 6, z0, F2, E2, WOODR, INK, 1.1);
  fr(ctx, x0 - 8, x1 + 8, z0, F2 + 30, F2 + 37, WOODR, INK, 1);
  fr(ctx, x0 - 8, x1 + 8, z0, F2, F2 + 6, WOODR, INK, 1);
  for (let x = x0 - 4; x <= x1 + 4; x += 15) seg(ctx, P(x, z0, F2 + 6), P(x, z0, F2 + 30), WOODR, 2.2);
  // Name board.
  const m = (x0 + x1) / 2;
  fr(ctx, m - 62, m + 62, z0, E2 - 86, E2 - 46, lch(0.3, 0.06, 30), INK, 1.5);
  fr(ctx, m - 57, m + 57, z0, E2 - 82, E2 - 50, null, GOLD, 1);
  const [px, py] = P(m, z0, E2 - 66);
  label(ctx, b.sign ?? "酒楼", px, py, 30, GOLD, false);
  // Skirt roof between the floors, then lanterns under its eave.
  roof(ctx, x0 - 22, x1 + 22, z0 - 72, 192, z0 + 4, F2 + 4, 0);
  for (let i = 0; i < 9; i++) {
    const [lx, ly] = P(lerp(x0 + 10, x1 - 10, i / 8), z0 - 66, 162);
    lantern(ctx, lx, ly);
  }
  shape(ctx, [P(x1 + 10, z0 - 36, E2 - 14), P(x1 + 10, zm, E2 + 112), P(x1 + 10, z1 + 36, E2 - 14)], null, lch(0.36, 0.06, 40), 5, false);
  roof(ctx, x0 - 16, x1 + 16, z0 - 40, E2 - 14, zm, E2 + 112, 0);
}

function banner(ctx: Ctx, x: number, z: number, hp: number, txt: string, col: string, tcol: string, size = 30) {
  const [bx, by] = P(x, z);
  const top = by - hp;
  seg(ctx, [bx, by], [bx, top], INK, 5);
  seg(ctx, [bx, by], [bx, top], lch(0.42, 0.06, 50), 3);
  seg(ctx, [bx - 4, top + 8], [bx + size + 14, top + 8], INK, 3.2);
  const L = txt.length * size * 1.08 + 20;
  const w = size + 10;
  soft(ctx, [[bx + 5, top + 9], [bx + 5 + w, top + 9], [bx + 5 + w, top + 9], [bx + 8 + w, top + 9 + L * 0.5], [bx + 5 + w, top + 9 + L], [bx + 5 + w * 0.5, top + 5 + L], [bx + 6, top + 11 + L], [bx + 3, top + 9 + L * 0.5], [bx + 5, top + 9]], col, INK, 1.3);
  label(ctx, txt, bx + 5 + w / 2, top + 14 + size * 0.6, size, tcol);
}

function stall(ctx: Ctx, r: Rng, x: number, z: number, kind: string, cover: "parasol" | "awning" | "mat", ccol: string) {
  if (cover === "mat") {
    shape(ctx, [P(x - 52, z - 22), P(x + 52, z - 22), P(x + 52, z + 22), P(x - 52, z + 22)], STRAW, INK, 1.1);
    goods(ctx, r, kind, (u, v) => P(lerp(x - 46, x + 46, u), lerp(z - 18, z + 18, 1 - v)), 9);
    return;
  }
  const tw = 58;
  const td = 20;
  const th = 42;
  shape(ctx, [P(x + tw, z - td), P(x + tw, z + td), P(x + tw, z + td, th), P(x + tw, z - td, th)], lch(0.42, 0.06, 50), INK, 1.2);
  fr(ctx, x - tw, x + tw, z - td, 0, th, far(ccol, 0.35), INK, 1.2);
  for (let e = x - tw + 14; e < x + tw; e += 16) seg(ctx, P(e, z - td, 2), P(e, z - td, th - 2), rgba(INK, 0.22), 0.8);
  shape(ctx, [P(x - tw, z - td, th), P(x + tw, z - td, th), P(x + tw, z + td, th), P(x - tw, z + td, th)], lch(0.66, 0.06, 70), INK, 1.2);
  goods(ctx, r, kind, (u, v) => P(lerp(x - tw + 6, x + tw - 6, u), lerp(z - td + 4, z + td - 4, 1 - v), th), 9);
  if (cover === "parasol") {
    const [cx, cy] = P(x + 4, z + 26, 182);
    const [gx, gy] = P(x + 4, z + 26);
    seg(ctx, [gx, gy], [cx, cy], INK, 4.4);
    seg(ctx, [gx, gy], [cx, cy], lch(0.45, 0.06, 50), 2.4);
    const rx = 84;
    const ry = 40;
    dot(ctx, cx, cy, rx, ccol, INK, 1.5, ry);
    const ax = cx;
    const ay = cy - 24;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      seg(ctx, [ax, ay], [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], rgba(INK, 0.4), 0.9);
    }
    dot(ctx, cx, cy, rx * 0.55, null, rgba(INK, 0.25), 0.8, ry * 0.5);
    dot(ctx, ax, ay, 4, DARK, INK, 0.8);
  } else {
    const q: V[] = [P(x - 76, z - 34, 152), P(x + 76, z - 34, 152), P(x + 76, z + 44, 178), P(x - 76, z + 44, 178)];
    for (const [px, pz] of [[x - 74, z + 42], [x + 74, z + 42]] as V[]) seg(ctx, P(px, pz), P(px, pz, 176), lch(0.42, 0.06, 50), 3);
    shape(ctx, q, WHITE, INK, 1.4);
    for (let i = 0; i < 5; i++) {
      const u0 = (i * 2 + 0.5) / 10;
      const u1 = (i * 2 + 1.5) / 10;
      const at = (u: number, v: number): V => [lerp(lerp(q[0]![0], q[1]![0], u), lerp(q[3]![0], q[2]![0], u), v), lerp(lerp(q[0]![1], q[1]![1], u), lerp(q[3]![1], q[2]![1], u), v)];
      shape(ctx, [at(u0, 0), at(u1, 0), at(u1, 1), at(u0, 1)], rgba(ccol, 0.85), null);
    }
    shape(ctx, q, null, INK, 1.4);
    for (const [px, pz] of [[x - 74, z - 32], [x + 74, z - 32]] as V[]) {
      seg(ctx, P(px, pz), P(px, pz, 151), INK, 4.4);
      seg(ctx, P(px, pz), P(px, pz, 151), lch(0.45, 0.06, 50), 2.4);
    }
  }
}

// ---------- bridge ----------
const CX0 = 2500;
const CX1 = 2760;
const BX = (CX0 + CX1) / 2;
const hump = (x: number, H: number, half: number) => {
  const t = (x - BX) / half;
  return Math.abs(t) >= 1 ? 0 : H * (0.5 + 0.5 * Math.cos(Math.PI * t));
};
const BR = { z0: 400, z1: 650, H: 112, half: 285 };
const hb = (x: number) => hump(x, BR.H, BR.half);

function rail(ctx: Ctx, z: number, H: number, half: number, f: number) {
  const line = rgba(INK, 0.9 - f * 0.55);
  const top: V[] = [];
  const midl: V[] = [];
  for (let x = BX - half; x <= BX + half; x += 12) {
    top.push(P(x, z, hump(x, H, half) + 26));
    midl.push(P(x, z, hump(x, H, half) + 13));
  }
  for (const [pts, w] of [[midl, 2.6], [top, 4.2]] as [V[], number][]) {
    shape(ctx, pts, null, line, w + 2, false);
    shape(ctx, pts, null, far(lch(0.82, 0.02, 85), f), w, false);
  }
  for (let x = BX - half; x <= BX + half + 1; x += half / 7) {
    const h = hump(x, H, half);
    fr(ctx, x - 3.5, x + 3.5, z, h, h + 32, far(lch(0.8, 0.02, 85), f), line, 1);
    const [qx, qy] = P(x, z, h + 35);
    dot(ctx, qx, qy, 4, far(lch(0.8, 0.02, 85), f), line, 0.9);
  }
}

function bridgeDeck(ctx: Ctx, b: typeof BR, f: number) {
  const line = rgba(INK, 0.9 - f * 0.55);
  const pts: V[] = [];
  for (let x = BX - b.half; x <= BX + b.half; x += 10) pts.push(P(x, b.z0, hump(x, b.H, b.half)));
  for (let x = BX + b.half; x >= BX - b.half; x -= 10) pts.push(P(x, b.z1, hump(x, b.H, b.half)));
  shape(ctx, pts, far(lch(0.8, 0.025, 85), f), line, 1.4);
  for (let x = BX - b.half + 14; x < BX + b.half; x += 14) {
    const h = hump(x, b.H, b.half);
    seg(ctx, P(x, b.z0, h), P(x, b.z1, h), rgba(INK, 0.24 * (1 - f)), 0.9);
  }
  rail(ctx, b.z1, b.H, b.half, f);
}

function bridgeFront(ctx: Ctx, b: typeof BR, f: number) {
  const line = rgba(INK, 0.9 - f * 0.55);
  const aw = (CX1 - CX0) / 2 - 14;
  const ah = b.H - 30 + 40;
  const arch = (x: number) => -40 + ah * Math.sqrt(Math.max(0, 1 - ((x - BX) / aw) ** 2));
  const open: V[] = [];
  for (let x = BX + aw; x >= BX - aw; x -= 6) open.push(P(x, b.z0, arch(x)));
  // Shadowed water seen through the arch.
  const [, yTop] = P(BX, b.z0, ah - 40);
  const [, yBot] = P(BX, b.z0, -40);
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, rgba(INK, 0.78 * (1 - f)));
  g.addColorStop(1, rgba(lch(0.42, 0.03, 200), 0.6 * (1 - f)));
  trace(ctx, open);
  ctx.fillStyle = g;
  ctx.fill();
  const face: V[] = [];
  for (let x = BX - b.half; x <= BX + b.half; x += 10) face.push(P(x, b.z0, hump(x, b.H, b.half)));
  face.push(P(BX + b.half, b.z0), P(CX1, b.z0), P(CX1, b.z0, -40), P(BX + aw, b.z0, -40), ...open, P(BX - aw, b.z0, -40), P(CX0, b.z0, -40), P(CX0, b.z0), P(BX - b.half, b.z0));
  shape(ctx, face, far(lch(0.7, 0.025, 82), f), line, 1.5);
  // Voussoirs.
  const ring: V[] = [];
  for (let x = BX + aw + 13; x >= BX - aw - 13; x -= 6) ring.push(P(x, b.z0, -40 + (ah + 14) * Math.sqrt(Math.max(0, 1 - ((x - BX) / (aw + 13)) ** 2))));
  shape(ctx, ring, null, rgba(INK, 0.6 * (1 - f)), 1, false);
  for (let i = 1; i < 16; i++) {
    const a = (i / 16) * Math.PI;
    seg(ctx, P(BX + Math.cos(a) * aw, b.z0, -40 + Math.sin(a) * ah), P(BX + Math.cos(a) * (aw + 13), b.z0, -40 + Math.sin(a) * (ah + 14)), rgba(INK, 0.5 * (1 - f)), 0.9);
  }
  rail(ctx, b.z0, b.H, b.half, f);
}

// ---------- trees ----------
function tree(L: Layer, r: Rng, x: number, z: number, hgt: number, o: { willow?: boolean; f?: number; blossom?: boolean } = {}) {
  const f = o.f ?? 0;
  const [bx, by] = P(x, z);
  const bark = far(lch(0.36, 0.04, 55), f);
  const girth = o.willow ? 0.05 : 0.068;
  const ends: V[] = [];
  const grow = (x0: number, y0: number, ang: number, len: number, w: number, depth: number) => {
    const bend = r.gauss(0, 0.22);
    const mx = x0 + Math.cos(ang + bend * 0.4) * len * 0.5;
    const my = y0 + Math.sin(ang + bend * 0.4) * len * 0.5;
    const ex = mx + Math.cos(ang + bend) * len * 0.5;
    const ey = my + Math.sin(ang + bend) * len * 0.5;
    L.stroke("ink", [[x0, y0, 1], [mx, my, 0.82], [ex, ey, 0.6]], { color: bark, size: w, thinning: 0.6, opacity: 1 - f * 0.4 });
    if (w > 7) L.stroke("dry", [[x0 - w * 0.12, y0], [mx - w * 0.1, my], [ex, ey]], { color: far(lch(0.56, 0.05, 65), f), size: w * 0.5, opacity: 0.55, dryness: 0.45, bristles: 7, wobble: 0.6 });
    if (depth === 0 || w < 2.2) {
      ends.push([ex, ey]);
      return;
    }
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) grow(ex, ey, lerp(ang, -Math.PI / 2, 0.25) + (i - (n - 1) / 2) * r.float(0.55, 0.85) + r.gauss(0, 0.12), len * r.float(0.62, 0.8), w * 0.6, depth - 1);
    if (depth < 3) ends.push([ex, ey]);
  };
  grow(bx, by, -Math.PI / 2 + r.gauss(0, 0.1), hgt * 0.4, hgt * girth, 3);
  if (o.willow) {
    const g = far(lch(0.6, 0.095, 125), f);
    for (const [ex, ey] of ends) {
      for (let i = 0; i < 9; i++) {
        const sx = ex + r.gauss(0, hgt * 0.035);
        const len = hgt * r.float(0.2, 0.42);
        const sw = r.gauss(0, len * 0.08) + len * 0.05;
        L.stroke("ink", [[sx, ey, 0.7], [sx + sw * 0.4, ey + len * 0.5, 0.6], [sx + sw, ey + len, 0.15]], { color: r.chance(0.3) ? shift(g, { l: -0.1 }) : g, size: 2.4, opacity: 0.8 - f * 0.4 });
      }
    }
    return;
  }
  const dark = far(lch(0.4, 0.06, 148), f);
  const mid = far(o.blossom ? lch(0.8, 0.07, 10) : lch(0.57, 0.085, 135), f);
  const sz = hgt * 0.24;
  for (const [ex, ey] of ends) L.stroke("stamp", [[ex - 6, ey + 4], [ex + 6, ey - 4]], { color: o.blossom ? mid : dark, size: sz, opacity: 0.4, scatter: 0.25 });
  for (const [ex, ey] of ends) L.stroke("stamp", [[ex - sz * 0.15, ey - sz * 0.18], [ex + 4, ey - sz * 0.22]], { color: mid, size: sz * 0.8, opacity: 0.5, scatter: 0.3 });
  // Leaf dots, laid in clusters the way a brush tip would.
  L.draw((ctx) => {
    const d = Math.max(2, hgt * 0.009);
    for (const [ex, ey] of ends) {
      for (let i = 0; i < 46; i++) {
        const x = ex + r.gauss(0, sz * 0.36);
        const y = ey + r.gauss(-sz * 0.1, sz * 0.3);
        const u = r.next();
        const c = o.blossom ? (u < 0.6 ? lch(0.66, 0.13, 12) : u < 0.85 ? lch(0.88, 0.05, 20) : lch(0.5, 0.07, 140)) : u < 0.55 ? lch(0.33, 0.05, 150) : u < 0.85 ? lch(0.5, 0.09, 140) : lch(0.66, 0.1, 125);
        dot(ctx, x, y, d * r.float(0.8, 1.5), rgba(far(c, f), 0.8 - f * 0.3), null, 0, d * r.float(0.6, 1));
      }
    }
  });
}

// ---------- the painting ----------
export default function paint(p: Painting) {
  const r = p.rng.fork("work");
  p.background = SILK;

  // Aged silk: slow stains, darker toward the edges.
  const ground = p.layer("silk");
  for (let i = 0; i < 46; i++) {
    const x = r.float(0, W);
    const y = r.float(0, H);
    ground.stroke("stamp", [[x, y], [x + r.float(-300, 300), y + r.float(-120, 120)]], { color: r.chance(0.6) ? lch(0.72, 0.065, 75) : lch(0.85, 0.045, 88), size: r.float(300, 700), opacity: 0.09, scatter: 0.3 });
  }

  // ---------- far distance: hills, a pagoda, the city wall ----------
  const back = p.layer("far");
  const hill = (base: number, amp: number, f0: number, seed: number, col: string, a: number, env: (x: number) => number) => {
    back.draw((ctx) => {
      const pts: V[] = [];
      let top = base;
      for (let x = -20; x <= W + 20; x += 12) {
        const y = base - amp * env(x) * (0.5 + 0.5 * p.noise.fbm(x * f0, seed, 5, 0.5));
        top = Math.min(top, y);
        pts.push([x, y]);
      }
      pts.push([W + 20, base + 160], [-20, base + 160]);
      const g = ctx.createLinearGradient(0, top, 0, base + 150);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.55, rgba(col, a * 0.55));
      g.addColorStop(1, rgba(col, 0));
      trace(ctx, pts);
      ctx.fillStyle = g;
      ctx.fill();
    });
  };
  const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
  hill(640, 250, 1 / 900, 3.1, lch(0.66, 0.035, 230), 0.5, (x) => 0.25 + 0.9 * bump(x, 2100, 700) + 0.5 * bump(x, 700, 400));
  hill(700, 200, 1 / 600, 9.7, lch(0.6, 0.04, 215), 0.5, (x) => 0.3 + 0.8 * bump(x, 1300, 500) + 0.9 * bump(x, 3300, 500));
  // Texture on the nearer hills.
  for (let i = 0; i < 60; i++) {
    const x = r.float(0, W);
    const y = r.float(540, 700);
    back.stroke("stamp", [[x, y], [x + r.float(60, 200), y + r.float(10, 50)]], { color: lch(0.5, 0.045, 215), size: r.float(50, 110), opacity: 0.07, scatter: 0.3 });
  }
  back.draw((ctx) => {
    // Pagoda on the right-hand hill.
    const px = 3290;
    const pb = 640;
    const col = lch(0.52, 0.03, 240);
    for (let i = 0; i < 7; i++) {
      const w = 46 - i * 4.5;
      const y = pb - i * 34;
      shape(ctx, [[px - w * 0.62, y], [px + w * 0.62, y], [px + w * 0.56, y - 26], [px - w * 0.56, y - 26]], rgba(col, 0.38), rgba(INK, 0.3), 1);
      shape(ctx, [[px - w - 8, y - 22], [px + w + 8, y - 22], [px + w * 0.6, y - 34], [px - w * 0.6, y - 34]], rgba(col, 0.6), rgba(INK, 0.4), 1);
    }
    seg(ctx, [px, pb - 7 * 34], [px, pb - 7 * 34 - 46], rgba(INK, 0.45), 2.2);
    // City wall with a gate tower.
    const wz = 2950;
    const pale = rgba(lch(0.62, 0.025, 80), 0.55);
    const wl = rgba(INK, 0.32);
    fr(ctx, -900, 3400, wz, 0, 74, pale, wl, 1.2);
    for (let x = -900; x < 3400; x += 26) fr(ctx, x, x + 15, wz, 74, 86, pale, wl, 0.9);
    for (let h = 16; h < 74; h += 15) seg(ctx, P(-900, wz, h), P(3400, wz, h), rgba(INK, 0.1), 0.8);
    fr(ctx, -120, 240, wz - 20, 0, 96, rgba(lch(0.6, 0.025, 80), 0.75), wl, 1.2);
    const [ax, ay] = P(60, wz - 20);
    ctx.beginPath();
    ctx.moveTo(ax - 30, ay);
    ctx.lineTo(ax - 30, ay - 40);
    ctx.arc(ax, ay - 40, 30, Math.PI, 0);
    ctx.lineTo(ax + 30, ay);
    paintPath(ctx, rgba(INK, 0.4), wl, 1);
    fr(ctx, -70, 190, wz - 10, 96, 150, rgba(lch(0.5, 0.08, 35), 0.4), wl, 1);
    for (let x = -70; x <= 190; x += 43) seg(ctx, P(x, wz - 10, 96), P(x, wz - 10, 150), rgba(WOODR, 0.5), 3);
    roof(ctx, -110, 230, wz - 50, 140, wz + 20, 165, 0.62);
    fr(ctx, -40, 160, wz, 165, 200, rgba(lch(0.5, 0.08, 35), 0.4), wl, 1);
    roof(ctx, -80, 200, wz - 45, 190, wz + 30, 250, 0.62);
  });
  // Mist lying under the hills and the wall.
  for (let i = 0; i < 26; i++) {
    const x0 = r.float(-300, W - 600);
    const y = r.float(730, 830);
    back.stroke("round", [[x0, y], [x0 + r.float(400, 800), y + r.gauss(0, 14)], [x0 + r.float(900, 1700), y + r.gauss(0, 14)]], { color: SILK, size: r.float(90, 190), opacity: 0.09, hardness: 0, taper: [0.35, 0.35] });
  }
  // Birds.
  back.draw((ctx) => {
    for (let i = 0; i < 9; i++) {
      const x = 1500 + i * 46 + r.gauss(0, 22);
      const y = 300 - Math.abs(i - 4) * 16 + r.gauss(0, 12);
      shape(ctx, [[x - 9, y - 4], [x, y], [x + 9, y - 5]], null, rgba(INK, 0.6), 1.7, false);
    }
  });

  // ---------- the street and the canal ----------
  const earth = p.layer("ground");
  const yStreet = P(0, 1200)[1];
  for (let i = 0; i < 130; i++) {
    const x = r.float(-100, W);
    const y = r.float(yStreet, H);
    earth.stroke("stamp", [[x, y], [x + r.float(120, 500), y + r.gauss(0, 20)]], { color: r.chance(0.5) ? lch(0.74, 0.06, 78) : lch(0.84, 0.045, 86), size: r.float(60, 150), opacity: 0.1, scatter: 0.3 });
  }
  for (let i = 0; i < 90; i++) {
    const x = r.float(-100, W);
    const y = r.float(yStreet + 20, H - 120);
    earth.stroke("dry", [[x, y], [x + r.float(150, 420), y + r.gauss(0, 5)]], { color: lch(0.58, 0.05, 70), size: r.float(8, 20), opacity: 0.12, dryness: 0.6, bristles: 8, wobble: 0.3 });
  }
  earth.draw((ctx) => {
    // Water, fading with distance.
    for (let z = -460; z < 2900; z += 120) {
      const f = clamp((z - 900) / 2400) * 0.85;
      shape(ctx, [P(CX0, z, -40), P(CX1, z), P(CX1, z + 121), P(CX0, z + 121, -40)], far(WATER, f), null);
    }
    for (let i = 0; i < 230; i++) {
      const z = r.float(-450, 2300);
      const x = r.float(CX0 + 8, CX1 - 40);
      const f = clamp((z - 900) / 2000);
      const [wx, wy] = P(x, z, -40);
      const len = r.float(14, 40);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + len * 0.5, wy - 3, wx + len, wy);
      paintPath(ctx, null, rgba(r.chance(0.4) ? WHITE : lch(0.42, 0.04, 200), 0.4 * (1 - f)), 1);
    }
    // Left bank: stone revetment. Right bank: its edge.
    for (let z = -460; z < 2900; z += 120) {
      const f = clamp((z - 1200) / 2000) * 0.8;
      shape(ctx, [P(CX0, z), P(CX0, z + 121), P(CX0, z + 121, -40), P(CX0, z, -40)], far(lch(0.64, 0.025, 80), f), null);
      for (const h of [-13, -27]) seg(ctx, P(CX0, z, h), P(CX0, z + 121, h), rgba(INK, 0.28 * (1 - f)), 0.8);
      for (let q = 0; q < 4; q++) seg(ctx, P(CX0, z + q * 30), P(CX0, z + q * 30, -40), rgba(INK, 0.22 * (1 - f)), 0.8);
    }
    for (const x of [CX0, CX1]) {
      const g = ctx.createLinearGradient(...P(x, -460), ...P(x, 2900));
      g.addColorStop(0, rgba(INK, 0.9));
      g.addColorStop(0.5, rgba(INK, 0.8));
      g.addColorStop(1, rgba(INK, 0.1));
      shape(ctx, [P(x, -460), P(x, 2900)], null, null, 0, false);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const gw = ctx.createLinearGradient(...P(CX0, -460, -40), ...P(CX0, 2900, -40));
    gw.addColorStop(0, rgba(INK, 0.7));
    gw.addColorStop(1, rgba(INK, 0.05));
    trace(ctx, [P(CX0, -460, -40), P(CX0, 2900, -40)], false);
    ctx.strokeStyle = gw;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });

  // ---------- everything standing on the ground, painted far to near ----------
  const S = p.layer("scene");
  const items: { z: number; x: number; draw: () => void }[] = [];
  const add = (z: number, x: number, fn: (ctx: Ctx) => void) => items.push({ z, x, draw: () => S.draw((ctx) => fn(ctx)) });
  const inCanal = (x: number, w = 40) => x > CX0 - w && x < CX1 + w;

  const rowOf = (zRow: number, depth: number, f: number, xa: number, xb: number, treeH: number) => {
    let x = xa;
    while (x < xb) {
      const w = r.float(280, 520);
      if (x + w > CX0 - 70 && x < CX1 + 70) {
        x = CX1 + 80;
        continue;
      }
      const z0 = zRow + r.float(-45, 45);
      const b: Bld = { x0: x, x1: x + w, z0, z1: z0 + depth, eave: r.float(135, 185), rise: r.float(75, 100), f, kind: "plain" };
      const bx = x;
      add(z0, bx, (ctx) => building(ctx, r, b));
      // Trees behind the ridge and in the gaps.
      if (r.chance(0.7)) items.push({ z: z0 + depth + 60, x: bx, draw: () => tree(S, r, bx + w * r.float(0.2, 0.8), z0 + depth + 60, treeH * r.float(0.9, 1.25), { f: f * 0.95, blossom: r.chance(0.12) }) });
      const gap = r.float(30, 170);
      if (gap > 70) items.push({ z: z0 - 1, x: bx, draw: () => tree(S, r, bx + w + gap / 2, z0 + 60, treeH * r.float(0.75, 1), { f: f * 0.9 }) });
      x += w + gap;
    }
  };
  rowOf(2330, 210, 0.62, -1200, 2950, 250);
  rowOf(2010, 230, 0.47, -1100, 3050, 270);
  rowOf(1710, 250, 0.3, -1000, 3150, 290);
  // Mist between the rows of roofs.
  const mistAt = (z: number, n: number, op: number) =>
    items.push({
      z,
      x: 0,
      draw: () => {
        const y = P(0, z)[1];
        for (let i = 0; i < n; i++) {
          const x0 = r.float(-300, W - 500);
          S.stroke("round", [[x0, y + r.gauss(0, 26)], [x0 + r.float(500, 1300), y + r.gauss(0, 26)]], { color: SILK, size: r.float(90, 180), opacity: op, hardness: 0, taper: [0.4, 0.4] });
        }
      },
    });
  mistAt(2600, 22, 0.1);
  mistAt(2280, 22, 0.1);
  mistAt(1960, 16, 0.08);
  // Faded willows along the far canal.
  for (const [x, z] of [[2440, 1640], [2830, 1900], [2430, 2100], [2840, 2300], [2420, 2560]] as V[]) {
    const f = clamp((z - 1200) / 2000);
    items.push({ z, x, draw: () => tree(S, r, x, z, 270, { willow: true, f }) });
  }
  // A small far bridge and boats on the canal.
  const FB = { z0: 1560, z1: 1650, H: 60, half: 190 };
  add(FB.z1, 0, (ctx) => bridgeDeck(ctx, FB, 0.3));
  add(FB.z0, 0, (ctx) => bridgeFront(ctx, FB, 0.3));
  add(2050, 0, (ctx) => boat(ctx, BX - 40, 2050, 200, 0.5, true));
  add(1250, 0, (ctx) => boat(ctx, BX + 30, 1250, 250, 0.12, false));
  add(880, 0, (ctx) => boat(ctx, BX - 50, 880, 260, 0, true));
  add(130, 0, (ctx) => boat(ctx, BX + 20, 130, 270, 0, false));
  add(880, 1, (ctx) => {
    figure(ctx, mkFig(r, BX - 20, 760, { h: -30, kind: "short", hat: "douli", prop: "staff", walk: false, dir: 1 }));
  });
  add(130, 1, (ctx) => figure(ctx, mkFig(r, BX + 56, 20, { h: -30, kind: "short", hat: "douli", prop: "staff", walk: false, dir: -1 })));

  // The far side of the street: shops, with the tavern as the tall one.
  const shops: Bld[] = [
    { x0: -560, x1: -70, z0: 1200, z1: 1500, eave: 185, rise: 95, f: 0, kind: "shop", sign: "布庄", trade: "cloth" },
    { x0: -10, x1: 530, z0: 1200, z1: 1500, eave: 200, rise: 100, f: 0, kind: "shop", sign: "杂货", trade: "pottery" },
    { x0: 610, x1: 1210, z0: 1200, z1: 1520, eave: 0, rise: 0, f: 0, kind: "tavern", sign: "望春楼" },
    { x0: 1290, x1: 1760, z0: 1200, z1: 1500, eave: 190, rise: 95, f: 0, kind: "shop", sign: "茶坊", trade: "pottery" },
    { x0: 1830, x1: 2410, z0: 1200, z1: 1500, eave: 205, rise: 105, f: 0, kind: "shop", sign: "药铺", trade: "herb" },
    { x0: 2850, x1: 3420, z0: 1200, z1: 1500, eave: 195, rise: 100, f: 0, kind: "shop", sign: "米行", trade: "cloth" },
  ];
  for (const b of shops) add(1200, b.x0, (ctx) => (b.kind === "tavern" ? tavern(ctx, r, b) : building(ctx, r, b)));
  add(1160, 570, (ctx) => banner(ctx, 572, 1160, 360, "新酒", lch(0.86, 0.03, 90), RED, 34));
  add(1160, 1262, (ctx) => banner(ctx, 1262, 1160, 250, "茶", lch(0.5, 0.06, 250), WHITE));
  add(1160, 1800, (ctx) => banner(ctx, 1800, 1160, 260, "药", lch(0.8, 0.09, 90), INK));
  add(1160, 2830, (ctx) => banner(ctx, 2830, 1160, 250, "米", WHITE, INK));
  add(1160, -40, (ctx) => banner(ctx, -44, 1160, 250, "布", lch(0.55, 0.14, 30), GOLD));
  // Willows along the canal, an old tree in the square, a blossoming one by the tavern.
  for (const [x, z, h, w] of [[2420, 1090, 330, 1], [2850, 760, 340, 1], [2400, 130, 300, 1], [2870, 1120, 300, 1], [1500, 830, 560, 0], [-130, 520, 380, 0], [3520, 700, 380, 0]] as [number, number, number, number][]) {
    items.push({ z, x, draw: () => tree(S, r, x, z, h, { willow: !!w }) });
  }
  items.push({ z: 1140, x: 1240, draw: () => tree(S, r, 1236, 1130, 250, { blossom: true }) });

  // ---------- the crowd ----------
  const figs: Fig[] = [];
  const blocked: [number, number, number, number][] = [[1455, 1545, 805, 855]];
  const free = (x: number, z: number, gap = 1) => {
    const onBridge = z > BR.z0 + 14 && z < BR.z1 - 14;
    if (inCanal(x, 34) && !onBridge) return false;
    if (blocked.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3])) return false;
    return !figs.some((f) => Math.abs(f.x - x) < 36 * gap && Math.abs(f.z - z) < 44 * gap);
  };
  const put = (x: number, z: number, o: Partial<Fig> = {}) => {
    const f = mkFig(r, x, z, o);
    if (Math.abs(x - BX) < BR.half && z > BR.z0 && z < BR.z1) f.h = hb(x);
    figs.push(f);
    return f;
  };

  // Stalls, each with a vendor behind and customers in front.
  const stalls: [number, number, string, "parasol" | "awning" | "mat", string][] = [
    [250, 1085, "cloth", "awning", lch(0.47, 0.06, 255)],
    [1530, 1085, "bun", "awning", lch(0.55, 0.14, 30)],
    [2130, 1085, "pottery", "awning", lch(0.6, 0.075, 155)],
    [3090, 1085, "fish", "awning", lch(0.47, 0.06, 255)],
    [140, 650, "fruit", "parasol", lch(0.72, 0.1, 78)],
    [1850, 470, "toy", "parasol", lch(0.58, 0.13, 32)],
    [3310, 470, "melon", "parasol", lch(0.74, 0.09, 85)],
    [1220, 190, "greens", "parasol", lch(0.62, 0.08, 150)],
    [60, 270, "bun", "parasol", lch(0.58, 0.13, 32)],
    [3440, 260, "pottery", "parasol", lch(0.5, 0.06, 250)],
    [1660, 910, "pottery", "mat", ""],
    [2270, 320, "greens", "mat", ""],
    [2980, 730, "fruit", "mat", ""],
    [700, 300, "melon", "mat", ""],
    [2310, 720, "fish", "mat", ""],
  ];
  for (const [x, z, kind, cover, col] of stalls) {
    blocked.push([x - 82, x + 82, z - 34, z + 56]);
    add(z, x, (ctx) => stall(ctx, r, x, z, kind, cover, col));
    put(x + r.float(-25, 25), z + 38, { kind: r.pick(["short", "short", "woman", "robe"]), walk: false, prop: undefined, arm: r.pick(["hold", "point"]) });
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) {
      const fx = x + (i - (n - 1) / 2) * 42 + r.gauss(0, 6);
      const fz = z - 44 - r.float(0, 22);
      if (free(fx, fz, 0.5)) put(fx, fz, { back: r.chance(0.75), dir: fx < x ? 1 : -1, walk: false, arm: r.pick(["hold", "point", "down"]), prop: r.chance(0.25) ? "basket" : undefined, kind: r.pick(["robe", "woman", "woman", "short", "child"]) });
    }
  }
  // A fortune teller under the old tree.
  blocked.push([1290, 1420, 880, 950]);
  add(905, 1350, (ctx) => {
    shape(ctx, [P(1385, 890), P(1385, 920), P(1385, 920, 40), P(1385, 890, 40)], lch(0.42, 0.06, 50), INK, 1.2);
    fr(ctx, 1315, 1385, 890, 0, 40, lch(0.5, 0.06, 250), INK, 1.2);
    shape(ctx, [P(1315, 890, 40), P(1385, 890, 40), P(1385, 920, 40), P(1315, 920, 40)], WHITE, INK, 1.2);
    banner(ctx, 1300, 915, 190, "卜卦", WHITE, INK, 26);
  });
  put(1350, 940, { kind: "robe", hat: "futou", beard: true, walk: false, arm: "sleeves", prop: undefined, c1: lch(0.38, 0.05, 262) });
  put(1345, 852, { kind: "woman", back: true, walk: false, prop: undefined });

  // A juggler and the ring around him.
  const RX = 950;
  const RZ = 590;
  blocked.push([RX - 250, RX + 250, RZ - 190, RZ + 230]);
  add(RZ + 400, RX, (ctx) => {
    const [mx, my] = P(RX, RZ - 10);
    dot(ctx, mx, my, 168, rgba(lch(0.56, 0.11, 32), 0.55), rgba(INK, 0.6), 1.3, 62);
    dot(ctx, mx, my, 152, null, rgba(GOLD, 0.7), 2.2, 54);
  });
  add(RZ, RX, (ctx) => {
    figure(ctx, mkFig(r, RX, RZ, { kind: "short", c1: RED, c2: WHITE, hat: "knot", arm: "up", prop: undefined, walk: true, dir: 1 }));
    const [jx, jy] = P(RX, RZ);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + 0.175 * i);
      dot(ctx, jx + 8 - Math.cos(a) * 46, jy - 138 - Math.sin(a) * 44, 5.5, [RED, GOLD, lch(0.6, 0.1, 150), WHITE, RED][i]!, INK, 1);
    }
    const [dx, dy] = P(RX - 62, RZ - 10);
    shape(ctx, [[dx - 16, dy - 26], [dx + 16, dy - 26], [dx + 13, dy], [dx - 13, dy]], RED, INK, 1.2);
    dot(ctx, dx, dy - 26, 16, lch(0.86, 0.04, 88), INK, 1.2, 6);
    const [mx, my] = P(RX + 66, RZ + 8);
    beast(ctx, RX + 66, RZ + 8, -1, "dog", lch(0.62, 0.07, 60));
    dot(ctx, mx - 20, my - 34, 3, RED, INK, 0.7);
  });
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 22 : 26;
    for (let i = 0; i < n; i++) {
      if (ring && r.chance(0.35)) continue;
      const a = (i / n) * Math.PI * 2 + ring * 0.15 + r.gauss(0, 0.04);
      const x = RX + Math.cos(a) * (215 + ring * 42 + r.gauss(0, 7));
      const z = RZ + 20 + Math.sin(a) * ((Math.sin(a) > 0 ? 185 : 200) + ring * 40 + r.gauss(0, 6));
      const f = put(x, z, { dir: x < RX ? 1 : -1, back: Math.sin(a) < -0.25, walk: false });
      if (f.prop === "pole" || f.prop === "umbrella") f.prop = undefined;
      if (f.kind === "child" || r.chance(0.2)) f.arm = "up";
    }
  }

  // Set pieces: an ox cart, donkeys, a sedan chair, a rider, a wheelbarrow, sweets, dogs.
  blocked.push([1880, 2260, 780, 850], [180, 520, 870, 925], [1320, 1590, 300, 350], [2970, 3190, 875, 925], [470, 640, 190, 230]);
  add(815, 2050, (ctx) => {
    beast(ctx, 1945, 815, -1, "ox", lch(0.66, 0.07, 70));
    cart(ctx, 2120, 815, -1);
  });
  put(2010, 852, { kind: "short", hat: "douli", dir: -1, prop: "whip", walk: true });
  add(898, 300, (ctx) => {
    beast(ctx, 290, 898, 1, "donkey", lch(0.6, 0.02, 70), true);
    beast(ctx, 420, 902, 1, "donkey", lch(0.52, 0.03, 60), true);
  });
  put(212, 890, { kind: "short", hat: "douli", dir: 1, prop: "whip", walk: true });
  add(326, 1455, (ctx) => sedan(ctx, 1455, 326));
  put(1340, 328, { kind: "short", dir: 1, walk: true, prop: undefined, arm: "carry", hat: "knot", c1: lch(0.5, 0.05, 250) });
  put(1570, 328, { kind: "short", dir: 1, walk: true, prop: undefined, arm: "carry", hat: "knot", c1: lch(0.5, 0.05, 250) });
  put(1270, 345, { kind: "woman", dir: 1, walk: true, prop: "umbrella" });
  add(900, 3080, (ctx) => {
    beast(ctx, 3080, 900, -1, "horse", lch(0.9, 0.015, 90));
    figure(ctx, mkFig(r, 3082, 900, { h: 62, kind: "robe", c1: lch(0.55, 0.14, 32), hat: "futou", dir: -1, walk: false, arm: "hold", prop: undefined, beard: true }));
    const [hx, hy] = P(3080, 900);
    soft(ctx, [[hx - 22, hy - 92], [hx + 20, hy - 94], [hx + 24, hy - 62], [hx - 24, hy - 60]], lch(0.5, 0.12, 30), INK, 1.2);
  });
  put(2985, 908, { kind: "short", dir: -1, walk: true, prop: undefined, arm: "hold", hat: "knot" });
  add(208, 560, (ctx) => barrow(ctx, 590, 208, 1));
  put(532, 210, { kind: "short", dir: 1, walk: true, prop: undefined, arm: "push", hat: "douli" });
  put(1400, 640, { kind: "short", dir: -1, walk: false, prop: "tanghulu", hat: "scarf", c1: lch(0.5, 0.05, 250) });
  for (const [dx, dz] of [[-48, -14], [-30, 18], [44, -8]] as V[]) put(1400 + dx, 640 + dz, { kind: "child", dir: dx < 0 ? 1 : -1, walk: false, arm: "up", prop: undefined });
  for (const [x, z, d, c] of [[820, 250, 1, lch(0.4, 0.03, 60)], [2080, 610, -1, lch(0.85, 0.03, 85)], [3330, 420, -1, lch(0.6, 0.08, 60)], [300, 470, 1, lch(0.86, 0.02, 90)]] as [number, number, number, string][]) {
    blocked.push([x - 30, x + 30, z - 10, z + 10]);
    add(z, x, (ctx) => beast(ctx, x, z, d, "dog", c));
  }
  // The child with the kite stands at the crown of the bridge.
  const kid = put(BX + 10, 520, { kind: "child", dir: 1, walk: false, arm: "up", prop: undefined, c1: RED, s: 0.68 });

  // People crossing the bridge, then everyone else walking the street.
  for (let i = 0; i < 40; i++) {
    const x = BX + r.float(-BR.half, BR.half);
    const z = r.float(BR.z0 + 24, BR.z1 - 22);
    if (free(x, z, 0.8)) put(x, z, { dir: r.chance(0.5) ? 1 : -1 });
  }
  for (let i = 0; i < 520; i++) {
    const z = r.float(36, 1125);
    const x = r.float(-380, 3640);
    // The crowd bunches and thins instead of filling the street evenly.
    if (p.noise(x / 420, z / 260 + 20) < -0.25 && r.chance(0.75)) continue;
    if (!free(x, z)) continue;
    const lane = p.noise(z / 160, 3) + (r.next() - 0.5) * 0.9;
    const f = put(x, z, { dir: lane > 0 ? 1 : -1 });
    if (r.chance(0.34)) {
      // Company: someone alongside, turned toward them or walking with them.
      const cx = x + f.dir * r.float(24, 34);
      const cz = z + r.float(-10, 10);
      if (free(cx, cz, 0.45)) put(cx, cz, { dir: r.chance(0.55) ? (-f.dir as 1 | -1) : f.dir, walk: f.walk, kind: f.kind === "woman" && r.chance(0.5) ? "child" : undefined });
    }
  }
  for (const f of figs) add(f.z, f.x, (ctx) => figure(ctx, f));

  // The bridge itself sits in the depth order with the crowd.
  add(BR.z1, 0, (ctx) => bridgeDeck(ctx, BR, 0));
  add(BR.z0 + 1, 0, (ctx) => bridgeFront(ctx, BR, 0));

  // The near side of the street: only rooftops, and what pokes up behind them.
  for (const [x0, x1] of [[-260, 330], [420, 1010], [1250, 1840], [1920, 2400], [2880, 3330], [3400, 3900]] as V[]) {
    const b: Bld = { x0, x1, z0: -430, z1: -130, eave: r.float(112, 130), rise: r.float(78, 92), f: 0, kind: "plain" };
    add(-430, x0, (ctx) => building(ctx, r, b));
  }
  items.push({ z: -200, x: 1130, draw: () => tree(S, r, 1130, -200, 270, {}) });
  add(-131, 1890, (ctx) => banner(ctx, 1882, -120, 300, "香烛", lch(0.8, 0.09, 90), INK, 28));
  add(-131, 370, (ctx) => banner(ctx, 372, -120, 280, "面", WHITE, RED, 32));

  items.sort((a, b) => b.z - a.z || a.x - b.x);
  for (const it of items) it.draw();
  // Mineral pigment wears thin unevenly and lets the silk show through.
  S.pixels((d, w, h) => {
    const s = 1 / p.scale;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3;
        if (!d[i]) continue;
        const slow = p.noise.fbm(x * s * 0.006, y * s * 0.006, 3) * 0.5 + 0.5;
        const fine = p.noise(x * s * 0.09, y * s * 0.09) * 0.5 + 0.5;
        d[i] = d[i]! * (0.74 + 0.2 * slow + 0.06 * fine);
      }
    }
  });

  // ---------- above everything: the kite, the title, the seal ----------
  const top = p.layer("top");
  top.draw((ctx) => {
    const [kx0, ky0] = P(kid.x, kid.z, kid.h ?? 0);
    const hand: V = [kx0 + 10, ky0 - FH * 0.68];
    const kite: V = [3110, 250];
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.quadraticCurveTo(lerp(hand[0], kite[0], 0.62), lerp(hand[1], kite[1], 0.38), kite[0], kite[1]);
    paintPath(ctx, null, rgba(INK, 0.5), 1);
    ctx.save();
    ctx.translate(kite[0], kite[1]);
    ctx.rotate(-0.35);
    // A swallow kite.
    soft(ctx, [[0, -30], [14, -12], [70, -22], [40, 6], [14, 10], [22, 52], [0, 26], [-22, 52], [-14, 10], [-40, 6], [-70, -22], [-14, -12]], RED, INK, 1.5);
    soft(ctx, [[0, -22], [9, -6], [0, 16], [-9, -6]], GOLD, INK, 1);
    dot(ctx, -34, -8, 6, WHITE, INK, 0.9);
    dot(ctx, 34, -8, 6, WHITE, INK, 0.9);
    ctx.restore();

    label(ctx, "赶集图", 250, 150, 84, rgba(INK, 0.92));
    label(ctx, "丙午孟冬写古镇墟日", 160, 118, 30, rgba(INK, 0.85));
    label(ctx, "百工杂沓行人如织", 116, 118, 30, rgba(INK, 0.85));
    const sx = 96;
    const sy = 400;
    shape(ctx, [[sx, sy], [sx + 64, sy], [sx + 64, sy + 64], [sx, sy + 64]], rgba(lch(0.52, 0.19, 30), 0.92), null);
    label(ctx, "市井", sx + 47, sy + 17, 27, SILK);
    label(ctx, "太平", sx + 17, sy + 17, 27, SILK);
  });

  p.post(silk(0.045));
  p.post(vignette(0.2));
  p.post(grain(0.035));
}
