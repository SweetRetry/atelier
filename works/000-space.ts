// Proof sheet for space and light: camera, lambert shading, cast shadows, depth blur, lettering.
import { camera, groundShadow, lambert, lch, type Meta, mix, type Painting, type Pt, type V3 } from "../engine/index.ts";

export const meta: Meta = { width: 1600, height: 1000, seed: 1 };

export default function paint(p: Painting) {
  p.background = "#e9e2d2";
  // p.time swings the camera, so --frames gives a turntable.
  const ang = -0.5 + p.time * 1.0;
  const cam = camera({ eye: [Math.sin(ang) * 14, 4.2, -Math.cos(ang) * 14], target: [0, 0.8, 0], fov: 42, width: 1600, height: 1000 });
  const light: V3 = [0.55, -1, 0.35];
  const quad = (L: ReturnType<Painting["layer"]>, pts: V3[], color: string) =>
    L.draw((ctx) => {
      const s = pts.map((q) => cam.project(q));
      if (s.some((q) => !q)) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      s.forEach((q, i) => (i ? ctx.lineTo(q![0], q![1]) : ctx.moveTo(q![0], q![1])));
      ctx.fill();
    });

  // Ground grid, lines thinning with distance.
  const ground = p.layer("ground");
  for (let i = -10; i <= 10; i++) {
    for (const [a, b] of [[[i, 0, -10], [i, 0, 14]], [[-10, 0, i + 2], [10, 0, i + 2]]] as [V3, V3][]) {
      const pts: Pt[] = [];
      for (let k = 0; k <= 12; k++) {
        const q: V3 = [a[0] + ((b[0] - a[0]) * k) / 12, 0, a[2] + ((b[2] - a[2]) * k) / 12];
        const s = cam.project(q);
        if (s) pts.push([s[0], s[1], Math.min(1, s[2] / 90)]);
      }
      if (pts.length > 1) ground.stroke("ink", pts, { color: lch(0.6, 0.02, 80), size: 5, thinning: 0.9 });
    }
  }

  // Boxes. Each face gets its tone from the light. Shadows are the top faces projected onto the ground.
  const boxes: { c: V3; s: V3; col: string }[] = [
    { c: [-3.2, 0, 1], s: [1.6, 2.6, 1.6], col: lch(0.62, 0.13, 30) },
    { c: [0.4, 0, -1], s: [2.2, 1.2, 2.2], col: lch(0.7, 0.1, 90) },
    { c: [3.4, 0, 3], s: [1.4, 3.6, 1.4], col: lch(0.55, 0.1, 240) },
    { c: [1.2, 0, 9], s: [3, 2, 2], col: lch(0.6, 0.09, 150) },
  ];
  const shadows = p.layer("shadows", { blend: "multiply" });
  const far = p.layer("far");
  const near = p.layer("near");
  boxes.sort((a, b) => cam.depth(b.c) - cam.depth(a.c));
  for (const b of boxes) {
    const [x0, x1, y1, z0, z1] = [b.c[0] - b.s[0] / 2, b.c[0] + b.s[0] / 2, b.s[1], b.c[2] - b.s[2] / 2, b.c[2] + b.s[2] / 2];
    const top: V3[] = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    quad(shadows, [...top.map((q) => groundShadow(q, light))], lch(0.45, 0.04, 280));
    quad(shadows, [[x0, 0, z0], [x1, 0, z0], ...[top[1]!, top[0]!].map((q) => groundShadow(q, light))], lch(0.45, 0.04, 280));
    quad(shadows, [[x1, 0, z0], [x1, 0, z1], ...[top[2]!, top[1]!].map((q) => groundShadow(q, light))], lch(0.45, 0.04, 280));
    quad(shadows, [[x0, 0, z1], [x1, 0, z1], ...[top[2]!, top[3]!].map((q) => groundShadow(q, light))], lch(0.45, 0.04, 280));
    quad(shadows, [[x0, 0, z0], [x0, 0, z1], ...[top[3]!, top[0]!].map((q) => groundShadow(q, light))], lch(0.45, 0.04, 280));
    const L = cam.depth(b.c) > 20 ? far : near;
    const tone = (n: V3) => mix(lch(0.2, 0.04, 280), b.col, 0.35 + 0.65 * lambert(n, light));
    const faces: [V3[], V3][] = [
      [[[x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
      [[[x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]],
      [[[x1, 0, z0], [x1, 0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]],
      [[[x0, 0, z0], [x1, 0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
      [top, [0, 1, 0]],
    ];
    // Far faces first.
    faces.sort((f, g) => cam.depth(g[0][0]!.map((v, i) => (v + g[0][2]![i]!) / 2) as V3) - cam.depth(f[0][0]!.map((v, i) => (v + f[0][2]![i]!) / 2) as V3));
    for (const [pts, n] of faces) quad(L, pts, tone(n));
  }
  shadows.blur(10);
  far.blur(9);

  const label = p.layer("label");
  label.text("space, light, shadow, focus", 60, 80, { size: 44, color: lch(0.3, 0.02, 280), italic: true });
  label.text("空间 光 影 焦点", 60, 136, { size: 34, color: lch(0.45, 0.02, 280) });
}
