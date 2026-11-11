// Reference image: something to look at while painting. It gives color, tone, and the direction forms run in,
// so strokes can follow what is there instead of coordinates worked out by hand.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { boxBlur } from "./core/field.ts";
import type { Pt } from "./core/path.ts";
import type { Rng } from "./core/rng.ts";

export class Reference {
  private constructor(
    private w: number,
    private h: number,
    private k: number, // reference pixels per logical unit
    private px: Uint8ClampedArray,
    private ori: Float32Array,
    private coh: Float32Array,
    private edge: Float32Array,
  ) {}

  /** Load an image and stretch it over a sheet of the given logical size. */
  static async load(file: string, width: number, height: number, maxRes = 1100): Promise<Reference> {
    const img = await loadImage(file);
    const k = Math.min(1, maxRes / Math.max(width, height));
    const w = Math.round(width * k);
    const h = Math.round(height * k);
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    let lum: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!) / 255;
    lum = boxBlur(boxBlur(lum, w, h, 2), w, h, 2);
    let gx: Float32Array = new Float32Array(w * h);
    let gy: Float32Array = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        gx[i] = lum[i + 1]! - lum[i - 1]!;
        gy[i] = lum[i + w]! - lum[i - w]!;
      }
    }
    const edge = new Float32Array(w * h);
    // Structure tensor. Squaring the gradient before smoothing keeps the orientation of a thin line,
    // whose two sides have opposite gradients that would cancel if averaged directly.
    let jxx: Float32Array = new Float32Array(w * h);
    let jyy: Float32Array = new Float32Array(w * h);
    let jxy: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      edge[i] = Math.hypot(gx[i]!, gy[i]!);
      jxx[i] = gx[i]! * gx[i]!;
      jyy[i] = gy[i]! * gy[i]!;
      jxy[i] = gx[i]! * gy[i]!;
    }
    jxx = boxBlur(boxBlur(jxx, w, h, 4), w, h, 4);
    jyy = boxBlur(boxBlur(jyy, w, h, 4), w, h, 4);
    jxy = boxBlur(boxBlur(jxy, w, h, 4), w, h, 4);
    const ori = new Float32Array(w * h);
    const coh = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const d = jxx[i]! - jyy[i]!;
      ori[i] = 0.5 * Math.atan2(2 * jxy[i]!, d) + Math.PI / 2;
      coh[i] = Math.sqrt(d * d + 4 * jxy[i]! * jxy[i]!) / (jxx[i]! + jyy[i]! + 1e-9);
    }
    return new Reference(w, h, k, px, ori, coh, boxBlur(edge, w, h, 3));
  }

  private at(x: number, y: number) {
    const xi = Math.min(this.w - 1, Math.max(0, Math.round(x * this.k)));
    const yi = Math.min(this.h - 1, Math.max(0, Math.round(y * this.k)));
    return yi * this.w + xi;
  }

  /** Color at a logical position, as a hex string. */
  color(x: number, y: number): string {
    const i = this.at(x, y) * 4;
    return `#${[0, 1, 2].map((c) => this.px[i + c]!.toString(16).padStart(2, "0")).join("")}`;
  }

  /** Lightness 0..1. */
  lum(x: number, y: number): number {
    const i = this.at(x, y) * 4;
    return (0.2126 * this.px[i]! + 0.7152 * this.px[i + 1]! + 0.0722 * this.px[i + 2]!) / 255;
  }

  /** Direction that runs along the form here, in radians. Strokes laid this way wrap edges instead of crossing them. */
  along(x: number, y: number): number {
    return this.ori[this.at(x, y)]!;
  }

  /** How strongly the forms here agree on one direction, 0..1. High along edges and thin lines, low in flat or noisy areas. */
  coherence(x: number, y: number): number {
    return this.coh[this.at(x, y)]!;
  }

  /** How much is going on here, 0..1. Small strokes belong where this is high. */
  detail(x: number, y: number): number {
    return Math.min(1, this.edge[this.at(x, y)]! * 14);
  }

  private directed(x: number, y: number) {
    return this.detail(x, y) > 0.04 && this.coherence(x, y) > 0.3;
  }

  /** A stroke path starting at x, y that follows the form for `length`. Stops when it would cross an edge into a different tone. */
  trace(x: number, y: number, length: number, rng: Rng, fallback = 0): Pt[] {
    const step = Math.max(3, length / 6);
    const pts: Pt[] = [[x, y, 0.7]];
    const start = this.lum(x, y);
    let a = this.directed(x, y) ? this.along(x, y) : fallback + rng.gauss(0, 0.35);
    if (rng.chance(0.5)) a += Math.PI;
    for (let s = step; s <= length; s += step) {
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      if (Math.abs(this.lum(x, y) - start) > 0.12) break;
      pts.push([x, y, 1]);
      if (this.directed(x, y)) {
        // Keep heading the same general way. The field has no sign, so pick the closer of the two directions.
        let n = this.along(x, y);
        if (Math.cos(n - a) < 0) n += Math.PI;
        a = n;
      }
    }
    if (pts.length < 2) pts.push([x + Math.cos(a) * step * 0.5, y + Math.sin(a) * step * 0.5, 0.8]);
    return pts;
  }
}
