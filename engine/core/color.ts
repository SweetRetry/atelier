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

/** Linear sRGB (0..1) to OKLab, for pixel passes where culori would be too slow. */
export function toOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** OKLab back to linear sRGB. Not clamped. */
export function fromOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
