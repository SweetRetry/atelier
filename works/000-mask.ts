// Proof sheet for masks, erasing, gradients and placed shapes. One mask type serves canvas, wet and watercolor layers.
import { lch, media, type Meta, oval, type Painting, place, type Pt, rect } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1000, seed: 1 };

export default function paint(p: Painting) {
  p.background = "#f1ebdd";
  const ink = lch(0.3, 0.03, 260);
  const red = lch(0.58, 0.19, 30);
  const blue = lch(0.5, 0.13, 250);
  const cell = (i: number): [number, number] => [(i % 4) * 400, Math.floor(i / 4) * 500];
  const label = p.layer("label");
  const title = (i: number, s: string) => label.text(s, cell(i)[0] + 24, cell(i)[1] + 44, { size: 24, color: ink });
  const rows = (x: number, y: number, fn: (pts: Pt[], k: number) => void) => {
    for (let k = 0; k < 14; k++) fn([[x + 30, y + 90 + k * 28], [x + 370, y + 70 + k * 28]], k);
  };

  // 1. Canvas, a clip with a hole. Expected: ink rows only inside the ring. The middle and the outside stay bare, with hard edges.
  {
    const [x, y] = cell(0);
    title(0, "1 canvas clip, hole");
    const L = p.layer("c1");
    L.clip([oval(x + 200, y + 270, 160), oval(x + 200, y + 270, 80)], () => rows(x, y, (pts) => L.stroke("ink", pts, { color: ink, size: 14 })));
  }
  // 2. Canvas, a feathered clip. Expected: a diagonal red to blue gradient in a rounded rectangle whose edge fades out over about 40 units.
  {
    const [x, y] = cell(1);
    title(1, "2 canvas clip, feather");
    const L = p.layer("c2");
    L.clip(rect(x + 70, y + 130, x + 330, y + 420, 50), () => L.grad([red, blue], [x + 70, y + 130], [x + 330, y + 420]), 40);
  }
  // 3. Canvas, erase. Expected: a solid blue block with a clean round hole on the left and a soft-edged one on the right. Paper shows through both.
  {
    const [x, y] = cell(2);
    title(2, "3 canvas erase");
    const L = p.layer("c3");
    L.shape(rect(x + 40, y + 120, x + 360, y + 430), blue);
    L.erase(oval(x + 130, y + 275, 60));
    L.erase(oval(x + 280, y + 275, 50), 30);
  }
  // 4. A layer as a mask, with shapes placed. Expected: three leaves from one outline (upright, turned and mirrored smaller).
  // Red rows on a second layer appear only where the leaves are painted.
  {
    const [x, y] = cell(3);
    title(3, "4 layer as mask, place");
    const leaf: Pt[] = [[0, -110], [45, -60], [60, 20], [20, 100], [0, 120], [-10, 90], [-40, 10], [-30, -70]];
    const A = p.layer("c4-leaves");
    for (const at of [{ x: x + 110, y: y + 280 }, { x: x + 250, y: y + 200, rot: 0.9 }, { x: x + 290, y: y + 380, s: 0.6, flip: true }]) A.shape(place(at)(leaf), lch(0.78, 0.1, 130));
    const B = p.layer("c4-veins");
    B.clip(p.mask(A), () => rows(x, y, (pts) => B.stroke("ink", pts, { color: red, size: 8 })));
  }
  // 5. Wet layer, clip and lift with the same areas. Expected: gouache laid in a ring with a clean hole, then a soft diagonal band rubbed out of it back to paper.
  {
    const [x, y] = cell(4);
    title(4, "5 wet clip, lift");
    const W = p.wet("w5", { impasto: 0.1 });
    const ring = [oval(x + 200, y + 280, 165), oval(x + 200, y + 280, 70)];
    W.clip(ring, () => W.block(rect(x + 20, y + 100, x + 380, y + 460), { ...media.gouache, color: red, size: 60, angle: -0.6, vary: 0.01 }));
    W.dry();
    W.lift(place({ x: x + 200, y: y + 280, rot: -0.6 })(rect(-220, -18, 220, 18)), 10);
  }
  // 6. Watercolor, masking fluid. Expected: a wet blue wash with a white moon and a thin white line kept through it.
  // Both have crisp edges, sharper than the 3 unit simulation grid, and no blue creeps into them.
  {
    const [x, y] = cell(5);
    title(5, "6 water reserve");
    const A = p.water("a6");
    A.reserve(oval(x + 250, y + 220, 55));
    A.reserve(place({ x: x + 200, y: y + 380, rot: -0.3 })(rect(-150, -3, 150, 3)));
    A.wetArea([[x + 110, y + 190], [x + 290, y + 190], [x + 110, y + 300], [x + 290, y + 300], [x + 110, y + 400], [x + 290, y + 400]], { size: 110 });
    for (let k = 0; k < 4; k++) A.stroke([[x + 100, y + 170 + k * 78], [x + 300, y + 185 + k * 78]], { color: blue, size: 90, water: 0.9, pigment: 0.8 });
    A.dry();
  }
  // 7. Watercolor, clip and lift. Expected: a red wash kept to a circle with a ragged watercolor edge, then a paler soft band lifted across it.
  {
    const [x, y] = cell(6);
    title(6, "7 water clip, lift");
    const A = p.water("a7");
    A.clip(oval(x + 200, y + 280, 150), () => {
      for (let k = 0; k < 4; k++) A.stroke([[x + 30, y + 130 + k * 95], [x + 370, y + 150 + k * 95]], { color: red, size: 120, water: 0.7, pigment: 0.8 });
    });
    A.dry();
    A.lift(rect(x + 30, y + 255, x + 370, y + 305), 0.75, 16);
  }
  // 8. Gradients and a tone laid through a mask. Expected: on the left a disc lit from the upper left by a round gradient.
  // On the right a flat disc shaded by a function: dark on its lower right, fading to nothing toward the light.
  {
    const [x, y] = cell(7);
    title(7, "8 round grad, tone mask");
    const L = p.layer("c8");
    L.clip(oval(x + 110, y + 280, 85), () => L.grad([lch(0.95, 0.04, 90), lch(0.7, 0.13, 60), lch(0.4, 0.1, 30)], [x + 80, y + 250], 150));
    L.shape(oval(x + 290, y + 280, 85), lch(0.8, 0.12, 70));
    L.atop(() => L.shape(p.mask((px, py) => ((px - (x + 290)) * 0.6 + (py - (y + 280)) * 0.6) / 85 + 0.2), lch(0.35, 0.08, 300), 0.8));
  }
}
