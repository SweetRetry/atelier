import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { rgba } from "../core/color.ts";
import { type BrushEnv, type BrushOpts, defineBrush } from "./registry.ts";
import { ribbon, type Sample, tracePoly } from "../core/path.ts";
import { clamp, type Rng } from "../core/rng.ts";
import { tintedTip } from "./tips.ts";

// ---------- round: stamped soft or hard dabs. Airbrush, glow, blocking in. ----------

const TIP = 64;
const tips = new Map<string, Canvas>();
function tip(color: string, hardness: number): Canvas {
  const key = `${color}|${hardness}`;
  let c = tips.get(key);
  if (!c) {
    c = createCanvas(TIP, TIP);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(TIP / 2, TIP / 2, 0, TIP / 2, TIP / 2, TIP / 2);
    const h = clamp(hardness, 0, 0.98);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(h, rgba(color, 1));
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      grad.addColorStop(h + (1 - h) * u, rgba(color, (1 - u) ** 2));
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, TIP, TIP);
    tips.set(key, c);
  }
  return c;
}

defineBrush("round", {
  spacing: 0.12,
  defaults: {
    color: "#000",
    size: 20,
    opacity: 0.5,
    /** 0 is fully soft, 1 is a hard disc. */
    hardness: 0.2,
    /** Random offset per dab, fraction of size. */
    scatter: 0,
    /** How much pressure drives size, 0..1. */
    sizeByPressure: 0.7,
  },
  draw({ ctx, rng }, path, o) {
    const t = tip(o.color, o.hardness);
    for (const s of path) {
      const d = o.size * (1 - o.sizeByPressure + o.sizeByPressure * s.p);
      if (d <= 0) continue;
      const jx = o.scatter ? rng.gauss(0, o.scatter * o.size) : 0;
      const jy = o.scatter ? rng.gauss(0, o.scatter * o.size) : 0;
      ctx.globalAlpha = clamp(o.opacity * s.p);
      ctx.drawImage(t, s.x + jx - d / 2, s.y + jy - d / 2, d, d);
    }
  },
});

// ---------- ink: one crisp pressure-shaped ribbon. Line work, calligraphy. ----------

defineBrush("ink", {
  spacing: 0.25,
  defaults: {
    color: "#111",
    size: 6,
    opacity: 1,
    /** How strongly pressure thins the line, 0..1. */
    thinning: 0.8,
    /** Ragged edge, 0 is a clean vector line, 1 is brush on rough paper. */
    rough: 0,
  },
  draw({ ctx, noise, rng }, path, o) {
    let poly = ribbon(path, o.size, o.thinning);
    if (o.rough) {
      const f = 1 / Math.max(2, o.size * 0.35);
      const k = o.rough * o.size * 0.16;
      const ph = rng.float(0, 500);
      poly = poly.map(([x, y]) => [x! + noise.fbm(x! * f + ph, y! * f, 2) * k, y! + noise.fbm(x! * f, y! * f + ph, 2) * k]);
    }
    tracePoly(ctx, poly);
    ctx.fillStyle = rgba(o.color, o.opacity);
    ctx.fill();
  },
});

// ---------- dry: separate bristles that run out of paint. Texture, grass, hair, wood. ----------

defineBrush("dry", {
  spacing: 0.08,
  defaults: {
    color: "#222",
    size: 30,
    opacity: 0.8,
    bristles: 28,
    /** 0 is fully loaded, 1 breaks up almost at once. */
    dryness: 0.5,
    /** Length of streaks along the stroke, in units of size. */
    streak: 3,
    /** Sideways wander of each bristle. 0 is ruled straight. */
    wobble: 1,
  },
  draw({ ctx, rng, noise }, path, o) {
    const seed = rng.float(0, 1000);
    const w = (o.size / o.bristles) * 1.5;
    ctx.lineCap = "butt";
    for (let j = 0; j < o.bristles; j++) {
      const off = (rng.next() - 0.5) * o.size;
      const load = rng.float(0.6, 1.2);
      const row = seed + j * 3.17;
      ctx.lineWidth = w * rng.float(0.5, 1.3);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        const ink = noise(b.d / (o.size * o.streak), row) * 0.5 + 0.5;
        const alpha = clamp((ink * load - o.dryness * (0.35 + 0.65 * b.t)) * 3) * b.p;
        if (alpha <= 0.02) continue;
        const wob = noise(b.d / (o.size * 2), row + 50) * w * o.wobble;
        const oa = (off + wob) * (0.4 + 0.6 * a.p);
        const ob = (off + wob) * (0.4 + 0.6 * b.p);
        ctx.strokeStyle = rgba(o.color, o.opacity * alpha);
        ctx.beginPath();
        ctx.moveTo(a.x - Math.sin(a.a) * oa, a.y + Math.cos(a.a) * oa);
        ctx.lineTo(b.x - Math.sin(b.a) * ob, b.y + Math.cos(b.a) * ob);
        ctx.stroke();
      }
    }
  },
});

// ---------- wash: many deformed translucent films. Watercolor, mist, soft masses. ----------

function deform(poly: number[][], rounds: number, amount: number, rng: Rng): number[][] {
  for (let r = 0; r < rounds; r++) {
    const next: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
      const v = a[2] ?? 1;
      const ang = rng.float(0, Math.PI * 2);
      const mag = Math.min(2, Math.abs(rng.gauss(0, 1))) * len * amount * 0.6 * v;
      next.push(a, [(a[0]! + b[0]!) / 2 + Math.cos(ang) * mag, (a[1]! + b[1]!) / 2 + Math.sin(ang) * mag, Math.min(1.6, v * rng.float(0.7, 1.15))]);
    }
    poly = next;
  }
  return poly;
}

interface WashOpts extends BrushOpts {
  films: number;
  bleed: number;
  area: boolean;
}

defineBrush<WashOpts>("wash", {
  spacing: 0.3,
  defaults: {
    color: "#3b6ea5",
    size: 60,
    /** Density where all films overlap. */
    opacity: 0.7,
    /** Number of translucent films. More is smoother and slower. */
    films: 28,
    /** Edge wander, 0 is crisp, 1 is very wet. */
    bleed: 0.45,
    /** Treat the control points as a closed region instead of a stroke. */
    area: false,
  },
  draw({ ctx, rng }: BrushEnv, path: Sample[], o: WashOpts) {
    let poly: number[][];
    if (o.area) {
      const step = Math.max(1, Math.floor(path.length / 48));
      poly = path.filter((_, i) => i % step === 0).map((s) => [s.x, s.y]);
    } else {
      const out = ribbon(path, o.size, 0.5);
      const step = Math.max(1, Math.floor(out.length / 64));
      poly = out.filter((_, i) => i % step === 0);
    }
    if (poly.length < 3) return;
    poly = poly.map((q) => [q[0]!, q[1]!, rng.float(0.4, 1.6)]);
    const base = deform(poly, 2, o.bleed * 0.6, rng);
    ctx.fillStyle = rgba(o.color, 1 - (1 - clamp(o.opacity, 0, 0.98)) ** (1 / o.films));
    for (let k = 0; k < o.films; k++) {
      const film = deform(base, 3, o.bleed, rng);
      ctx.beginPath();
      ctx.moveTo(film[0]![0]!, film[0]![1]!);
      for (let i = 1; i < film.length; i++) ctx.lineTo(film[i]![0]!, film[i]![1]!);
      ctx.closePath();
      ctx.fill();
    }
  },
});

// ---------- stamp: textured tips, rotated and scattered. Mottling, foliage, grit, spatter. ----------

defineBrush("stamp", {
  spacing: 0.22,
  defaults: {
    color: "#333",
    size: 60,
    opacity: 0.5,
    /** Tip name from tips.ts: sponge, chalk, speckle. */
    tip: "sponge",
    /** Random offset per dab, fraction of size. */
    scatter: 0.15,
    /** Random size variation per dab, 0..1. */
    sizeJitter: 0.3,
    /** "random" spins each dab, "follow" aligns it with the stroke. */
    rotate: "random",
    sizeByPressure: 0.5,
  },
  draw({ ctx, rng }, path, o) {
    for (const s of path) {
      const d = o.size * (1 - o.sizeByPressure + o.sizeByPressure * s.p) * (1 + rng.gauss(0, o.sizeJitter * 0.5));
      if (d <= 0.5) continue;
      const t = tintedTip(o.tip, o.color, rng);
      ctx.save();
      ctx.translate(s.x + rng.gauss(0, o.scatter * o.size), s.y + rng.gauss(0, o.scatter * o.size));
      ctx.rotate(o.rotate === "follow" ? s.a : rng.float(0, Math.PI * 2));
      ctx.globalAlpha = clamp(o.opacity * s.p);
      ctx.drawImage(t, -d / 2, -d / 2, d, d);
      ctx.restore();
    }
  },
});
