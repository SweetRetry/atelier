// 暗箱 · Obscura, the mark
// A dark room, and the one point of light it lets in. The light is where an image begins.
// Focal point: the warm dot at the gap of the ring. Canvas layers in brush ink, because a mark
// must stay crisp at 16px and still show the hand that drew it.
import { grain, lch, type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1024, height: 1024, seed: 2 };

export const ROOM = lch(0.17, 0.012, 60);
export const ROOM_LOW = lch(0.12, 0.01, 50);
export const CHALK = lch(0.92, 0.035, 85);
export const LIGHT = lch(0.82, 0.16, 68);
export const LIGHT_CORE = lch(0.97, 0.06, 85);

/** The ring and the light, centred on (cx, cy) with outer radius r. Background not included. */
/** `weight` thickens the ring and the light, for the sizes where a hairline would vanish. */
export function mark(p: Painting, cx: number, cy: number, r: number, weight = 1) {
  // Ensō: one breath, counter-clockwise, leaving a narrow gap at the upper right.
  const GAP_AT = -0.72;
  const GAP = 0.62;
  const start = GAP_AT - GAP / 2;
  const sweep = Math.PI * 2 - GAP;
  const R = r * (0.82 - 0.04 * weight);
  const at = (t: number, wob: number): [number, number] => {
    const a = start - sweep * t;
    const k = 1 + wob * p.noise(t * 2.2, 1.7) + 0.03 * t;
    return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k];
  };
  const n = 140;
  const ring: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Loaded at the start, steady through the body, running dry in the last fifth.
    const pressure = t < 0.06 ? 0.75 + t * 4 : t < 0.72 ? 0.95 + 0.05 * p.noise(t * 6, 4) : 0.95 - 0.9 * ((t - 0.72) / 0.28) ** 1.2;
    const [x, y] = at(t, 0.025);
    ring.push([x, y, Math.max(0.1, pressure)]);
  }
  const ink = p.layer("ring");
  ink.stroke("ink", ring, { color: CHALK, size: r * 0.15 * weight, rough: 0.35 });
  // The tail splits into bristle streaks as the brush runs out.
  const tail = ring.slice(Math.round(n * 0.66)).map(([x, y], i, all): Pt => [x, y, 1 - 0.5 * (i / all.length) ** 2]);
  ink.stroke("dry", tail, { color: CHALK, size: r * 0.14 * weight, bristles: 70, dryness: 0.3, streak: 1.2, wobble: 0.6, opacity: 1 });

  // The light sits in the gap: where the room is open, light comes in.
  const lx = cx + Math.cos(GAP_AT) * R * 1.0;
  const ly = cy + Math.sin(GAP_AT) * R * 1.0;
  const glow = p.layer("glow", { blend: "screen" });
  glow.stroke("round", [[lx, ly], [lx + 0.1, ly]], { color: LIGHT, size: r * 0.85, opacity: 0.75 / weight, hardness: 0 });
  const dot = p.layer("light");
  dot.stroke("round", [[lx, ly], [lx + 0.1, ly]], { color: LIGHT, size: r * 0.2 * weight, hardness: 0.92 });
  dot.stroke("round", [[lx, ly], [lx + 0.1, ly]], { color: LIGHT_CORE, size: r * 0.15 * weight, hardness: 0.55, opacity: 1 });
}

export default function paint(p: Painting) {
  p.background = ROOM;
  const bg = p.layer("room");
  bg.vgrad([ROOM, ROOM_LOW]);
  mark(p, 512, 512, 430);
  p.post(grain(0.035));
}
