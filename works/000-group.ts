// Proof sheet for groups, copying a layer, and adjusting values.
import { lch, levels, media, type Meta, oval, type Painting, type Pt, rect } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1000, seed: 1 };

export default function paint(p: Painting) {
  p.background = "#f1ebdd";
  const ink = lch(0.3, 0.03, 260);
  const cell = (i: number): [number, number] => [(i % 4) * 400, Math.floor(i / 4) * 500];
  const label = p.layer("label");
  const title = (i: number, s: string) => label.text(s, cell(i)[0] + 24, cell(i)[1] + 44, { size: 24, color: ink });
  // One flower in its own coordinates, about 200 units tall, standing on the origin.
  const stem: Pt[] = [[0, 0, 0.6], [-8, -70, 1], [6, -150, 0.8]];
  const leaf: Pt[] = [[0, -60], [50, -100], [70, -80], [30, -50]];
  const three = (x: number, y: number) => [{ x: x + 70, y: y + 440 }, { x: x + 180, y: y + 440, s: 1.6, rot: 0.25 }, { x: x + 350, y: y + 440, s: 0.55, flip: true }];

  // 1. Canvas group. Expected: the same flower three times: as drawn, larger and leaning right, small and mirrored.
  // Stem thickness and the gradient in the head scale and turn with the flower. Nothing is redrawn by hand.
  {
    const [x, y] = cell(0);
    title(0, "1 canvas group");
    const L = p.layer("g1");
    for (const at of three(x, y)) {
      L.at(at, () => {
        L.stroke("ink", stem, { color: lch(0.45, 0.1, 150), size: 9 });
        L.shape(leaf, lch(0.7, 0.12, 140));
        L.clip(oval(6, -170, 34), () => L.grad([lch(0.9, 0.1, 90), lch(0.6, 0.19, 30)], [-10, -185], 50));
      });
    }
  }
  // 2. Wet group. Expected: the same three flowers in colored pencil. In the large one the pencil is thicker and the hatching
  // wider apart, in the small one finer. The hatch leans with the turned flower and the other way in the mirrored one.
  {
    const [x, y] = cell(1);
    title(1, "2 wet group");
    const W = p.wet("g2", { life: Infinity, impasto: 0 });
    for (const at of three(x, y)) {
      W.at(at, () => {
        W.stroke(stem, { ...media.colored, color: lch(0.45, 0.1, 150), size: 9 });
        W.hatch(leaf, { ...media.colored, color: lch(0.6, 0.13, 140), size: 5, angle: -0.5 });
        W.hatch(oval(6, -170, 34), { ...media.colored, color: lch(0.6, 0.19, 30), size: 5, angle: -0.5 });
      });
    }
  }
  // 3. Watercolor group. Expected: the same three flowers as wet washes. The brush is wider in the large one and narrower in the small one.
  {
    const [x, y] = cell(2);
    title(2, "3 water group");
    const A = p.water("g3");
    for (const at of three(x, y)) {
      A.at(at, () => {
        A.stroke(stem, { color: lch(0.5, 0.1, 150), size: 12, water: 0.5, pigment: 0.8 });
        A.stroke([[6, -170], [8, -168]], { color: lch(0.6, 0.19, 30), size: 60, water: 0.6, pigment: 0.8 });
      });
    }
    A.dry();
  }
  // 4. A layer copied onto a canvas layer. Expected: on the left two oil strokes, sharp, with bristle marks.
  // On the right the same strokes copied and blurred: soft, as if out of focus, and warped into a slow wave.
  {
    const [x, y] = cell(3);
    title(3, "4 copy, then blur and warp");
    const W = p.wet("g4-oil", { impasto: 0.4 });
    for (const dx of [0, 200]) {
      W.stroke([[x + 40 + dx, y + 150], [x + 110 + dx, y + 260], [x + 60 + dx, y + 430]], { ...media.oil, color: lch(0.55, 0.16, 250), size: 46 });
      W.stroke([[x + 150 + dx, y + 140], [x + 100 + dx, y + 300], [x + 160 + dx, y + 440]], { ...media.oil, color: lch(0.7, 0.16, 60), size: 46 });
    }
    W.lift(rect(x + 200, y + 60, x + 400, y + 500));
    const full = p.wet("g4-src", { impasto: 0.4 });
    full.opacity = 0;
    full.stroke([[x + 240, y + 150], [x + 310, y + 260], [x + 260, y + 430]], { ...media.oil, color: lch(0.55, 0.16, 250), size: 46 });
    full.stroke([[x + 350, y + 140], [x + 300, y + 300], [x + 360, y + 440]], { ...media.oil, color: lch(0.7, 0.16, 60), size: 46 });
    p.layer("g4-copy").copy(full).blur(14).warp((_, py) => [Math.sin(py / 30) * 10, 0], [x + 200, y + 60, 200, 440]);
  }
  // 5. Layer adjust. Expected: two copies of one pale row of five swatches. The top row is as painted, all light and close in value.
  // In the bottom row the same lightness range (about 78 to 94) is stretched to 35..94: the left swatch is clearly dark, the right one unchanged, hues kept.
  {
    const [x, y] = cell(4);
    title(4, "5 layer adjust");
    const row = (L: ReturnType<Painting["layer"]>, yy: number) => {
      for (let k = 0; k < 5; k++) L.shape(rect(x + 30 + k * 70, yy, x + 90 + k * 70, yy + 130), lch(0.8 + k * 0.035, 0.07, 40 + k * 40));
    };
    row(p.layer("g5-as-painted"), y + 110);
    const B = p.layer("g5-adjusted");
    row(B, y + 290);
    B.adjust({ from: [78, 94], to: [35, 94] });
  }
  // 6. Outline of a layer. Expected: three overlapping discs filled in one color, with a single ruled line round the whole clump and none inside it,
  // and a separate small disc with its own line.
  {
    const [x, y] = cell(5);
    title(5, "6 outline of a layer");
    const L = p.layer("g6");
    for (const [cx, cy, r] of [[150, 250, 80], [240, 300, 70], [180, 360, 60], [330, 160, 30]]) L.shape(oval(x + cx!, y + cy!, r!), lch(0.8, 0.09, 200));
    const O = p.layer("g6-line");
    for (const o of p.mask(L).outlines(0.4)) O.line(o, ink, 3, true);
  }
  // 7. Levels on the whole sheet. Expected: nothing visible here. The effect is declared with its identity range,
  // so this sheet proves it leaves a picture unchanged when it asks for no change. Its remapping is the same code as panel 5.
  label.text("7 levels(), identity over the sheet", cell(6)[0] + 24, cell(6)[1] + 44, { size: 24, color: ink });
  p.post(levels({}));
}
