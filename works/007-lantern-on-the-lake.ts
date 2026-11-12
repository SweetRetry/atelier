// 湖上一盏灯 · Lantern on the Lake
// Says: in a wide pale mist, one small boat carries the only warm thing.
// Focal point: the vermilion lantern on the boat, right of centre, lower third. Strongest dark (boat) beside the only warm hue.
// Medium: watercolor layers. Mist and distance are wet in wet, the boat is a dry glaze on top, as real watercolor is built.
import { grain, lch, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1400, height: 1800, seed: 3 };

// Palette. One cool blue-grey family, one accent, paper.
const PAPER = "#f3eee3";
const MIST = lch(0.72, 0.05, 245);
const SKY_WARM = lch(0.86, 0.07, 75);
const FAR = lch(0.6, 0.06, 250);
const NEAR = lch(0.42, 0.07, 255);
const WATER = lch(0.62, 0.07, 235);
const DARK = lch(0.25, 0.04, 270);
const VERMILION = lch(0.58, 0.22, 35);

export default function paint(p: Painting) {
  p.background = PAPER;
  const rng = p.rng.fork("scene");

  // Sky: flood the paper, a pale warm glow low near the horizon, cool grey above.
  const sky = p.water("sky", { evaporation: 0.7 });
  sky.wetArea([[100, 300], [700, 380], [1300, 320]], { size: 700, water: 1 });
  sky.wetArea([[100, 760], [700, 780], [1300, 760]], { size: 360, water: 1 });
  sky.stroke([[60, 120], [700, 170], [1340, 120]], { color: MIST, size: 300, water: 0.9, pigment: 0.6 });
  sky.stroke([[60, 640], [700, 660], [1340, 640]], { color: SKY_WARM, size: 220, water: 0.9, pigment: 0.8 });
  sky.stroke([[560, 700], [900, 690], [1250, 700]], { color: lch(0.88, 0.1, 60), size: 170, water: 0.9, pigment: 0.8 });
  sky.stroke([[40, 340], [300, 315], [620, 330]], { color: lch(0.62, 0.05, 255), size: 40, water: 0.6, pigment: 0.4 });
  sky.stroke([[760, 440], [1050, 410], [1420, 430]], { color: lch(0.66, 0.05, 255), size: 34, water: 0.6, pigment: 0.4 });
  sky.flow(90);
  sky.wetArea([[300, 170]], { size: 90, water: 1.4 });
  sky.wetArea([[980, 130]], { size: 70, water: 1.4 });
  sky.dry();

  // Far hills, wet in wet so the tops dissolve into the sky.
  const far = p.water("far", { evaporation: 0.8 });
  const ridge = (y: number, amp: number, x0 = 0): Pt[] =>
    Array.from({ length: 8 }, (_, i) => [x0 + i * 200, y - Math.sin(i * 1.3 + 1) * amp - rng.float(0, amp * 0.5)] as Pt);
  far.wetArea(ridge(790, 40), { size: 160, water: 0.9 });
  far.stroke(ridge(830, 40), { color: FAR, size: 120, water: 0.8, pigment: 0.55 });
  far.stroke([[0, 880], [700, 880], [1400, 880]], { color: MIST, size: 80, water: 0.9, pigment: 0.3 });
  far.flow(70);
  far.dry();

  const mid = p.water("mid", { evaporation: 0.8 });
  mid.wetArea([[760, 840], [1100, 820], [1450, 850]], { size: 120, water: 0.7 });
  mid.stroke([[700, 860], [920, 830], [1160, 845], [1460, 820]], { color: lch(0.5, 0.07, 255), size: 85, water: 0.55, pigment: 0.75 });
  mid.flow(40);
  mid.dry();

  // Nearer headland on the left, a darker glaze over the dry far hills.
  const near = p.water("near", { evaporation: 0.8 });
  near.wetArea([[0, 800], [200, 860], [420, 900]], { size: 220, water: 0.7 });
  near.stroke([[-40, 780], [160, 820], [380, 880], [560, 905]], { color: NEAR, size: 150, water: 0.6, pigment: 0.8 });
  near.stroke([[-40, 850], [220, 890], [440, 910]], { color: NEAR, size: 100, water: 0.5, pigment: 0.7 });
  near.flow(50);
  near.dry();

  const trees = p.water("trees", { evaporation: 0.9 });
  const tr = p.rng.fork("trees");
  const treeInk = lch(0.22, 0.05, 255);
  for (let i = 0; i < 40; i++) {
    const x = 30 + i * 11 + tr.float(-6, 6);
    const base = 815 + i * 2.2;
    if (tr.chance(0.3)) continue;
    const h = tr.float(25, 115) * (i > 30 ? 0.6 : 1) * (0.6 + 0.4 * Math.sin(i * 0.7) ** 2);
    trees.stroke([[x, base], [x + tr.float(-3, 3), base - h]], { color: treeInk, size: tr.float(4, 7), water: 0.2, pigment: tr.float(0.4, 0.8) });
    trees.stroke([[x - 8, base - h * 0.35], [x + 8, base - h * 0.45]], { color: treeInk, size: 5, water: 0.2, pigment: 0.45 });
  }
  trees.flow(25);
  trees.dry();

  // Lake: horizontal strokes, lighter toward the horizon.
  const lake = p.water("lake", { evaporation: 0.6 });
  lake.wetArea([[-100, 1150], [700, 1180], [1500, 1150], [700, 1500], [-100, 1600], [1500, 1650]], { size: 520, water: 0.9 });
  for (let i = 0; i < 9; i++) {
    const y = 930 + i * 95 + rng.float(-12, 12);
    lake.stroke([[-120, y], [500, y + rng.float(-8, 8)], [1100, y + rng.float(-8, 8)], [1520, y]], {
      color: i < 3 ? SKY_WARM : WATER, size: 60 + i * 8, water: 0.75, pigment: 0.25 + i * 0.05,
    });
  }
  lake.flow(60);
  lake.dry();

  // Reflection of the boat and lantern, a vertical smear, laid before the boat so it reads beneath.
  const BX = 880, BY = 1130;
  const refl = p.water("reflection", { evaporation: 0.8 });
  refl.wetArea([[BX - 10, BY + 40], [BX - 6, BY + 160]], { size: 170, water: 1 });
  for (const [dx, len, pg] of [[-70, 90, 0.2], [-30, 170, 0.26], [10, 130, 0.22], [50, 70, 0.18], [-110, 50, 0.14]] as const) {
    refl.stroke([[BX + dx, BY + 28], [BX + dx + 5, BY + 28 + len * 0.5], [BX + dx - 3, BY + 28 + len]], { color: DARK, size: 34, water: 0.9, pigment: pg });
  }
  refl.stroke([[BX + 120, BY + 30], [BX + 122, BY + 80], [BX + 118, BY + 150]], { color: VERMILION, size: 14, water: 0.6, pigment: 0.35 });
  refl.flow(40);
  refl.dry();

  const glow = p.water("glow", { evaporation: 0.7 });
  glow.wetArea([[BX + 120, BY - 70]], { size: 220, water: 1 });
  glow.stroke([[BX + 120, BY - 100], [BX + 120, BY - 80]], { color: lch(0.85, 0.15, 70), size: 150, water: 0.9, pigment: 0.55 });
  glow.flow(40);
  glow.dry();

  // Boat: a dry dark glaze, a low curved hull, a small cabin, a lantern pole.
  const boat = p.water("boat", { evaporation: 1 });
  boat.stroke([[BX - 170, BY - 6], [BX - 80, BY + 10], [BX + 90, BY + 10], [BX + 180, BY - 14]], { color: DARK, size: 16, water: 0.25, pigment: 1 });
  boat.stroke([[BX - 50, BY - 22], [BX + 40, BY - 22]], { color: DARK, size: 22, water: 0.2, pigment: 0.9 });
  boat.stroke([[BX + 120, BY - 8], [BX + 120, BY - 110]], { color: DARK, size: 4, water: 0.15, pigment: 1 });
  boat.stroke([[BX - 8, BY - 34], [BX - 6, BY - 62]], { color: DARK, size: 12, water: 0.2, pigment: 1 });
  boat.stroke([[BX - 28, BY - 66], [BX - 6, BY - 78], [BX + 16, BY - 66]], { color: DARK, size: 8, water: 0.2, pigment: 1 });
  boat.stroke([[BX - 150, BY + 28], [BX + 40, BY - 70]], { color: DARK, size: 3, water: 0.15, pigment: 0.9 }); // the pole
  boat.dry();

  // Accent. The lantern, the only warm saturated mark.
  const lamp = p.water("lantern", { evaporation: 1 });
  lamp.stroke([[BX + 120, BY - 104], [BX + 121, BY - 86]], { color: VERMILION, size: 30, water: 0.3, pigment: 1 });
  lamp.dry();

  // Cold rain-streaks of mist over the far water, one soft band, kept pale.
  const veil = p.water("veil", { evaporation: 0.9 });
  veil.wetArea([[0, 900], [700, 910], [1400, 900]], { size: 120, water: 1 });
  veil.stroke([[0, 905], [700, 915], [1400, 905]], { color: lch(0.9, 0.02, 240), size: 60, water: 1, pigment: 0.25 });
  veil.flow(40);
  veil.dry();

  const fore = p.water("fore", { evaporation: 1 });
  const fr = p.rng.fork("reeds");
  const REEDS = [lch(0.4, 0.04, 200), lch(0.46, 0.04, 170), lch(0.42, 0.04, 110)];
  for (let i = 0; i < 22; i++) {
    const x = 1060 + fr.float(0, 330);
    const top = 1330 + fr.float(-70, 40) - (x - 1060) * 0.08;
    const sway = fr.float(-45, 10);
    fore.stroke([[x + sway * 0.3, 1810], [x + sway * 0.15, (top + 1810) / 2], [x + sway, top]], { color: REEDS[i % 3]!, size: fr.float(3, 6), water: 0.15, pigment: fr.float(0.4, 0.7) });
  }
  for (let i = 0; i < 8; i++) {
    const x = 1130 + fr.float(0, 260);
    const y = 1400 + fr.float(-40, 60);
    fore.stroke([[x, y], [x + 5, y - 34]], { color: lch(0.3, 0.08, 50), size: 11, water: 0.15, pigment: 0.6 });
  }
  fore.dry();
  const birds = p.layer("birds", { blend: "multiply" });
  for (const [bx, by] of [[430, 300], [510, 340], [560, 280], [610, 330]] as const) {
    birds.stroke("ink", [[bx - 16, by + 4], [bx, by - 5], [bx + 16, by + 5]], { color: lch(0.3, 0.03, 260), size: 3, opacity: 0.8, taper: [0.8, 0.8] });
  }
  const lights = p.layer("lights", { blend: "normal" });
  const lr = p.rng.fork("lights");
  for (let i = 0; i < 18; i++) {
    const y = 1220 + i * 28 + lr.float(-6, 6);
    const x = lr.float(100, 1100);
    lights.stroke("ink", [[x, y], [x + lr.float(60, 190), y + lr.float(-2, 2)]], { color: "#f6f1e6", size: 3, opacity: 0.5, taper: [0.9, 0.9] });
  }

  for (let i = 0; i < 14; i++) {
    const y = BY + 40 + i * 14 + lr.float(-3, 3);
    const x = BX - 90 + lr.float(-20, 40);
    lights.stroke("ink", [[x, y], [x + lr.float(50, 150), y + lr.float(-1, 1)]], { color: "#e4ebea", size: 6, opacity: 0.9, taper: [0.9, 0.9] });
  }

  p.post(grain(0.04));
}
