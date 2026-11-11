// Proof sheet for cel marks on a canvas layer: the lock brush and bloom.
import { bloom, lch, loop, type Meta, type Painting } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 560, seed: 1 };

export default function paint(p: Painting) {
  p.background = "#f6efe2";
  const label = p.layer("label");
  const ink = lch(0.45, 0.03, 60);
  const line = lch(0.55, 0.09, 55);

  // 1. lock. Expect four flat shapes that close to a point where pressure reaches 0.
  // First: lined on both edges. Second: lined on one edge only. Third: grades from gold to pale at the tip. Fourth: no line.
  // The lines swell mid-stroke and vanish at both ends. The inside of the tight bend shows a small notch, see README limits.
  const a = p.layer("lock");
  label.text("1 lock: both edges, one edge, graded, unlined", 40, 50, { size: 26, color: ink });
  const s = (x: number): [number, number, number][] => [[x, 100, 0.1], [x + 50, 200, 1], [x - 30, 330, 0.7], [x + 40, 450, 0]];
  a.stroke("lock", s(90), { color: lch(0.88, 0.07, 90), size: 90, line, lineSize: 5 });
  a.stroke("lock", s(270), { color: lch(0.88, 0.07, 90), size: 90, line, lineSize: 5, sides: "a" });
  a.stroke("lock", s(450), { color: lch(0.8, 0.1, 85), tip: lch(0.97, 0.02, 90), size: 90, line, lineSize: 5 });
  a.stroke("lock", s(630), { color: lch(0.88, 0.07, 90), size: 90 });

  // 2. bloom. Expect a soft halo around the white bar and the pale disc, none around the dark bar.
  // The bloom is confined to this panel. The cream paper next to the panel is bright too, so it spills in along the left edge.
  label.text("2 bloom: halo around the light marks only", 840, 50, { size: 26, color: ink });
  const c = p.layer("bloom");
  c.shape([[820, 80], [1600, 80], [1600, 560], [820, 560]], lch(0.55, 0.06, 60));
  c.stroke("ink", [[920, 200], [1200, 200]], { color: "#fff", size: 40, thinning: 0 });
  c.stroke("ink", [[920, 400], [1200, 400]], { color: lch(0.3, 0.05, 60), size: 40, thinning: 0 });
  c.shape(loop([[1300, 300], [1400, 200], [1500, 300], [1400, 400]]), lch(0.97, 0.04, 90));
  const fx = bloom(0.9, 60, 0.7);
  p.post((d, w, h, pp) => {
    const before = d.slice();
    fx(d, w, h, pp);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 0.5125 * w || y < (80 / 560) * h) for (let k = 0; k < 4; k++) d[(y * w + x) * 4 + k] = before[(y * w + x) * 4 + k]!;
  });
}
