// Proof sheet for forms in space: solids with their light and cast shadows, a head that turns, and a posed mannequin.
import { ball, box, camera, figure, hand, head, lch, type Meta, mix, oval, type Painting, scene, type Solid, tube, type V3 } from "../engine/index.ts";

export const meta: Meta = { width: 1800, height: 1500, seed: 1 };

const PAPER = "#ece5d6";
const INK = lch(0.3, 0.03, 260);
const SHADE = lch(0.32, 0.05, 285);

export default function paint(p: Painting) {
  p.background = PAPER;
  const light: V3 = [0.6, -1, -0.45];
  const label = p.layer("label");
  /** Paint a set of solids far to near: a flat local color, the shade laid through a mask of 1 - lit, then the outline. */
  const render = (id: string, cam: ReturnType<typeof camera>, solids: Solid[], color: (s: Solid) => string, win: [number, number, number, number], floor = true) => {
    const sc = scene(cam, light, solids);
    const inWin = (x: number, y: number) => x >= win[0] && y >= win[1] && x < win[0] + win[2] && y < win[1] + win[3];
    if (floor) p.layer(`${id}-ground`).shape(p.mask((x, y) => (inWin(x, y) ? 1 - sc.ground(x, y) : 0)), SHADE, 0.35);
    const L = p.layer(id);
    for (const f of sc.forms) {
      if (f.outline.length < 3) continue;
      L.shape(f.outline, color(f.solid));
      L.clip(f.outline, () => L.shape(p.mask((x, y) => (f.covers(x, y) ? 1 - f.lit(x, y) : 0), 0, f.box), SHADE, 0.62));
      L.line(f.outline, INK, 2.2, true);
      for (const e of f.edges) L.line(e, INK, 1.4);
    }
    return sc;
  };

  // 1. Solids. Expected: a ball, a box and a standing cylinder on a ground plane. The light travels to the right, down and away from the viewer.
  // The ball turns dark toward its lower right. The box has a light top and a darker front. Each throws a shadow on the ground to its right.
  // The box shows the edges between its faces and the cylinder the rim of its top.
  {
    label.text("1 solids, light, cast shadow", 30, 44, { size: 26, color: INK });
    const cam = camera({ eye: [0, 5, 13], target: [0, 1, 0], fov: 40, width: 900, height: 500 });
    const cols = new Map<Solid, string>();
    const add = (s: Solid, c: string) => (cols.set(s, c), s);
    const solids = [
      add(ball([-1.7, 1, 0], 1), lch(0.8, 0.1, 40)),
      add(box([0.5, 1.2, -0.3], [1.6, 2.4, 1.6]), lch(0.82, 0.07, 100)),
      add(tube([3.4, 1.3, 0.5], 0.8, 2.6), lch(0.8, 0.07, 230)),
    ];
    render("solids", cam, solids, (s) => cols.get(s)!, [0, 0, 900, 500]);
  }

  // 2. A head turning. Expected: five heads from full face to profile (yaw 0, 0.4, 0.8, 1.2, 1.57), the last also tipped up.
  // The red centre line and brow line stay on the surface and bend with it. Eye, nose and mouth marks crowd toward the far side
  // as the head turns, and the far eye is hollow once the nose or the turn of the skull hides it.
  {
    label.text("2 head, turning", 930, 44, { size: 26, color: INK });
    const red = lch(0.55, 0.19, 30);
    [0, 0.4, 0.8, 1.2, 1.57].forEach((yaw, i) => {
      const [ox, oy, w, h] = [900 + (i % 3) * 300, 60 + Math.floor(i / 3) * 440, 300, 440];
      const cam = camera({ eye: [0, 0, 9], target: [0, -0.35, 0], fov: 26, width: w, height: h, left: ox, top: oy });
      const hd = head({ at: [0, 0, 0], size: 1, yaw, pitch: i === 4 ? 0.3 : 0 });
      const sc = render(`head${i}`, cam, hd.solids, () => lch(0.86, 0.05, 60), [ox, oy, w, h], false);
      const L = p.layer(`head${i}-marks`);
      const line = (uv: [number, number][]) => L.stroke("ink", cam.path(hd.curve(uv).filter((q) => sc.sees(q))), { color: red, size: 3, thinning: 0 });
      line(Array.from({ length: 40 }, (_, k): [number, number] => [0, 0.9 - k * 0.057]));
      line(Array.from({ length: 30 }, (_, k): [number, number] => [-0.72 + k * 0.05, 0.1]));
      for (const m of ["eyeL", "eyeR", "mouth", "noseBase"] as const) {
        const s = cam.project(hd.marks[m])!;
        const seen = sc.sees(hd.marks[m]);
        L.draw((ctx) => {
          ctx.beginPath();
          ctx.arc(s[0], s[1], 7, 0, 7);
          ctx.fillStyle = INK;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          seen ? ctx.fill() : ctx.stroke();
        });
      }
    });
  }

  // 3. A mannequin. Expected: three figures of the same height, seven and a half heads each. One stands facing us.
  // One strides in three-quarter view with the far arm forward. One sits with thighs level, shins down and a hand raised.
  // Limbs keep their lengths in every pose. Near limbs cover far ones, and the raised arm shades the chest under it.
  {
    label.text("3 mannequin, posed", 30, 544, { size: 26, color: INK });
    const cam = camera({ eye: [0, 3.2, 15], target: [0, 2.6, 0], fov: 36, width: 900, height: 950, top: 540 });
    const figs = [
      figure({ at: [-3.3, 0, 0], height: 5.2 }),
      figure({
        at: [0, 0, 0], height: 5.2, yaw: 0.75, hip: 3.8,
        pose: { thighL: [0, -1, 0.42], shinL: [0, -1, 0.1], thighR: [0, -1, -0.3], shinR: [0, -1, -0.75], upperArmL: [0.15, -1, -0.5], forearmL: [0.1, -1, -0.2], upperArmR: [-0.15, -1, 0.55], forearmR: [0, -0.6, 1] },
        head: { yaw: -0.3 },
      }),
      figure({
        at: [3.4, 0, 0], height: 5.2, yaw: -0.6, hip: 2.2,
        pose: { thighL: [0.12, -0.08, 1], thighR: [-0.12, -0.08, 1], shinL: [0, -1, 0.05], shinR: [0, -1, 0.05], upperArmR: [-0.3, -0.5, 0.8], forearmR: [0.1, 1, 0.3], forearmL: [0, -0.6, 0.8] },
        head: { pitch: 0.15 },
      }),
    ];
    const seat = box([3.4 + 0.25, 0.72, -0.38], [1.9, 1.44, 1.5]);
    const skin = [lch(0.84, 0.06, 55), lch(0.82, 0.07, 150), lch(0.82, 0.07, 250)];
    const owner = new Map<Solid, string>();
    figs.forEach((f, i) => f.solids.forEach((s) => owner.set(s, skin[i]!)));
    owner.set(seat, mix(PAPER, INK, 0.25));
    render("figures", cam, [...figs.flatMap((f) => f.solids), seat], (s) => owner.get(s)!, [0, 540, 900, 950]);
  }

  // 4. Solids taken as one part. Expected: a head at three-quarter view drawn as a single form. One outline runs round skull, jaw,
  // nose, ear and neck with no line where they overlap. The shade is continuous, and the jaw throws a shadow on the neck.
  // Dots mark the eyes and mouth, so the face reads as turned toward the right.
  {
    label.text("4 a part: one outline", 930, 984, { size: 26, color: INK });
    const cam = camera({ eye: [0, 0, 9], target: [0, -0.4, 0], fov: 26, width: 420, height: 500, left: 900, top: 990 });
    const hd = head({ at: [0, 0, 0], size: 1, yaw: 0.7, pitch: -0.05 });
    const part = scene(cam, light, hd.solids).part(hd.solids);
    const L = p.layer("part");
    const cover = p.mask(part.covers, 0, part.box);
    L.shape(cover, lch(0.86, 0.05, 60));
    L.atop(() => L.shape(p.mask((x, y) => (part.covers(x, y) ? 1 - part.lit(x, y) : 0), 0, part.box), SHADE, 0.62));
    for (const o of cover.outlines(0.6)) L.line(o, INK, 2.4, true);
    for (const m of ["eyeL", "eyeR", "mouth"] as const) {
      const s = cam.project(hd.marks[m])!;
      L.shape(oval(s[0], s[1], 6), INK);
    }
  }

  // 5. A hand. Expected: three right hands seen from the palm side, fingers up: open and spread, half closed, and a fist.
  // Each has a palm, four fingers of two joints, the little finger shortest, and a thumb on the viewer's right that folds across the palm as the hand closes.
  {
    label.text("5 hand, closing", 1350, 984, { size: 26, color: INK });
    const cam = camera({ eye: [0, 0.4, 9], target: [0, 0.5, 0], fov: 15, width: 480, height: 500, left: 1320, top: 990 });
    const hands = [0, 0.5, 1].map((curl, i) => hand({ at: [-1.1 + i * 1.1, 0, 0], dir: [0, 1, 0], palm: [0, 0, 1], size: 1, curl, spread: 1 - curl }));
    const sc = scene(cam, light, hands.flat());
    const L = p.layer("hands");
    for (const h of hands) {
      const part = sc.part(h);
      const cover = p.mask(part.covers, 0, part.box);
      L.shape(cover, lch(0.86, 0.05, 60));
      L.clip(cover, () => L.shape(p.mask((x, y) => (part.covers(x, y) ? 1 - part.lit(x, y) : 0), 0, part.box), SHADE, 0.62));
      for (const o of cover.outlines(0.6)) L.line(o, INK, 2, true);
    }
  }
}
