// 向光 / Facing the Light
// A girl with rose-blonde hair lifts her face into noon light. Opaque paint laid with a flat brush, colored pencil over it.
// The head is drawn in face coordinates (origin at the eye, facing left, upright) and placed by one transform.
import { bloom, grain, lch, lerp, loop, media, type Meta, mix, type Painting, type Pt, type Rng, spline, type WetLayer } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 2850, seed: 7 };

const W = 1600;
const H = 2850;
// Placement of the head. S is screen units per face unit, TH tips the chin up.
const S = 1.5;
const TH = 0.16;
const OX = 800;
const OY = 1000;
const T = ([x, y, pr]: Pt): Pt => [OX + S * (x * Math.cos(TH) - y * Math.sin(TH)), OY + S * (x * Math.sin(TH) + y * Math.cos(TH)), pr];
const F = (pts: Pt[]): Pt[] => pts.map(T);
// The eye is drawn as if seen from the front, then narrowed toward its front corner, the way a turned head foreshortens it.
const E = (pts: Pt[]): Pt[] => pts.map(([x, y, pr]) => [-170 + (x + 170) * 0.84, y, pr]);
const FE = (pts: Pt[]): Pt[] => F(E(pts));
const curve = (pts: Pt[], step = 4): Pt[] => spline(F(pts), step).map((s) => [s.x, s.y]);
const between = (A: Pt[], B: Pt[], u: number): Pt[] => A.map((a, i) => [lerp(a[0], B[i]![0], u), lerp(a[1], B[i]![1], u), lerp(a[2] ?? 1, B[i]![2] ?? 1, u)]);

// Palette. One warm family in a narrow, high range of values. The eye is the only cool note.
const paper = lch(0.972, 0.03, 88);
const cream = lch(0.985, 0.022, 90);
const skin = lch(0.905, 0.052, 60);
const skinLit = lch(0.955, 0.038, 78);
const skinShade = lch(0.862, 0.072, 47);
const skinDeep = lch(0.8, 0.095, 38);
const blush = lch(0.82, 0.1, 22);
const hair = lch(0.9, 0.05, 48);
const hairShade = lch(0.835, 0.068, 40);
const hairDeep = lch(0.76, 0.08, 34);
const hairLight = lch(0.965, 0.035, 80);
const pencil = lch(0.56, 0.1, 45);
const lash = lch(0.4, 0.07, 30);
const lilac = lch(0.9, 0.035, 300);

// The profile, forehead to jaw angle. Pressure is the weight of the drawn line.
const PROFILE: Pt[] = [
  [-250, -640, 0.3], [-308, -470, 0.4], [-332, -300, 0.5], [-318, -160, 0.5], [-287, -45, 0.6], [-300, 55, 0.35], [-336, 150, 0.35],
  [-372, 208, 0.7], [-378, 226, 0.9], [-360, 250, 1], [-328, 264, 0.8], [-316, 310, 0.5], [-331, 348, 0.7], [-313, 376, 0.9], [-305, 384, 0.9],
  [-319, 420, 0.8], [-298, 458, 0.6], [-296, 515, 0.7], [-266, 580, 1], [-200, 618, 1], [-70, 606, 0.9], [80, 548, 0.8], [225, 455, 0.7], [318, 345, 0.6], [352, 205, 0.4],
];
const NECK_FRONT: Pt[] = [[-80, 610, 0.5], [-10, 760, 0.9], [-5, 920, 1], [-50, 1045, 0.5]];
const EAR: Pt[] = [[372, 30], [420, -22], [478, 0], [506, 80], [486, 170], [440, 235], [400, 268], [372, 240], [362, 160], [356, 90]];

/** One edge of a tapered mark, in screen units, for the pencil to follow. */
function edge(pts: Pt[], size: number, side: 1 | -1): Pt[] {
  const sm = spline(F(pts), 30);
  return sm.map((s, i): Pt => [s.x - Math.sin(s.a) * side * size * s.p * 0.5, s.y + Math.cos(s.a) * side * size * s.p * 0.5, 0.25 + 0.75 * Math.sin((Math.PI * i) / (sm.length - 1))]);
}

export default function paint(p: Painting) {
  const r = p.rng.fork("hand");
  p.background = paper;
  const pt = p.wet("paint", { impasto: 0.1, life: 30 });
  const pen = p.wet("pencil", { life: Infinity, impasto: 0 });
  const brush = { ...media.gouache, bristle: 0.3 };
  /** A drawn line in face coordinates. */
  const draw = (pts: Pt[], size = 4.5, o: Record<string, unknown> = {}) => pen.stroke(F(pts), { ...media.pencil, load: 0.9, tooth: 0.5, color: pencil, size, thin: 0.8, taper: [0.12, 0.2], ...o });
  const drawS = (pts: Pt[], size = 4.5, o: Record<string, unknown> = {}) => pen.stroke(pts, { ...media.pencil, load: 0.9, tooth: 0.5, color: pencil, size, thin: 0.8, ...o });
  /** A soft translucent glaze. Opacity at the center is about 1 - (1 - load)^3. */
  const glaze = (pts: Pt[], color: string, size: number, load: number) => pt.stroke(F(pts), { color, size, load, pickup: 0, hardness: 0, bristle: 0, thin: 0.3 });

  interface Tress {
    n: number;
    size: [number, number];
    tones: string[];
    wave?: number;
    /** Fine pencil strands that follow the flow between the guides. */
    strands?: number;
  }
  /** Hair between two guide curves: a few broad tapered marks of the flat brush, then pencil along some of their edges. */
  const tress = (rr: Rng, A: Pt[], B: Pt[], o: Tress) => {
    const n = A.length;
    for (let k = 0; k < o.n; k++) {
      const u = o.n === 1 ? 0.5 : k / (o.n - 1);
      const ph = rr.float(0, 6.28);
      const pts = between(A, B, u + rr.gauss(0, 0.04)).map(([x, y, pr], i): Pt => [x + (o.wave ?? 0) * (i / n) * Math.sin(ph + i * 1.4), y, pr]);
      const tip = pts[n - 1]!;
      const prev = pts[n - 2]!;
      const keep = rr.float(0.6, 1.15);
      pts[n - 1] = [prev[0] + (tip[0] - prev[0]) * keep + rr.gauss(0, 22), prev[1] + (tip[1] - prev[1]) * keep, 0];
      const size = rr.float(...o.size);
      // Each lock dries before the next, so it keeps its edge against its neighbour.
      pt.stroke(F(pts), { ...brush, bristle: 0.42, bristles: 26, color: o.tones[k % o.tones.length]!, size, thin: 1, fade: 0.1 }).dry();
      const side = rr.chance(0.5) ? 1 : -1;
      drawS(edge(pts, size, side), rr.float(4.5, 6.5));
      if (rr.chance(0.35)) drawS(edge(pts, size, -side as 1 | -1), rr.float(3.5, 4.5), { load: 0.6 });
    }
    for (let k = 0; k < (o.strands ?? 0); k++) {
      const ph = rr.float(0, 6.28);
      const keep = Math.max(3, Math.round(n * rr.float(0.6, 1)));
      const pts = between(A, B, rr.float(-0.05, 1.05)).slice(0, keep).map(([x, y], i): Pt => [x + rr.gauss(0, 8) + (o.wave ?? 0) * (i / n) * Math.sin(ph + i * 1.4), y + rr.gauss(0, 8)]);
      draw(pts, rr.float(3, 4.5), { load: rr.float(0.5, 0.9), taper: [0.2, 0.35] });
    }
  };

  // ---------- light behind her ----------
  pt.fill(paper);
  pt.block([[0, 0], [W, 0], [W, H], [0, H]], { ...brush, color: paper, size: 240, angle: -0.95, vary: 0.012 });
  for (let i = 0; i < 9; i++) {
    const [x, y] = [r.float(-100, 520), r.float(-100, 900)];
    pt.stroke([[x, y + 200], [x + 130, y]], { ...brush, color: lch(0.955, 0.045, 88), size: r.float(120, 220) });
  }
  pt.block([[0, 1900], [700, 2300], [700, H], [0, H]], { ...brush, color: mix(paper, lilac, 0.35), size: 200, angle: -0.95, vary: 0.01, feather: 300 });
  pt.dry();

  // ---------- hair behind the head ----------
  pt.block(curve([[60, -900], [470, -300], [455, 60], [520, 300], [430, 640], [400, 1000], [330, 1400], [1200, 1400], [1200, -900]]), { ...brush, color: hairShade, size: 130, angle: 1.5, vary: 0.014 });
  tress(r.fork("back"), [[430, -800, 0.5], [520, -300, 1], [500, 200, 1], [440, 700, 0.9], [380, 1100, 0.8], [340, 1500, 0.5]], [[760, -800, 0.5], [860, -300, 1], [840, 200, 1], [800, 700, 0.9], [820, 1100, 0.8], [780, 1500, 0.5]], { n: 5, size: [150, 260], tones: [hairDeep, hairShade, hair, hairShade, hair], wave: 30, strands: 8 });
  pt.dry();

  // ---------- skin ----------
  const head = [...curve(PROFILE), ...F([[440, 260], [330, -400], [250, -700]])];
  const neck = [...curve(NECK_FRONT), ...F([[-170, 1200], [-170, 1500], [900, 1500], [640, 1100], [470, 700], [440, 250], [0, 500]])];
  const ear = loop(F(EAR));
  const forms = [head, neck, ear];
  for (const f of forms) pt.block(f, { ...brush, color: skin, size: 150, angle: -0.95, vary: 0.006 });
  pt.dry();
  const onSkin = (fn: () => void, feather = 0) => forms.forEach((f) => pt.clip(f, fn, feather));
  // Turning away from the light: warmer and deeper toward the ear and the back of the neck.
  onSkin(() => {
    glaze([[330, -100], [270, 200], [160, 470]], lch(0.85, 0.085, 35), 520, 0.14);
    glaze([[320, 800], [220, 1200]], lch(0.86, 0.08, 30), 700, 0.14);
    glaze([[-110, 190], [-20, 230]], blush, 400, 0.09);
    glaze([[-352, 212]], blush, 110, 0.12);
    glaze([[-30, -60], [50, -30]], blush, 180, 0.09);
    glaze([[430, 120]], blush, 200, 0.2);
  });
  pt.dry();
  // Cast shadow, one tone with a cut edge: under the jaw, under the hair, inside the ear.
  onSkin(() => {
    pt.block(curve([[-240, 598], [-60, 618], [100, 562], [240, 472], [330, 350], [370, 250], [470, 300], [520, 700], [560, 1300], [-200, 1300], [-40, 1040], [30, 900], [20, 780], [-60, 690]]), { ...brush, color: skinShade, size: 110, angle: 0.5, vary: 0.006, feather: 6 });
    pt.block(curve([[-340, -330], [-250, -190], [-120, -150], [40, -120], [160, -30], [230, 200], [200, 420], [300, 380], [380, 0], [300, -700], [-250, -700]]), { ...brush, color: skinShade, size: 110, angle: 1.2, vary: 0.006, feather: 6 });
    pt.block(loop(F([[400, 40], [450, 10], [480, 70], [462, 150], [420, 200], [392, 150]])), { ...brush, color: skinDeep, size: 40, angle: 1.2, load: 0.7 });
    glaze([[60, 620], [260, 510]], skinDeep, 150, 0.12);
    glaze([[240, 950], [330, 1250]], lch(0.84, 0.06, 335), 460, 0.1);
  });
  pt.dry();
  // The lit rim of the face, where it nearly joins the light behind it.
  pt.clip(head, () => pt.block(curve([[-260, -700], [-345, -300], [-300, -40], [-390, 215], [-340, 350], [-330, 430], [-305, 540], [-250, 600], [-235, 470], [-262, 380], [-290, 270], [-262, 150], [-232, 0], [-262, -300], [-190, -700]]), { ...brush, color: skinLit, size: 80, angle: 1.3, vary: 0.004, load: 0.85, feather: 26 }));
  pt.dry();

  // ---------- mouth ----------
  const lip = lch(0.77, 0.115, 20);
  pt.block(curve([[-318, 322], [-332, 348], [-313, 376], [-305, 384], [-246, 390], [-282, 358]], 2), { ...brush, color: lip, size: 22, angle: 0.5, vary: 0.012, feather: 3 });
  pt.block(curve([[-305, 384], [-320, 420], [-301, 452], [-264, 430], [-246, 390]], 2), { ...brush, color: mix(lip, skin, 0.3), size: 22, angle: 0.3, vary: 0.012, feather: 3 });
  pt.stroke(F([[-300, 414], [-284, 426]]), { ...brush, color: cream, size: 12 });
  pt.dry();

  // ---------- collar ----------
  const collar = curve([[-260, 1500], [-190, 1150], [-60, 1040], [120, 1090], [330, 1060], [520, 960], [700, 1010], [1100, 1300], [1100, 1500]]);
  pt.block(collar, { ...brush, color: cream, size: 120, angle: 0.2, vary: 0.006 });
  pt.dry();
  pt.clip(collar, () => {
    pt.block(curve([[-60, 1040], [120, 1090], [330, 1060], [520, 960], [560, 1050], [380, 1170], [140, 1200], [-30, 1150]]), { ...brush, color: lilac, size: 70, angle: 0.15, vary: 0.01 });
    pt.block(curve([[-230, 1300], [-100, 1210], [60, 1300], [-40, 1500], [-260, 1500]]), { ...brush, color: mix(lilac, cream, 0.3), size: 70, angle: 1, vary: 0.01 });
  });
  pt.dry();
  draw([[-200, 1160, 0.3], [-60, 1040, 1], [120, 1090, 0.8], [330, 1060, 1], [520, 960, 0.6]], 5);
  draw([[-30, 1150, 0.2], [140, 1200, 1], [380, 1170, 0.8], [560, 1050, 0.2]], 4);
  draw([[-100, 1210, 0.2], [60, 1300, 1], [0, 1420, 0.3]], 4);

  // ---------- hair in front ----------
  // Tucked behind the ear.
  tress(r.fork("tuck"), [[300, -780, 0.5], [400, -420, 1], [470, -170, 0.9], [545, 10, 0.6], [585, 190, 0]], [[200, -780, 0.5], [290, -430, 1], [370, -160, 0.9], [450, -10, 0.6], [500, 90, 0]], { n: 3, size: [130, 190], tones: [hairShade, hairDeep, hairShade], strands: 4 });
  // The long locks in front of the ear.
  tress(r.fork("side"), [[300, -780, 0.5], [262, -430, 1], [255, -130, 0.95], [305, 170, 0.8], [322, 420, 0.6], [272, 620, 0.35], [200, 770, 0]], [[190, -780, 0.5], [130, -460, 1], [108, -160, 0.95], [160, 140, 0.8], [186, 400, 0.6], [126, 640, 0.35], [10, 800, 0]], { n: 4, size: [100, 160], tones: [hairShade, hair, hairLight, hair], wave: 34, strands: 7 });
  // Bangs. One group falls past the temple to the cheekbone, one sweeps forward over the brow.
  tress(r.fork("temple"), [[300, -780, 0.6], [200, -480, 1], [135, -200, 0.9], [120, 20, 0.6], [165, 200, 0]], [[170, -780, 0.6], [40, -530, 1], [-12, -300, 0.85], [0, -110, 0.5], [52, 30, 0]], { n: 3, size: [120, 180], tones: [hairShade, hair, hairLight], wave: 24, strands: 5 });
  tress(r.fork("fringe"), [[150, -780, 0.6], [-10, -560, 1], [-122, -350, 0.85], [-152, -200, 0.45], [-104, -108, 0]], [[20, -780, 0.6], [-190, -630, 1], [-322, -430, 0.85], [-372, -255, 0.45], [-345, -120, 0]], { n: 4, size: [130, 190], tones: [hair, hairShade, hairLight, hair], wave: 20, strands: 7 });
  tress(r.fork("wind"), [[-60, -780, 0.5], [-250, -650, 0.9], [-400, -480, 0.7], [-470, -310, 0.3], [-455, -200, 0]], [[-140, -780, 0.4], [-330, -690, 0.8], [-500, -560, 0.5], [-590, -430, 0.2], [-640, -330, 0]], { n: 2, size: [80, 120], tones: [hairShade, hairLight] });
  // Over the shoulder.
  tress(r.fork("fall"), [[600, 150, 0.4], [590, 500, 1], [540, 850, 0.9], [575, 1150, 0.8], [540, 1500, 0.5]], [[500, 220, 0.4], [455, 520, 1], [400, 850, 0.9], [440, 1150, 0.8], [400, 1500, 0.5]], { n: 3, size: [130, 190], tones: [hair, hairShade, hairLight], wave: 30, strands: 5 });
  pt.dry();

  // ---------- light falling through ----------
  // Slivers of sun, all leaning the same way. x, y, length, width.
  const slivers: [number, number, number, number][] = [[-170, 150, 230, 62], [70, 420, 260, 54], [190, -360, 360, 110], [120, 860, 320, 76], [470, 480, 340, 90]];
  for (const [x, y, len, wd] of slivers) {
    const a = -0.95 + r.gauss(0, 0.08);
    const [dx, dy, nx, ny] = [Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, -Math.sin(a) * wd * 0.5, Math.cos(a) * wd * 0.5];
    // A lasso shape, not an oval: nine corners pulled about, barely rounded.
    const ring: Pt[] = [];
    for (let k = 0; k < 9; k++) {
      const t = (k / 9) * Math.PI * 2;
      const [u, v] = [Math.cos(t) * r.float(0.7, 1.15), Math.sin(t) * r.float(0.45, 1.25)];
      ring.push([x + dx * u + nx * v, y + dy * u + ny * v]);
    }
    pt.block(loop(F(ring), 3), { ...brush, color: mix(cream, skinLit, 0.5), size: 60, angle: a, load: 0.75, vary: 0.004 });
  }
  // The corner she faces burns out: loaded white, dragged until the brush runs dry.
  const gl = r.fork("glare");
  for (let i = 0; i < 16; i++) {
    const x = gl.float(-80, 640);
    const y = gl.float(-80, 560) * (1 - x / 1000);
    const a = gl.float(-1.15, -0.6);
    const len = gl.float(160, 420);
    pt.stroke([[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], { ...brush, bristle: 0.5, color: cream, size: gl.float(60, 170), reach: gl.float(1.2, 3) });
  }
  // Loose petals of light.
  for (let i = 0; i < 8; i++) {
    const [x, y] = [gl.float(0, W), gl.float(0, H)];
    const a = gl.float(-1.3, -0.5);
    const len = gl.float(40, 120);
    pt.stroke([[x, y, 0.3], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, 1], [x + Math.cos(a) * len, y + Math.sin(a) * len, 0.2]], { ...brush, color: cream, size: gl.float(26, 64), thin: 0.8, fade: 0.2 });
  }
  pt.dry();

  // ---------- drawn line ----------
  draw(PROFILE.slice(3), 6.5, { taper: [0.05, 0.1] });
  draw(NECK_FRONT, 6);
  // A second, lighter pass that misses the first by a hair, as a contour does when it is restated.
  draw(PROFILE.slice(6, 21).map(([x, y, pr]): Pt => [x + 5, y + 4, pr]), 3.2, { load: 0.5 });
  draw(NECK_FRONT.map(([x, y, pr]): Pt => [x + 6, y - 3, pr]), 3.2, { load: 0.5 });
  draw([[372, 30, 0.3], [420, -22, 1], [478, 0, 1], [506, 80, 0.9], [486, 170, 0.8], [440, 235, 0.9], [400, 268, 0.8], [372, 240, 0.5], [360, 190, 0.1]], 5);
  draw([[400, 40, 0.2], [446, 14, 1], [474, 70, 0.8], [456, 140, 0.6], [420, 196, 0.2]], 4);
  draw([[392, 110, 0.2], [420, 100, 1], [428, 150, 0.4]], 4);
  draw([[-338, 256, 1], [-322, 244, 0.6], [-310, 250, 0.1]], 4.5);
  draw([[-307, 384, 0.9], [-274, 383, 1], [-244, 392, 0.3]], 4.5, { color: lch(0.5, 0.12, 22) });
  // Loose strands across the face and off the back of the head.
  const strands: Pt[][] = [
    [[330, -500], [150, -120], [-60, 180], [-330, 330], [-520, 320]],
    [[280, -300], [240, 100], [120, 480], [-80, 720], [-260, 760]],
    [[240, -200], [180, 240], [40, 560], [-160, 700]],
    [[-100, -700], [-330, -500], [-470, -260], [-560, -80]],
    [[560, 100], [600, 500], [520, 900], [600, 1300]],
    [[180, -700], [60, -380], [20, -100], [70, 120]],
    [[-40, -700], [-200, -470], [-260, -250], [-230, -120]],
    [[450, -600], [520, -200], [560, 200], [520, 600]],
  ];
  for (const s0 of strands) draw(s0, r.float(3, 4.2), { taper: [0.2, 0.35] });

  // ---------- eye ----------
  const eye = p.layer("eye");
  const lid: Pt[] = [[-170, 4], [-150, -38], [-100, -66], [-40, -70], [14, -52], [54, -22], [80, 8]];
  const under: Pt[] = [[80, 8], [44, 28], [-20, 40], [-90, 40], [-146, 28], [-170, 4]];
  eye.clip([...curve(E(lid), 2), ...curve(E(under), 2)], () => {
    eye.fill(lch(0.975, 0.012, 80));
    eye.draw((ctx) => {
      ctx.translate(OX, OY);
      ctx.rotate(TH);
      ctx.scale(S, S);
      // Shadow of the lid on the white.
      const g0 = ctx.createLinearGradient(0, -70, 0, 10);
      g0.addColorStop(0, lch(0.8, 0.05, 40));
      g0.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g0;
      ctx.fillRect(-200, -90, 320, 110);
      // Iris.
      const [ix, iy, rx, ry] = [-97, -10, 45, 62];
      const g = ctx.createLinearGradient(0, iy - ry, 0, iy + ry);
      g.addColorStop(0, lch(0.4, 0.09, 285));
      g.addColorStop(0.42, lch(0.62, 0.1, 265));
      g.addColorStop(0.8, lch(0.85, 0.07, 235));
      g.addColorStop(1, lch(0.94, 0.05, 200));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = lch(0.4, 0.08, 290);
      ctx.stroke();
      // Fibres.
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        ctx.strokeStyle = i % 3 ? "rgba(255,255,255,0.22)" : "rgba(40,60,110,0.25)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ix + Math.cos(a) * rx * 0.45, iy + Math.sin(a) * ry * 0.45);
        ctx.lineTo(ix + Math.cos(a) * rx * 0.9, iy + Math.sin(a) * ry * 0.9);
        ctx.stroke();
      }
      // Pupil, then the light caught in the lower half.
      ctx.fillStyle = lch(0.27, 0.05, 280);
      ctx.beginPath();
      ctx.ellipse(ix, iy - 4, 18, 29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(235,255,245,0.55)";
      ctx.beginPath();
      ctx.ellipse(ix + 3, iy + 40, 26, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(ix - 19, iy - 30, 13, 12, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ix + 20, iy + 16, 5.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  // Lash line, lashes, crease, lower lid, brow.
  const lidLine: Pt[] = [[-176, 10, 0.2], [-152, -40, 0.5], [-100, -70, 0.8], [-40, -75, 0.95], [16, -56, 1], [58, -24, 1], [92, 6, 0.6], [120, 2, 0.1]];
  eye.stroke("ink", FE(lidLine), { color: lash, size: 13, thinning: 0.9 });
  // Fine lashes grow from the line, short and forward at the front, long and swept back at the outer corner.
  const le = r.fork("lash");
  const lidPath = spline(lidLine, 3);
  for (let k = 0; k < 17; k++) {
    const t = 0.06 + 0.9 * (k / 16);
    const s0 = lidPath[Math.round(t * (lidPath.length - 1))]!;
    const a = lerp(-2.75, -0.3, t) + le.gauss(0, 0.1);
    const len = lerp(18, 54, t ** 1.6) * le.float(0.7, 1.2);
    const bend = 0.25;
    if (k % 2 === 0 || t > 0.7) draw(E([[s0.x, s0.y, 1], [s0.x + Math.cos(a) * len * 0.55, s0.y + Math.sin(a) * len * 0.55, 0.7], [s0.x + Math.cos(a + bend) * len, s0.y + Math.sin(a + bend) * len, 0.2]]), 5, { color: lash, load: 1, tooth: 0.3, taper: [0, 0.3] });
  }
  draw(E([[-150, -76, 0.2], [-90, -102, 0.8], [-20, -106, 1], [50, -76, 0.7], [92, -40, 0.1]]), 4);
  const lower: Pt[] = [[92, 10, 0.9], [50, 33, 0.7], [-10, 45, 0.4], [-80, 46, 0.1]];
  draw(E(lower), 4.5, { color: mix(lash, pencil, 0.5) });
  const lowPath = spline(lower, 3);
  for (let k = 0; k < 5; k++) {
    const s0 = lowPath[Math.round((0.08 + 0.12 * k) * (lowPath.length - 1))]!;
    const a = 0.7 + k * 0.2;
    draw(E([[s0.x, s0.y, 1], [s0.x + Math.cos(a) * 15, s0.y + Math.sin(a) * 15, 0.2]]), 3, { taper: [0, 0.3] });
  }
  for (const dy of [0, 4]) draw(E([[-200, -152 + dy, 0.2], [-130, -180 + dy, 0.9], [-30, -184 + dy, 1], [60, -160 + dy, 0.6], [112, -130 + dy, 0.2]]), 5.5);
  eye.stroke("round", F([[-196, 150]]), { color: lash, size: 9, opacity: 0.9, hardness: 0.8 });


  // ---------- earring ----------
  const jewel = p.layer("jewel");
  const gold = lch(0.78, 0.11, 85);
  const fine = (pts: Pt[], size: number) => jewel.stroke("ink", F(pts), { color: gold, size, thinning: 0.3 });
  fine([[398, 262], [394, 300], [400, 330]], 4);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    jewel.stroke("lock", F([[400, 345, 0], [400 + Math.cos(a) * 17, 345 + Math.sin(a) * 17, 1], [400 + Math.cos(a) * 34, 345 + Math.sin(a) * 34, 0]]), { color: "#fffdf8", size: 30, line: gold, lineSize: 2.5 });
  }
  jewel.stroke("round", F([[400, 345]]), { color: gold, size: 16, opacity: 1, hardness: 0.7 });
  fine([[400, 372], [402, 410]], 3);
  jewel.stroke("round", F([[403, 428]]), { color: lch(0.97, 0.02, 80), size: 34, opacity: 1, hardness: 0.85 });
  jewel.stroke("round", F([[408, 434]]), { color: lch(0.86, 0.04, 310), size: 22, opacity: 0.5, hardness: 0.2 });
  jewel.stroke("round", F([[397, 421]]), { color: "#fff", size: 10, opacity: 1, hardness: 0.6 });

  p.post(bloom(0.3, 70, 0.82));
  p.post(grain(0.03));
}
