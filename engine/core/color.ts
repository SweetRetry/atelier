import { converter, formatHex, interpolate, toGamut } from "culori";
import { ksDec, ksEnc, linToByte, toLin } from "./pigment.ts";

/** Any CSS color string culori can parse. Skia only gets rgb() strings from us. */
export type Color = string;

const toRgb = converter("rgb");
const toOklch = converter("oklch");
const fit = toGamut("rgb", "oklch");
const cache = new Map<string, [number, number, number]>();

export function rgb(c: Color): [number, number, number] {
  let v = cache.get(c);
  if (!v) {
    const p = toRgb(fit(c));
    if (!p) throw new Error(`unparseable color: ${c}`);
    v = [Math.round(p.r * 255), Math.round(p.g * 255), Math.round(p.b * 255)];
    cache.set(c, v);
  }
  return v;
}

export function rgba(c: Color, alpha = 1): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Perceptual color from lightness 0..1, chroma 0..0.4, hue degrees. */
export function lch(l: number, c: number, h: number): Color {
  return formatHex(fit({ mode: "oklch", l, c, h }));
}

/** Perceptual mix in OKLab. Avoids the muddy midpoints of RGB mixing. */
export function mix(a: Color, b: Color, t: number): Color {
  return formatHex(fit(interpolate([a, b], "oklab")(t)));
}

/** Nudge a color in OKLCH. Deltas are added. */
export function shift(c: Color, d: { l?: number; c?: number; h?: number }): Color {
  const o = toOklch(c);
  if (!o) throw new Error(`unparseable color: ${c}`);
  return lch(o.l + (d.l ?? 0), Math.max(0, o.c + (d.c ?? 0)), (o.h ?? 0) + (d.h ?? 0));
}

/** Sample a multi-stop gradient at t in 0..1. */
export function ramp(stops: Color[]): (t: number) => Color {
  const f = interpolate(stops, "oklab");
  return (t) => formatHex(fit(f(Math.min(1, Math.max(0, t)))));
}

/** Mix like paint (Kubelka-Munk). Blue and yellow give green. Use for palettes meant to look mixed on a palette. */
export function mixPigment(a: Color, b: Color, t: number): Color {
  const A = rgb(a);
  const B = rgb(b);
  const hex = [0, 1, 2].map((i) => {
    const ka = ksEnc(toLin(A[i]! / 255));
    const kb = ksEnc(toLin(B[i]! / 255));
    return linToByte(ksDec(ka + (kb - ka) * t)).toString(16).padStart(2, "0");
  });
  return `#${hex.join("")}`;
}
