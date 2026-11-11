// 有人醒着 / Someone Is Awake
// Blue hour over a lake. Ridges fade into mist. One window is lit.
import { clamp, type Ctx, grain, lch, type Meta, mix, type Painting, type Pt, ramp, type Rng, shift, vignette } from "../engine/index.ts";

export const meta: Meta = { width: 2400, height: 3000, seed: 11 };

const W = 2400;
const H = 3000;
const HOR = 1880; // waterline
const HOUSE_X = 1540;

/** A conifer silhouette: tiers of drooping branches, each side irregular. */
function conifer(ctx: Ctx, x: number, y: number, h: number, w: number, lean: number, r: Rng) {
  const tiers = clamp(Math.round(h / 8), 3, 9);
  const step = h / tiers;
  const side = () => Array.from({ length: tiers }, (_, t) => w * ((t + 1) / tiers) ** 0.85 * r.float(0.7, 1.15));
  const R = side();
  const Lf = side();
  const cx = (t: number) => x + lean * (1 - (t + 1) / tiers);
  ctx.beginPath();
  ctx.moveTo(x + lean, y - h);
  for (let t = 0; t < tiers; t++) {
    const yy = y - h + step * (t + 1) * 0.94;
    ctx.lineTo(cx(t) + R[t]!, yy);
    ctx.lineTo(cx(t) + R[t]! * 0.45, yy - step * 0.22);
  }
  ctx.lineTo(x + w * 0.07, y);
  ctx.lineTo(x - w * 0.07, y);
  for (let t = tiers - 1; t >= 0; t--) {
    const yy = y - h + step * (t + 1) * 0.94;
    ctx.lineTo(cx(t) - Lf[t]! * 0.45, yy - step * 0.22);
    ctx.lineTo(cx(t) - Lf[t]!, yy);
  }
  ctx.closePath();
  ctx.fill();
}

export default function paint(p: Painting) {
  const r = p.rng.fork("work");
  p.background = "#1a1830";

  // ---------- sky ----------
  const skyRamp = ramp([
    lch(0.16, 0.06, 272),
    lch(0.23, 0.08, 274),
    lch(0.33, 0.09, 280),
    lch(0.47, 0.09, 300),
    lch(0.64, 0.09, 340),
    lch(0.8, 0.1, 50),
    lch(0.89, 0.09, 85),
  ]);
  const skyAt = (y: number) => skyRamp(clamp(y / (HOR - 330)) ** 1.25);
  const sky = p.layer("sky");
  sky.vgrad(Array.from({ length: 24 }, (_, i) => skyAt((i / 23) * HOR)), 0, HOR);
  for (let i = 0; i < 110; i++) {
    const y = r.float(-50, HOR);
    const x0 = r.float(-400, W - 600);
    const len = r.float(700, 1900);
    sky.stroke("round", [[x0, y], [x0 + len / 2, y + r.gauss(0, 25)], [x0 + len, y + r.gauss(0, 30)]], {
      color: shift(skyAt(y + r.gauss(0, 70)), { l: r.gauss(0, 0.012) }),
      size: r.float(160, 420),
      opacity: 0.1,
      hardness: 0,
      taper: [0.3, 0.3],
    });
  }
  // Thin cloud bars lying in the afterglow.
  for (let i = 0; i < 9; i++) {
    const y = r.float(1040, 1340);
    const x0 = r.float(-300, W - 700);
    const len = r.float(500, 1500);
    const thick = r.float(26, 60);
    const body = mix(skyAt(y - 300), lch(0.42, 0.08, 315), 0.6);
    for (let k = 0; k < 5; k++) {
      const a = x0 + r.float(0, len * 0.3);
      const b = a + len * r.float(0.4, 0.75);
      const yy = y + r.gauss(0, thick * 0.25);
      sky.stroke("round", [[a, yy], [(a + b) / 2, yy - r.float(0, thick * 0.4)], [b, yy + r.gauss(0, 6)]], {
        color: body,
        size: thick * r.float(0.6, 1.1),
        opacity: 0.16,
        hardness: 0,
        scatter: 0.08,
        taper: [0.5, 0.5],
      });
    }
    // Underside still catching the sun.
    sky.stroke("round", [[x0 + len * 0.15, y + thick * 0.38], [x0 + len * 0.5, y + thick * 0.3], [x0 + len * 0.8, y + thick * 0.4]], {
      color: lch(0.86, 0.1, 55),
      size: thick * 0.35,
      opacity: 0.16,
      hardness: 0,
      taper: [0.5, 0.5],
    });
  }

  // ---------- stars and moon ----------
  const stars = p.layer("stars", { blend: "screen" });
  for (let i = 0; i < 260; i++) {
    const y = r.next() ** 1.7 * 1050;
    const x = r.float(0, W);
    const fade = 1 - y / 1100;
    const big = r.chance(0.06);
    stars.stroke("round", [[x, y]], {
      color: lch(0.95, 0.03, r.pick([90, 90, 250, 60])),
      size: big ? r.float(9, 13) : r.float(3, 7),
      opacity: fade * r.float(0.25, 0.9),
      hardness: 0.4,
    });
    if (big) stars.stroke("round", [[x, y]], { color: lch(0.9, 0.04, 250), size: 46, opacity: 0.12 * fade, hardness: 0 });
  }
  const MX = 560;
  const MY = 470;
  stars.stroke("round", [[MX, MY]], { color: lch(0.8, 0.05, 260), size: 620, opacity: 0.13, hardness: 0 });
  const moon = p.layer("moon");
  moon.draw((ctx) => {
    ctx.fillStyle = lch(0.96, 0.035, 95);
    ctx.beginPath();
    ctx.arc(MX, MY, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(MX + 30, MY - 16, 60, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---------- ridges ----------
  const mist = lch(0.74, 0.05, 320);
  const bump = (x: number, cx: number, w: number) => Math.exp(-(((x - cx) / w) ** 2));
  const ridges = [
    { base: 1400, amp: 150, f: 1 / 900, col: lch(0.6, 0.065, 318), env: (x: number) => 1 + 1.3 * bump(x, 760, 520), fog: 0.5, tree: 0 },
    { base: 1520, amp: 170, f: 1 / 700, col: lch(0.49, 0.07, 300), env: (x: number) => 1 + 1.1 * bump(x, 1850, 480), fog: 0.5, tree: 0 },
    { base: 1650, amp: 170, f: 1 / 560, col: lch(0.38, 0.065, 288), env: (x: number) => 1 + 0.9 * bump(x, 380, 420), fog: 0.45, tree: 20 },
    { base: 1765, amp: 150, f: 1 / 460, col: lch(0.28, 0.055, 280), env: (x: number) => 0.7 + 1.2 * bump(x, 2150, 420), fog: 0.38, tree: 36 },
    { base: 1868, amp: 190, f: 1 / 380, col: lch(0.18, 0.045, 274), env: (x: number) => clamp(Math.abs(x - HOUSE_X - 60) / 900, 0.06, 1.25), fog: 0.2, tree: 64 },
  ];
  ridges.forEach((rd, i) => {
    const top = (x: number) => rd.base - rd.amp * rd.env(x) * (0.5 + 0.5 * p.noise.fbm(x * rd.f, i * 17.3, 5, 0.5));
    const line: Pt[] = [];
    for (let x = -20; x <= W + 20; x += 8) line.push([x, top(x)]);
    const poly: Pt[] = [...line, [W + 20, HOR + 30], [-20, HOR + 30]];
    const L = p.layer(`ridge${i}`);
    L.clip(poly, () => {
      L.vgrad([rd.col, mix(rd.col, mist, rd.fog * 0.6), mix(rd.col, mist, rd.fog)], rd.base - rd.amp * 2, HOR);
      // Slope texture: sponge mottling, darker in the folds.
      for (let k = 0; k < 90; k++) {
        const x = r.float(-50, W + 50);
        const y = top(x) + r.float(0, 320);
        const len = r.float(80, 260);
        const slant = (top(x + 40) - top(x - 40)) * 0.8;
        L.stroke("stamp", [[x, y], [x + slant, y + len]], {
          color: shift(rd.col, { l: r.float(-0.035, 0.022) }),
          size: r.float(110, 260),
          opacity: 0.2,
          scatter: 0.25,
        });
      }
      // The last light catching the crest.
      L.stroke("stamp", line.filter((_, k) => k % 6 === 0).map(([x, y]) => [x, y + 7 + i * 1.5] as Pt), {
        color: mix(rd.col, lch(0.88, 0.09, 60), 0.4),
        size: 16 + i * 5,
        tip: "chalk",
        rotate: "follow",
        scatter: 0.05,
        opacity: 0.5 * (1 - i / 5.5),
      });
    });
    // Conifers on the nearer ridgelines.
    if (rd.tree) {
      L.draw((ctx) => {
        ctx.fillStyle = shift(rd.col, { l: -0.02 });
        for (let x = 0; x < W; x += rd.tree * r.float(0.25, 0.7)) {
          if (p.noise(x / 300, i * 9) < -0.25) continue;
          if (i === 4 && Math.abs(x - HOUSE_X) < 150) continue;
          const h = rd.tree * r.float(0.7, 1.6);
          const y = top(x) + 4;
          conifer(ctx, x, y, h, h * r.float(0.26, 0.36), r.gauss(0, h * 0.04), r);
        }
      });
    }
    // Mist pooling in the valley in front of this ridge.
    const next = ridges[i + 1];
    const my = next ? next.base - next.amp * 0.25 : HOR - 18;
    for (let k = 0; k < (next ? 12 : 5); k++) {
      const x0 = r.float(-300, W - 800);
      const len = r.float(900, 1800);
      const y = my + r.gauss(0, 30);
      L.stroke("round", [[x0, y], [x0 + len / 2, y + r.gauss(0, 18)], [x0 + len, y + r.gauss(0, 18)]], {
        color: mist,
        size: next ? r.float(150, 320) : r.float(50, 90),
        opacity: next ? 0.085 : 0.04,
        hardness: 0,
        taper: [0.35, 0.35],
      });
    }
  });

  // ---------- the house ----------
  const dark = lch(0.12, 0.03, 272);
  const warm = lch(0.9, 0.13, 80);
  const house = p.layer("house");
  const gy = HOR - 6;
  house.draw((ctx) => {
    ctx.fillStyle = dark;
    // Low spit of land.
    ctx.beginPath();
    ctx.ellipse(HOUSE_X + 10, HOR + 4, 260, 16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(HOUSE_X - 40, gy - 44, 80, 46);
    ctx.beginPath();
    ctx.moveTo(HOUSE_X - 52, gy - 42);
    ctx.lineTo(HOUSE_X - 4, gy - 84);
    ctx.lineTo(HOUSE_X + 52, gy - 42);
    ctx.fill();
    ctx.fillRect(HOUSE_X + 18, gy - 86, 10, 30);
    ctx.fillStyle = warm;
    ctx.fillRect(HOUSE_X - 20, gy - 32, 15, 18);
  });
  // A thread of smoke.
  const glow = p.layer("glow", { blend: "screen" });
  const wx = HOUSE_X - 12;
  const wy = gy - 23;
  // A thread of smoke, lit from below.
  glow.stroke("stamp", [[HOUSE_X + 23, gy - 94, 0.35], [HOUSE_X + 32, gy - 150, 0.6], [HOUSE_X + 15, gy - 230, 0.9], [HOUSE_X + 40, gy - 330, 1], [HOUSE_X + 20, gy - 430, 0.8]], {
    color: lch(0.6, 0.04, 320),
    size: 44,
    opacity: 0.2,
    scatter: 0.1,
    taper: [0, 0.5],
  });
  glow.stroke("round", [[wx, wy]], { color: lch(0.62, 0.15, 55), size: 340, opacity: 0.3, hardness: 0 });
  glow.stroke("round", [[wx, wy]], { color: lch(0.8, 0.14, 70), size: 90, opacity: 0.55, hardness: 0 });

  // ---------- the lake: everything above, mirrored and disturbed ----------
  const above = p.composite();
  const lake = p.layer("lake");
  lake.draw((ctx) => {
    ctx.beginPath();
    ctx.rect(0, HOR, W, H - HOR);
    ctx.clip();
    ctx.translate(0, 2 * HOR);
    ctx.scale(1, -1);
    ctx.drawImage(above, 0, 0, W, H);
  });
  lake.draw((ctx) => {
    const g = ctx.createLinearGradient(0, HOR, 0, H);
    g.addColorStop(0, "rgba(22,20,48,0.22)");
    g.addColorStop(1, "rgba(14,13,34,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, HOR, W, H - HOR);
  });
  lake.warp((x, y) => {
    const d = (y - HOR) / (H - HOR);
    const amp = 3 + 46 * d;
    const ky = 7 + 30 * d;
    return [p.noise(x / 260, y / ky) * amp * 1.6, p.noise.fbm(x / 420 + 40, y / (ky * 1.4), 2) * amp * 0.8];
  }, [0, HOR, W, H - HOR]);
  // Surface: horizontal glints and dark troughs.
  for (let i = 0; i < 190; i++) {
    const d = r.next() ** 1.4;
    const y = HOR + 14 + d * (H - HOR);
    const len = r.float(120, 500) * (0.5 + d * 1.6);
    const x0 = r.float(-200, W);
    const light = r.chance(0.55);
    lake.stroke("dry", [[x0, y], [x0 + len / 2, y + r.gauss(0, 2 + d * 5)], [x0 + len, y + r.gauss(0, 2 + d * 5)]], {
      color: light ? shift(skyAt(HOR - (y - HOR) * 0.75), { l: 0.07 }) : lch(0.13, 0.04, 272),
      size: 5 + d * 30,
      bristles: 7,
      opacity: light ? 0.13 : 0.24,
      dryness: 0.3,
      streak: 6,
      wobble: 0.15,
      taper: [0.3, 0.3],
    });
  }
  // The window, carried across the water.
  const shine = p.layer("shine", { blend: "screen" });
  for (let i = 0; i < 60; i++) {
    const d = i / 60;
    const y = HOR + 16 + d ** 1.3 * 620 + r.gauss(0, 5);
    if (r.chance(0.18 + d * 0.3)) continue;
    const half = r.float(5, 26) * (1 + d * 1.6);
    const x = wx + r.gauss(0, 4 + d * 16);
    shine.stroke("round", [[x - half, y], [x + half, y + r.gauss(0, 1.5)]], {
      color: lch(0.78, 0.15, 68),
      size: r.float(5, 9) + d * 5,
      opacity: 0.8 * (1 - d) ** 1.3 + 0.07,
      hardness: 0,
      taper: [0.4, 0.4],
    });
  }
  shine.stroke("round", [[wx, HOR + 40], [wx, HOR + 380]], { color: lch(0.6, 0.14, 55), size: 150, opacity: 0.045, hardness: 0, taper: [0.2, 0.6] });
  // Mist lying on the far water.
  const haze = p.layer("haze");
  for (let i = 0; i < 8; i++) {
    const x0 = r.float(-300, W - 900);
    const y = HOR + r.gauss(6, 14);
    haze.stroke("round", [[x0, y], [x0 + r.float(900, 1700), y + r.gauss(0, 8)]], { color: mist, size: r.float(40, 90), opacity: 0.04, hardness: 0, taper: [0.4, 0.4] });
  }

  // ---------- reeds, close to us ----------
  const reeds = p.layer("reeds");
  const reedCol = lch(0.09, 0.025, 272);
  const clump = (cx: number, spread: number, n: number, hMax: number) => {
    for (let i = 0; i < n; i++) {
      const x = cx + r.gauss(0, spread);
      const h = hMax * r.float(0.35, 1);
      const lean = r.gauss(0.12, 0.16) * h;
      const tip: Pt = [x + lean, H - h, 0.15];
      reeds.stroke("ink", [[x, H + 30, 1], [x + lean * 0.25, H - h * 0.5, 0.75], tip], { color: reedCol, size: r.float(6, 11), taper: [0, 0.35] });
      if (r.chance(0.4)) {
        // Seed head.
        reeds.stroke("dry", [[tip[0] - lean * 0.06, tip[1] + h * 0.1], [tip[0] + lean * 0.02, tip[1] - 6]], { color: reedCol, size: r.float(14, 22), bristles: 14, dryness: 0.1, opacity: 1, taper: [0.3, 0.4] });
      } else if (r.chance(0.5)) {
        // Blade folding over.
        const dir = r.pick([-1, 1]);
        const bl = h * r.float(0.25, 0.5);
        const by = H - h * r.float(0.45, 0.8);
        const bx = x + lean * 0.4;
        reeds.stroke("ink", [[bx, by, 0.9], [bx + dir * bl * 0.5, by - bl * 0.45, 0.7], [bx + dir * bl, by - bl * 0.2, 0.1]], { color: reedCol, size: r.float(5, 9) });
      }
    }
  };
  clump(170, 150, 46, 760);
  clump(520, 110, 22, 430);
  clump(2290, 110, 30, 560);
  clump(2040, 70, 10, 300);

  p.post(vignette(0.32));
  p.post(grain(0.04));
}
