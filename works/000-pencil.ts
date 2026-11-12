// Proof sheet for colored pencil: the `colored` preset and `hatch`.
import { lch, loop, media, type Meta, type Painting } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1000, seed: 3 };

export default function paint(p: Painting) {
  p.background = "#f6f0e3";
  const label = p.layer("label");
  const ink = lch(0.45, 0.03, 60);
  const L = p.wet("pencil", { life: Infinity, impasto: 0 });
  const cp = { ...media.colored, size: 9 };
  const box = (x: number, y: number, w: number, h: number) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as [number, number][];
  const blue = lch(0.6, 0.12, 245);
  const yellow = lch(0.86, 0.15, 95);
  const pink = lch(0.72, 0.13, 10);
  const ochre = lch(0.7, 0.11, 70);

  // 1. Tone. Expect one box hatched at a slant, nearly bare paper at the left and solid blue at the right, with a straight cut outline.
  // Single strokes stay visible in the light half. Paper tooth shows as white specks everywhere but the far right.
  label.text("1 hatch graded by tone", 40, 50, { size: 26, color: ink });
  L.hatch(box(60, 80, 640, 260), { ...cp, color: blue, tone: (x) => (x - 60) / 640 });

  // 2. Layering. Expect yellow over blue to read green and pink over ochre to read salmon where they overlap, neither one grey.
  // The second color is hatched at another angle, so the overlap shows a cross-hatch.
  label.text("2 layers mix as pigment", 840, 50, { size: 26, color: ink });
  L.hatch(box(860, 80, 220, 260), { ...cp, color: blue, tone: () => 0.6 });
  L.hatch(box(960, 80, 220, 260), { ...cp, color: yellow, angle: -0.4, tone: () => 0.8 });
  L.hatch(box(1240, 80, 220, 260), { ...cp, color: ochre, tone: () => 0.6 });
  L.hatch(box(1340, 80, 220, 260), { ...cp, color: pink, angle: -0.4, tone: () => 0.8 });

  // 3. Form. Expect a ball lit from the upper left: pale yellow at the light, orange through the middle, red-brown with a little violet
  // in the lower right. The outline is the clean edge of the clip, not a drawn line.
  label.text("3 a form from four pencils", 40, 420, { size: 26, color: ink });
  const [cx, cy, R] = [300, 700, 230];
  const disc = loop([[cx - R, cy], [cx, cy - R], [cx + R, cy], [cx, cy + R]], 16);
  const lit = (x: number, y: number) => {
    const nx = (x - cx) / R;
    const ny = (y - cy) / R;
    return Math.max(0, -0.5 * nx - 0.6 * ny + 0.62 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)));
  };
  L.hatch(disc, { ...cp, color: yellow, tone: () => 0.5 });
  L.hatch(disc, { ...cp, color: lch(0.74, 0.16, 60), angle: -0.7, tone: (x, y) => 0.25 + 0.75 * (1 - lit(x, y)) });
  L.hatch(disc, { ...cp, color: lch(0.6, 0.17, 35), angle: -1.1, tone: (x, y) => 0.9 - 1.6 * lit(x, y) });
  L.hatch(disc, { ...cp, color: lch(0.5, 0.08, 310), angle: -0.5, tone: (x, y) => 0.55 - 1.6 * lit(x, y) });

  // 4. Edge and density. Left: the same leaf with a knife edge and with feather 14, expect the second to fade at the rim.
  // Right: gap 3 and three passes, expect a burnished patch with almost no paper showing. Then gap 14, expect separate lines.
  label.text("4 knife edge, feather, burnished, open, lift", 640, 420, { size: 26, color: ink });
  const leaf = (x: number) => loop([[x - 120, 700], [x - 20, 560], [x + 120, 640], [x + 40, 860]]);
  L.hatch(leaf(780), { ...cp, color: lch(0.62, 0.12, 150), tone: () => 0.8 });
  L.hatch(leaf(1040), { ...cp, color: lch(0.62, 0.12, 150), tone: () => 0.8, feather: 14 });
  for (let k = 0; k < 3; k++) L.hatch(box(1200, 500, 170, 360), { ...cp, color: pink, gap: 3, angle: -0.9 + k * 0.5 });
  L.hatch(box(1410, 500, 150, 360), { ...cp, color: pink, gap: 14 });

  // 5. Lift. Expect a clean disc of bare paper rubbed out of the burnished patch, then a blue disc hatched into a second rubbed-out
  // hole in the open patch. The blue stays blue, with no pink under it, and paper shows between its strokes.
  const dot = (x: number, y: number, r: number) => loop([[x - r, y], [x, y - r], [x + r, y], [x, y + r]], 16);
  L.lift(dot(1285, 600, 50));
  L.lift(dot(1485, 760, 60));
  L.hatch(dot(1485, 760, 60), { ...cp, color: blue, tone: () => 0.7 });
}
