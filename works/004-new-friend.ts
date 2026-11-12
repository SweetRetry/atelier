// 新朋友 / A New Friend
// A ragdoll cat meets the little Claude crab, under the Claude spark. Gouache and colored pencil on toned paper.
import { clamp, type Ctx, grain, inPoly, type Layer, lch, loop, type Meta, mix, type Painting, type Pt, type Rng, shift } from "../engine/index.ts";

export const meta: Meta = { width: 2400, height: 3000, seed: 21 };

const W = 2400;
const H = 3000;
const CX = 1450; // the cat's axis
const FLOOR = 2330;
const ORANGE = "#d97757";
const m = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [2 * CX - x, y]);

interface FurOpts {
  dir: (x: number, y: number) => number;
  col: (x: number, y: number) => string;
  len: [number, number];
  size: [number, number];
  opacity?: number;
}
/** Scatter short tapered hairs inside a shape. */
function fur(L: Layer, r: Rng, poly: Pt[], n: number, o: FurOpts) {
  const xs = poly.map((q) => q[0]);
  const ys = poly.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < n; i++) {
    const x = r.float(x0, x1);
    const y = r.float(y0, y1);
    if (!inPoly(poly, x, y)) continue;
    hair(L, r, x, y, o.dir(x, y) + r.gauss(0, 0.22), r.float(...o.len), r.float(...o.size), o.col(x, y), o.opacity ?? 0.8);
  }
}
function hair(L: Layer, r: Rng, x: number, y: number, a: number, len: number, size: number, color: string, opacity: number) {
  const bend = r.gauss(0, 0.25);
  L.stroke("ink", [[x, y, 0.9], [x + Math.cos(a + bend * 0.5) * len * 0.5, y + Math.sin(a + bend * 0.5) * len * 0.5, 0.7], [x + Math.cos(a + bend) * len, y + Math.sin(a + bend) * len, 0.05]], { color, size, opacity, thinning: 0.95 });
}
/** Hairs breaking the outline, so the silhouette is fluffy instead of cut out. */
function fringe(L: Layer, r: Rng, poly: Pt[], every: number, o: FurOpts & { out?: number }) {
  const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length;
  const cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / every));
    for (let k = 0; k < steps; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / steps;
      const y = a[1] + ((b[1] - a[1]) * k) / steps;
      const outward = Math.atan2(y - cy, x - cx);
      const d = o.dir(x, y);
      // Lean the hair between "away from the body" and "the way the coat lies".
      const w = o.out ?? 0.5;
      const ang = Math.atan2(Math.sin(outward) * w + Math.sin(d) * (1 - w), Math.cos(outward) * w + Math.cos(d) * (1 - w)) + r.gauss(0, 0.25);
      const col = o.col(x, y);
      const sz = r.float(...o.size);
      // Down: a soft dab that blurs the cut edge. Then a tuft of fine hairs that share a direction.
      L.stroke("round", [[x + Math.cos(ang) * sz * 0.2, y + Math.sin(ang) * sz * 0.2]], { color: col, size: sz * 2.6, opacity: 0.55 * (o.opacity ?? 1), hardness: 0 });
      for (let t = 0; t < 4; t++) {
        const back = r.float(6, 20);
        const a2 = ang + r.gauss(0, 0.16);
        hair(L, r, x + r.gauss(0, every * 0.4) - Math.cos(a2) * back, y + r.gauss(0, every * 0.4) - Math.sin(a2) * back, a2, r.float(...o.len) * r.float(0.7, 1.3), sz * r.float(0.2, 0.36), col, (o.opacity ?? 1) * r.float(0.45, 0.9));
      }
    }
  }
}
const soft = (L: Layer, pts: Pt[], color: string, size: number, opacity: number) => L.stroke("round", pts, { color, size, opacity, hardness: 0, sizeByPressure: 0.3 });

export default function paint(p: Painting) {
  const r = p.rng.fork("hand");
  p.background = lch(0.56, 0.055, 215);

  // ---------- room ----------
  const wall = p.layer("wall");
  wall.vgrad([lch(0.5, 0.06, 225), lch(0.58, 0.055, 212), lch(0.62, 0.05, 205)], 0, FLOOR);
  for (let i = 0; i < 140; i++) {
    const x = r.float(0, W);
    const y = r.float(0, FLOOR);
    wall.stroke("stamp", [[x, y], [x + r.gauss(0, 200), y + r.gauss(0, 120)]], { color: shift(lch(0.56, 0.055, 215), { l: r.gauss(0, 0.03), h: r.gauss(0, 8) }), size: r.float(200, 520), opacity: 0.14, scatter: 0.3 });
  }
  const floor = p.layer("floor");
  floor.clip([[0, FLOOR], [W, FLOOR], [W, H], [0, H]], () => {
    floor.vgrad([lch(0.74, 0.04, 70), lch(0.83, 0.04, 78), lch(0.87, 0.035, 82)], FLOOR, H);
    for (let i = 0; i < 90; i++) {
      const y = r.float(FLOOR, H);
      const x = r.float(-200, W);
      floor.stroke("stamp", [[x, y], [x + r.float(300, 900), y + r.gauss(0, 12)]], { color: shift(lch(0.82, 0.04, 76), { l: r.gauss(0, 0.03) }), size: r.float(60, 160), tip: "chalk", rotate: "follow", opacity: 0.16, scatter: 0.1 });
    }
  });
  soft(floor, [[0, FLOOR + 8], [W, FLOOR + 8]], lch(0.5, 0.04, 250), 70, 0.12);

  // ---------- the Claude spark, hung like a small sun ----------
  const SX = 640;
  const SY = 800;
  const SR = 330;
  const glow = p.layer("glow", { blend: "screen" });
  soft(glow, [[SX, SY]], lch(0.62, 0.11, 55), 2100, 0.45);
  soft(glow, [[SX, SY]], lch(0.75, 0.11, 60), 1000, 0.3);
  const spark = p.layer("spark");
  // Twelve uneven rays, each a single stroke pressed harder toward its tip.
  const lens = [1, 0.8, 0.95, 0.74, 1, 0.86, 0.93, 0.76, 1, 0.82, 0.97, 0.78];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + r.gauss(0, 0.09) + 0.1;
    const len = SR * lens[i]!;
    const wob = r.gauss(0, 0.04);
    spark.stroke("ink", [[SX, SY, 0.3], [SX + Math.cos(a + wob) * len * 0.5, SY + Math.sin(a + wob) * len * 0.5, 0.75], [SX + Math.cos(a) * len, SY + Math.sin(a) * len, 1]], {
      color: ORANGE,
      size: SR * 0.135,
      thinning: 0.6,
      rough: 0.35,
    });
  }
  spark.stroke("round", [[SX, SY]], { color: ORANGE, size: SR * 0.24, opacity: 1, hardness: 0.85 });
  spark.atop(() => {
    for (let i = 0; i < 60; i++) {
      const a = r.float(0, Math.PI * 2);
      const d = r.float(0, SR);
      spark.stroke("stamp", [[SX + Math.cos(a) * d, SY + Math.sin(a) * d]], { color: r.chance(0.5) ? lch(0.74, 0.13, 50) : lch(0.56, 0.14, 38), size: r.float(60, 140), tip: "chalk", opacity: 0.22 });
    }
  });

  // ---------- shadows on the floor ----------
  const shade = p.layer("shade", { blend: "multiply" });
  shade.draw((ctx) => {
    ctx.fillStyle = lch(0.6, 0.04, 285);
    ctx.beginPath();
    ctx.ellipse(CX + 150, 2560, 720, 74, 0, 0, Math.PI * 2);
    ctx.ellipse(640, 2528, 330, 30, 0, 0, Math.PI * 2);
    ctx.ellipse(CX - 122, 2552, 120, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(CX + 122, 2552, 120, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  shade.blur(34);

  // ---------- the cat ----------
  const cream = lch(0.955, 0.018, 85);
  const creamShade = lch(0.87, 0.025, 75);
  const cool = lch(0.76, 0.035, 285);
  const seal = lch(0.4, 0.045, 50);
  const sealLight = lch(0.56, 0.055, 58);
  const warmLight = lch(0.95, 0.06, 65);
  const down = (x: number) => Math.PI / 2 + ((x - CX) / 900) * 0.7;

  // Ears first, so the head sits in front of them.
  const ears = p.layer("ears");
  // A ragdoll's head is big and round for its body. Everything on the head is drawn through one enlargement about the chin.
  const enlarge = (L: Layer) => {
    L.ctx.translate(CX, 1510);
    L.ctx.scale(1.17, 1.17);
    L.ctx.translate(-CX, -1510);
  };
  enlarge(ears);
  const earL = loop([[1128, 1100], [1136, 930], [1172, 800], [1262, 842], [1392, 968], [1280, 1030]]);
  for (const [e, flip] of [[earL, false], [m(earL), true]] as [Pt[], boolean][]) {
    ears.shape(e, seal);
    const inner = loop((flip ? m : (q: Pt[]) => q)([[1178, 1040], [1180, 930], [1196, 868], [1258, 900], [1330, 980], [1260, 1030]]));
    ears.shape(inner, lch(0.66, 0.07, 30), 0.9);
    fur(ears, r, inner, 170, { dir: () => (flip ? -1.9 : -1.25), col: () => mix(cream, lch(0.8, 0.05, 40), r.next()), len: [50, 120], size: [3, 6], opacity: 0.75 });
    fringe(ears, r, e, 9, { dir: () => -Math.PI / 2, col: () => mix(seal, sealLight, r.float(0, 0.6)), len: [16, 40], size: [3, 6], out: 0.7 });
  }

  // The tail is created here so its root tucks behind the body. It is painted further down.
  const tail = p.layer("tail");

  // Body.
  const body = p.layer("body");
  const bodyP = loop([[1200, 1470], [1050, 1740], [940, 2060], [910, 2320], [1010, 2490], [1450, 2540], [1890, 2490], [1990, 2320], [1960, 2060], [1850, 1740], [1700, 1470], [1450, 1420]]);
  body.shape(bodyP, cream);
  body.atop(() => {
    // Form: darker toward the far side and underneath, warm where the spark reaches.
    soft(body, [[1900, 1700], [1990, 2100], [1960, 2480]], cool, 460, 0.32);
    soft(body, [[1100, 2500], [1450, 2560], [1820, 2500]], cool, 260, 0.3);
    soft(body, [[1180, 2460], [1450, 2500], [1720, 2460]], cool, 170, 0.4); // behind the paws
    soft(body, [[1230, 1560], [1450, 1620], [1670, 1560]], cool, 330, 0.42); // under the chin
    soft(body, [[1040, 1800], [930, 2200]], warmLight, 320, 0.45);
    // Haunches read as slightly deeper cream.
    soft(body, [[1010, 2200], [1060, 2430]], creamShade, 320, 0.4);
    soft(body, [[1890, 2200], [1840, 2430]], creamShade, 320, 0.45);
    // The haunch folds: where the thighs meet the belly.
    soft(body, [[1150, 2120], [1180, 2300], [1230, 2470]], cool, 60, 0.3);
    soft(body, [[1750, 2120], [1720, 2300], [1670, 2470]], cool, 60, 0.34);
    fur(body, r, bodyP, 2600, { dir: (x) => down(x), col: (x, y) => mix(r.chance(0.5) ? cream : creamShade, cool, clamp((x - 1500) / 900 + (y - 2300) / 900, 0, 0.5) * r.next()), len: [70, 170], size: [7, 14], opacity: 0.3 });
  });
  fringe(body, r, bodyP, 16, { dir: (x) => down(x), col: (x) => (x > 1700 ? mix(cream, cool, 0.25) : cream), len: [30, 70], size: [12, 22], out: 0.3 });

  // Front legs and paws.
  const legs = p.layer("legs");
  const white = lch(0.985, 0.008, 90);
  for (const sx of [-1, 1]) {
    const lx = CX + sx * 122;
    const leg = loop([[lx - 78, 1880], [lx - 84, 2300], [lx - 88, 2440], [lx - 60, 2480], [lx, 2486], [lx + 60, 2480], [lx + 88, 2440], [lx + 84, 2300], [lx + 78, 1880]]);
    legs.shape(leg, lch(0.97, 0.012, 85));
    legs.atop(() => {
      soft(legs, [[lx + sx * 95, 1950], [lx + sx * 100, 2440]], cool, 110, 0.3);
      soft(legs, [[lx - sx * 80, 2000], [lx - sx * 86, 2420]], cool, 70, 0.22);
      fur(legs, r, leg, 380, { dir: () => Math.PI / 2, col: () => mix(white, creamShade, r.float(0, 0.7)), len: [50, 120], size: [3, 6], opacity: 0.5 });
      // The leg darkens where the paw is about to overlap it.
      soft(legs, [[lx - 90, 2440], [lx, 2424], [lx + 90, 2440]], cool, 90, 0.6);
    });
    // The paw: a rounded mitt set forward of the leg.
    const paw = loop([[lx - 112, 2492], [lx - 96, 2448], [lx - 40, 2426], [lx + 40, 2426], [lx + 96, 2448], [lx + 112, 2492], [lx + 86, 2536], [lx, 2548], [lx - 86, 2536]]);
    const pawL = p.layer(`paw${sx}`);
    pawL.shape(paw, white);
    pawL.atop(() => {
      soft(pawL, [[lx - 100, 2540], [lx, 2556], [lx + 100, 2540]], cool, 70, 0.55); // underside
      soft(pawL, [[lx + sx * 110, 2450], [lx + sx * 116, 2530]], cool, 70, 0.35); // far side
      soft(pawL, [[lx - 60, 2440], [lx + 60, 2440]], lch(0.995, 0.004, 90), 60, 0.7); // top catches the light
      fur(pawL, r, paw, 160, { dir: () => Math.PI / 2, col: () => mix(white, creamShade, r.float(0, 0.5)), len: [24, 60], size: [3, 5], opacity: 0.45 });
      // Three toes, parted by two creases.
      for (const t of [-1, 1]) pawL.stroke("ink", [[lx + t * 34, 2476, 0.25], [lx + t * 40, 2512, 0.9], [lx + t * 36, 2544, 0.6]], { color: lch(0.7, 0.03, 290), size: 7, opacity: 0.65 });
    });
    fringe(pawL, r, paw, 14, { dir: () => Math.PI / 2, col: () => white, len: [10, 22], size: [8, 12], out: 0.7, opacity: 0.8 });
  }

  // Chest ruff, the pride of a ragdoll.
  const ruffP = loop([[1250, 1470], [1190, 1650], [1230, 1850], [1340, 1990], [1450, 2040], [1560, 1990], [1670, 1850], [1710, 1650], [1650, 1470], [1450, 1440]]);
  const ruff = p.layer("ruff");
  ruff.shape(ruffP, lch(0.975, 0.012, 88));
  ruff.atop(() => {
    soft(ruff, [[1260, 1500], [1450, 1560], [1640, 1500]], cool, 220, 0.4);
    fur(ruff, r, ruffP, 1100, { dir: (x) => Math.PI / 2 + ((x - CX) / 300) * 0.5, col: () => mix(lch(0.985, 0.008, 90), cool, r.next() ** 2 * 0.5), len: [90, 200], size: [7, 14], opacity: 0.4 });
  });
  fringe(ruff, r, ruffP, 12, { dir: (x) => Math.PI / 2 + ((x - CX) / 300) * 0.4, col: () => mix(lch(0.985, 0.008, 90), cool, r.float(0, 0.2)), len: [60, 130], size: [10, 18], out: 0.2 });

  // Head.
  const head = p.layer("head");
  enlarge(head);
  const headP = loop([[1450, 930], [1620, 948], [1765, 1055], [1822, 1225], [1790, 1390], [1650, 1490], [1450, 1522], [1250, 1490], [1110, 1390], [1078, 1225], [1135, 1055], [1280, 948]]);
  const NX = CX;
  const NY = 1345;
  const radial = (x: number, y: number) => Math.atan2(y - NY, x - NX);
  head.shape(headP, cream);
  head.atop(() => {
    // The mask: two seal patches, parted by a white blaze that widens to the muzzle.
    const patchL = loop([[1030, 1220], [1110, 1030], [1290, 930], [1420, 930], [1415, 1050], [1385, 1180], [1340, 1290], [1240, 1360], [1080, 1390]]);
    for (const pt of [patchL, m(patchL)]) {
      head.shape(pt, sealLight);
      fur(head, r, pt, 1100, { dir: radial, col: (x, y) => mix(seal, sealLight, clamp(1.1 - Math.hypot(x - CX, y - 1150) / 380 + r.gauss(0, 0.12))), len: [50, 120], size: [9, 18], opacity: 0.55 });
      fringe(head, r, pt, 12, { dir: radial, col: () => mix(seal, sealLight, r.float(0.5, 1)), len: [30, 70], size: [8, 15], out: 0.5, opacity: 0.7 });
    }
    // Blaze and muzzle hairs reclaim the middle.
    fur(head, r, loop([[1450, 940], [1490, 1150], [1560, 1330], [1620, 1470], [1450, 1520], [1280, 1470], [1340, 1330], [1410, 1150]]), 700, { dir: radial, col: () => mix(cream, lch(0.99, 0.005, 90), r.next()), len: [40, 90], size: [8, 15], opacity: 0.7 });
    soft(head, [[1800, 1150], [1800, 1420]], cool, 240, 0.35);
    soft(head, [[1300, 1500], [1450, 1535], [1600, 1500]], cool, 110, 0.3);
    soft(head, [[1100, 1150], [1090, 1380]], warmLight, 200, 0.45);
    // Cheek and chin fluff.
    fur(head, r, loop([[1090, 1400], [1450, 1380], [1810, 1400], [1650, 1495], [1450, 1525], [1250, 1495]]), 400, { dir: radial, col: () => mix(cream, creamShade, r.next()), len: [40, 100], size: [6, 12], opacity: 0.35 });
  });
  fringe(head, r, headP, 9, { dir: radial, col: (x, y) => (y < 1360 ? mix(seal, sealLight, r.float(0.3, 1)) : x > 1700 ? mix(cream, cool, 0.3) : cream), len: [24, 60], size: [9, 18], out: 0.45 });

  // Face.
  const face = p.layer("face");
  enlarge(face);
  const eye = (cx: number, cy: number, sx: number) =>
    face.draw((ctx: Ctx) => {
      const almond = () => {
        ctx.beginPath();
        ctx.moveTo(cx - sx * 70, cy - 20); // outer corner, lifted
        ctx.bezierCurveTo(cx - sx * 40, cy - 66, cx + sx * 30, cy - 62, cx + sx * 68, cy + 16); // upper lid to inner corner
        ctx.bezierCurveTo(cx + sx * 30, cy + 58, cx - sx * 40, cy + 56, cx - sx * 70, cy - 20);
        ctx.closePath();
      };
      almond();
      ctx.lineWidth = 16;
      ctx.strokeStyle = lch(0.2, 0.03, 40);
      ctx.stroke();
      ctx.save();
      almond();
      ctx.clip();
      const g = ctx.createRadialGradient(cx - 8, cy + 14, 8, cx, cy, 78);
      g.addColorStop(0, lch(0.8, 0.09, 225));
      g.addColorStop(0.55, lch(0.62, 0.14, 248));
      g.addColorStop(1, lch(0.38, 0.12, 262));
      ctx.fillStyle = g;
      ctx.fillRect(cx - 90, cy - 80, 180, 160);
      // The lid casts a little shade on the top of the iris.
      const sh = ctx.createLinearGradient(0, cy - 60, 0, cy);
      sh.addColorStop(0, "rgba(20,20,50,0.55)");
      sh.addColorStop(1, "rgba(20,20,50,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(cx - 90, cy - 80, 180, 90);
      // Looking down and to the left, at the crab.
      ctx.fillStyle = "#0c0b12";
      ctx.beginPath();
      ctx.ellipse(cx - 20, cy + 10, 21, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(cx - 38, cy - 18, 12, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy + 26, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  eye(1312, 1212, 1);
  eye(1588, 1212, -1);
  face.draw((ctx) => {
    // Nose.
    ctx.fillStyle = lch(0.72, 0.09, 15);
    ctx.beginPath();
    ctx.moveTo(NX - 34, NY - 16);
    ctx.quadraticCurveTo(NX, NY - 28, NX + 34, NY - 16);
    ctx.quadraticCurveTo(NX + 14, NY + 22, NX, NY + 24);
    ctx.quadraticCurveTo(NX - 14, NY + 22, NX - 34, NY - 16);
    ctx.fill();
  });
  const line = lch(0.5, 0.04, 30);
  face.stroke("ink", [[NX, NY + 22, 0.6], [NX, NY + 56, 0.8]], { color: line, size: 6 });
  for (const sx of [-1, 1]) {
    face.stroke("ink", [[NX, NY + 54, 0.8], [NX + sx * 26, NY + 78, 1], [NX + sx * 62, NY + 64, 0.3]], { color: line, size: 6 });
    // Whisker pads and whiskers.
    for (let i = 0; i < 4; i++) face.stroke("round", [[NX + sx * (58 + i * 20 + r.gauss(0, 4)), NY + 40 + r.gauss(0, 12)]], { color: lch(0.7, 0.03, 60), size: 7, opacity: 0.7, hardness: 0.6 });
    for (const [dy, up] of [[-10, -70], [14, -10], [36, 60]] as const) {
      face.stroke("ink", [[NX + sx * 70, NY + 46 + dy, 0.9], [NX + sx * 260, NY + 30 + dy + up * 0.5, 0.6], [NX + sx * 470, NY + 40 + up, 0.05]], { color: lch(0.99, 0.005, 90), size: 5, opacity: 0.95, thinning: 0.9 });
    }
  }

  // Tail, a plume swept round in front.
  const tailPath: Pt[] = [[1960, 2300, 0.55], [2110, 2420, 0.85], [2090, 2560, 1], [1900, 2640, 1], [1690, 2630, 0.8], [1560, 2590, 0.35]];
  const tailMid = lch(0.5, 0.05, 55);
  tail.stroke("ink", tailPath, { color: tailMid, size: 210, thinning: 0.6, rough: 1 });
  const along = (t: number) => {
    const k = t * (tailPath.length - 1);
    const i = Math.min(tailPath.length - 2, Math.floor(k));
    const a = tailPath[i]!;
    const b = tailPath[i + 1]!;
    const f = k - i;
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), w: 100 * ((a[2] ?? 1) + ((b[2] ?? 1) - (a[2] ?? 1)) * f) };
  };
  // Long hairs lie back along the tail and fan out past its edge.
  for (let i = 0; i < 3200; i++) {
    const q = along(r.next());
    const side = r.pick([-1, 1]);
    const off = side * r.next() ** 0.6 * q.w;
    const shadeT = clamp(0.5 + (off / q.w) * 0.45 + r.gauss(0, 0.18));
    hair(tail, r, q.x - Math.sin(q.ang) * off, q.y + Math.cos(q.ang) * off, q.ang + side * r.float(0.15, 0.75), r.float(70, 180), r.float(3.5, 9), mix(lch(0.66, 0.05, 62), lch(0.33, 0.04, 45), shadeT), 0.7);
  }

  // ---------- the crab ----------
  const crab = p.layer("crab");
  const c = 54;
  const X0 = 360;
  const Y0 = 2222;
  crab.draw((ctx) => {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(X0 + c, Y0, 8 * c, 4.4 * c); // body
    ctx.fillRect(X0, Y0 + 2.2 * c, 10 * c, 1.1 * c); // arms
    for (const lx of [1.5, 2.9, 6.4, 7.8]) ctx.fillRect(X0 + lx * c, Y0 + 4.4 * c, 0.7 * c, 1.2 * c); // legs
  });
  crab.atop(() => {
    soft(crab, [[X0, Y0 + 5 * c], [X0 + 10 * c, Y0 + 5 * c]], lch(0.45, 0.13, 35), 170, 0.35);
    soft(crab, [[X0 + 8.7 * c, Y0], [X0 + 9.6 * c, Y0 + 4.4 * c]], lch(0.5, 0.13, 35), 130, 0.25);
    soft(crab, [[X0 + c, Y0 + 10], [X0 + 6 * c, Y0 + 10]], lch(0.82, 0.11, 60), 90, 0.4);
    for (let i = 0; i < 40; i++) crab.stroke("stamp", [[X0 + r.float(0, 10 * c), Y0 + r.float(0, 5.6 * c)]], { color: r.chance(0.5) ? lch(0.74, 0.12, 50) : lch(0.55, 0.14, 38), size: r.float(50, 110), tip: "chalk", opacity: 0.2 });
  });
  crab.draw((ctx) => {
    ctx.fillStyle = lch(0.18, 0.02, 40);
    ctx.fillRect(X0 + 2.7 * c, Y0 + 1.0 * c, 0.8 * c, 1.3 * c);
    ctx.fillRect(X0 + 6.5 * c, Y0 + 1.0 * c, 0.8 * c, 1.3 * c);
    // A glint in each eye, turned up toward the cat.
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(X0 + 3.2 * c, Y0 + 1.1 * c, 0.22 * c, 0.3 * c);
    ctx.fillRect(X0 + 7.0 * c, Y0 + 1.1 * c, 0.22 * c, 0.3 * c);
  });

  p.post(grain(0.04));
}
