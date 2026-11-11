// Proof sheet for opaque paint laid with a flat brush: the flat tip, tapering, clipping and blocking in, with pencil over it.
import { lch, loop, media, type Meta, type Painting } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1000, seed: 3 };

export default function paint(p: Painting) {
  p.background = "#f4ecdd";
  const label = p.layer("label");
  const ink = lch(0.45, 0.03, 60);
  const w = p.wet("paint", { impasto: 0.12 });
  const peach = lch(0.82, 0.08, 50);
  const lilac = lch(0.72, 0.08, 300);

  // 1. Tip. Expect the top mark to have round soft ends (round tip) and the second to have straight sides and square ends (flat tip).
  // The third is a flat tip on a curve: the square end turns with the stroke.
  label.text("1 round tip, flat tip, flat on a curve", 40, 50, { size: 26, color: ink });
  w.stroke([[60, 110], [700, 110]], { ...media.oil, color: peach, size: 70 });
  w.stroke([[60, 220], [700, 220]], { ...media.gouache, color: peach, size: 70 });
  w.stroke([[60, 430], [300, 320], [520, 360], [700, 460]], { ...media.gouache, color: peach, size: 70 });

  // 2. Thin. Expect three marks that start wide. With thin 0.55 the far end stays blunt, with thin 1 it closes to a point.
  // The third crosses the second while it is wet and drags a little lilac into the peach.
  label.text("2 thin 0.55, thin 1, wet over wet, fade 0", 840, 50, { size: 26, color: ink });
  w.stroke([[860, 120, 1], [1200, 150, 0.6], [1540, 120, 0]], { ...media.gouache, color: lilac, size: 90 });
  w.stroke([[860, 270, 1], [1200, 300, 0.6], [1540, 270, 0]], { ...media.gouache, color: lilac, size: 90, thin: 1 });
  w.stroke([[1000, 200, 0.2], [1100, 300, 1], [1160, 440, 0]], { ...media.gouache, color: peach, size: 80, thin: 1, pickup: 0.6 });
  // The fourth has thin 1 and fade 0: it narrows to the same point but stays fully loaded all the way.
  w.stroke([[1240, 400, 1], [1400, 420, 0.6], [1560, 400, 0]], { ...media.gouache, color: lilac, size: 90, thin: 1, fade: 0 });

  // 3. Clip. Expect the same three horizontal strokes cut to a leaf shape, left with a knife edge, right with a feathered edge.
  label.text("3 clip: knife edge, feathered edge", 40, 540, { size: 26, color: ink });
  w.dry();
  const leaf = (cx: number) => loop([[cx - 170, 760], [cx - 40, 640], [cx + 170, 700], [cx + 60, 900]]);
  [220, 600].forEach((cx, k) =>
    w.clip(
      leaf(cx),
      () => {
        for (let i = 0; i < 4; i++) w.stroke([[cx - 220, 640 + i * 75], [cx + 220, 650 + i * 75]], { ...media.gouache, color: i % 2 ? peach : lilac, size: 90 });
      },
      k ? 40 : 0,
    ),
  );

  // 4. Block. Expect a disc laid in with slanted brush marks of slightly different tone, with a clean outline,
  // a smaller pale shape blocked over it after drying, and three pencil lines on top that catch the paper tooth.
  label.text("4 block, block over dry, pencil on top", 840, 540, { size: 26, color: ink });
  w.dry();
  w.block(loop([[900, 770], [1180, 600], [1500, 760], [1200, 950]]), { ...media.gouache, color: peach, size: 60, angle: -0.9, vary: 0.03 });
  w.dry();
  w.block(loop([[1100, 700], [1250, 660], [1330, 800], [1150, 840]]), { ...media.gouache, color: lch(0.97, 0.02, 90), size: 40, angle: -0.9, vary: 0.01 });
  const d = p.wet("pencil", { life: Infinity, impasto: 0 });
  for (let i = 0; i < 3; i++) d.stroke([[900, 650 + i * 90, 0.3], [1200, 620 + i * 90, 1], [1520, 680 + i * 90, 0.2]], { ...media.pencil, color: lch(0.5, 0.09, 50), size: 5 });
}
