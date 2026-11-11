// Proof sheet. Every brush at several sizes, so a change to the engine shows up in one image.
import { grain, lch, type Meta, mix, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 2000, height: 1500, seed: 7 };

const wave = (x0: number, y: number, len: number, amp: number): Pt[] =>
  Array.from({ length: 7 }, (_, i) => [x0 + (len * i) / 6, y + Math.sin(i * 1.3) * amp, 0.35 + 0.65 * Math.sin((i / 6) * Math.PI)] as Pt);

export default function paint(p: Painting) {
  p.background = "#f3ede0";
  const ink = "#1d1b22";
  const sizes = [0.4, 1, 2.2];

  const soft = p.layer("wash", { blend: "multiply" });
  const marks = p.layer("marks");

  // Column 1: round, soft then hard.
  sizes.forEach((k, i) => {
    marks.stroke("round", wave(90, 130 + i * 110, 520, 30), { color: lch(0.55, 0.16, 25), size: 34 * k, opacity: 0.35 });
    marks.stroke("round", wave(90, 480 + i * 110, 520, 30), { color: lch(0.5, 0.13, 250), size: 34 * k, hardness: 0.9, opacity: 0.9 });
  });

  // Column 2: ink with taper, then dry at three levels of dryness.
  sizes.forEach((k, i) => {
    marks.stroke("ink", wave(720, 130 + i * 110, 520, 40), { color: ink, size: 14 * k, taper: [0.1, 0.3] });
    marks.stroke("dry", wave(720, 480 + i * 130, 520, 25), { color: lch(0.35, 0.08, 150), size: 60, dryness: 0.2 + i * 0.3 });
  });

  // Column 3: wash as stroke, then wash as area, overlapping to show multiply glazing.
  soft.stroke("wash", wave(1360, 150, 520, 40), { color: lch(0.6, 0.14, 230), size: 70 });
  soft.stroke("wash", wave(1360, 300, 520, -40), { color: lch(0.7, 0.15, 80), size: 110, bleed: 0.8 });
  const blob = (cx: number, cy: number, r: number): Pt[] =>
    Array.from({ length: 12 }, (_, i) => [cx + Math.cos((i / 12) * Math.PI * 2) * r, cy + Math.sin((i / 12) * Math.PI * 2) * r] as Pt);
  soft.stroke("wash", blob(1500, 620, 150), { color: lch(0.55, 0.17, 20), area: true });
  soft.stroke("wash", blob(1700, 680, 150), { color: lch(0.6, 0.13, 200), area: true, bleed: 0.25 });

  // Between the columns and the band: the three textured tips.
  marks.stroke("stamp", wave(90, 820, 520, 20), { color: lch(0.4, 0.1, 150), size: 90, tip: "sponge" });
  marks.stroke("stamp", wave(720, 830, 520, 20), { color: lch(0.4, 0.12, 30), size: 60, tip: "chalk", rotate: "follow", scatter: 0.03, opacity: 0.8 });
  marks.stroke("stamp", wave(1360, 850, 520, 20), { color: ink, size: 90, tip: "speckle", opacity: 0.9 });

  // Bottom band: perceptual color ramp built from many dry strokes.
  for (let i = 0; i < 40; i++) {
    const x = 90 + i * 46;
    marks.stroke("dry", [[x, 930], [x + 10, 1150], [x - 6, 1380]], {
      color: mix(lch(0.75, 0.14, 70), lch(0.3, 0.1, 280), i / 39),
      size: 52,
      dryness: 0.25,
      bristles: 40,
    });
  }

  p.post(grain(0.05));
}
