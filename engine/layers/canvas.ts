// Canvas layer: Skia behind the Canvas 2D API. Brushes from the registry draw here.
// This is the layer for vector-like marks, flat shapes, gradients, lettering and whole-layer pixel passes.
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { type BrushEnv, type Ctx, getBrush, type StrokeOpts } from "../brushes/registry.ts";
import { type Color, rgb, rgba } from "../core/color.ts";
import { boxBlur } from "../core/field.ts";
import { type Area, Mask } from "../core/mask.ts";
import { affine, moved, type Placement, type Pt, ribbon, spline, taper, tracePoly, type Xf } from "../core/path.ts";
import { adjust, type Levels } from "../effects.ts";
import type { Painting } from "../painting.ts";

export class Layer {
  readonly canvas: Canvas;
  readonly ctx: Ctx;
  blend = "source-over";
  opacity = 1;
  private strokes = 0;
  private xf?: Xf;

  constructor(readonly name: string, private p: Painting) {
    this.canvas = createCanvas(p.pxW, p.pxH);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.scale(p.scale, p.scale);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  /**
   * Run fn with everything it draws moved, scaled, turned and mirrored as one group. Sizes scale too, so a part drawn
   * once can be set down at any size. Groups nest. Masks and whole-layer passes (blur, warp, pixels) stay in sheet coordinates.
   */
  at(pl: Placement, fn: () => void): this {
    const prev = this.xf;
    const own = affine(pl);
    this.xf = affine(pl, prev);
    this.ctx.save();
    this.ctx.transform(...own.m);
    fn();
    this.ctx.restore();
    this.xf = prev;
    return this;
  }

  /** Lay the pixels of another layer of any kind onto this one. After that blur, warp, adjust and the rest work on it. Set the source's opacity to 0 if only the copy should show. */
  copy(src: { canvas: Canvas }, opacity = 1): this {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = opacity;
    this.ctx.drawImage(src.canvas, 0, 0);
    this.ctx.restore();
    this.p.tick(2);
    return this;
  }

  /** Remap the lightness, chroma and hue of what is on this layer. See `levels`. */
  adjust(o: Levels): this {
    return this.pixels((d) => adjust(d, o));
  }

  /** Draw one stroke through control points with a named brush. */
  stroke(brush: string, pts: Pt[], opts: StrokeOpts = {}): this {
    const b = getBrush(brush);
    const o = { ...b.defaults, ...opts };
    const path = spline(pts, Math.max(0.5 / this.p.scale, o.size * (b.spacing ?? 0.1)));
    if (o.taper) taper(path, o.taper[0], o.taper[1]);
    const rng = this.p.rng.fork(`${this.name}/${this.strokes++}`);
    if (o.knockout) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = "destination-out";
      tracePoly(this.ctx, ribbon(path, o.size * (1 + o.knockout), o.thinning ?? 0.5));
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.save();
    b.draw({ ctx: this.ctx, rng, noise: this.p.noise, scale: this.p.scale }, path, o);
    this.ctx.restore();
    this.p.tick(Math.min(1, Math.max(0.04, o.size / 60)));
    return this;
  }

  /** Fill a polygon with flat color. Given a mask, lay the color through it, so a tone function can shade a form. */
  shape(poly: Pt[] | Mask, color: Color, alpha = 1): this {
    if (poly instanceof Mask) {
      const t = createCanvas(poly.w, poly.h);
      const g = t.getContext("2d");
      const img = g.createImageData(poly.w, poly.h);
      const [r, gr, b] = rgb(color);
      for (let i = 0; i < poly.a.length; i++) {
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = gr;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = poly.a[i]! * alpha * 255;
      }
      g.putImageData(img, 0, 0);
      // A mask is in sheet coordinates whatever group is being drawn.
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(t, 0, 0);
      this.ctx.restore();
      this.p.tick(2);
      return this;
    }
    this.ctx.fillStyle = rgba(color, alpha);
    this.ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y)));
    this.ctx.closePath();
    this.ctx.fill();
    this.p.tick(2);
    return this;
  }

  /** A ruled line of even width through the points, with straight segments and sharp corners. `closed` joins the end to the start, for the outline of a shape. */
  line(pts: Pt[], color: Color, width = 2, closed = false): this {
    this.ctx.save();
    this.ctx.strokeStyle = rgba(color);
    this.ctx.lineWidth = width;
    this.ctx.lineJoin = "miter";
    this.ctx.lineCap = closed ? "butt" : "round";
    this.ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y)));
    if (closed) this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
    this.p.tick(1);
    return this;
  }

  /** Confine everything drawn in fn to pixels this layer already covers. For shading and markings on a finished shape. */
  atop(fn: () => void): this {
    const prev = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = "source-atop";
    fn();
    this.ctx.globalCompositeOperation = prev;
    return this;
  }

  fill(color: Color, alpha = 1): this {
    this.ctx.fillStyle = rgba(color, alpha);
    this.ctx.fillRect(0, 0, this.p.width, this.p.height);
    this.p.tick(3);
    return this;
  }

  /** Raw Canvas 2D access in logical units, for anything brushes do not cover. */
  draw(fn: (ctx: Ctx, env: BrushEnv) => void): this {
    this.ctx.save();
    fn(this.ctx, { ctx: this.ctx, rng: this.p.rng.fork(`${this.name}/${this.strokes++}`), noise: this.p.noise, scale: this.p.scale });
    this.ctx.restore();
    this.p.tick(2);
    return this;
  }

  /**
   * Run fn with drawing confined to an area. Strokes made inside are clipped too.
   * A plain polygon with no feather is cut with a hard edge by Skia. A mask, holes or a feather keep whatever fn did only as far as the mask lets through.
   */
  clip(area: Area, fn: () => void, feather = 0): this {
    if (area instanceof Mask || feather > 0 || typeof area[0]?.[0] !== "number") {
      const m = this.p.mask(moved(area, this.xf), feather * (this.xf?.k ?? 1)).a;
      const before = this.ctx.getImageData(0, 0, this.p.pxW, this.p.pxH).data;
      fn();
      return this.pixels((d) => {
        // Blend premultiplied, so a soft edge over nothing does not pick up black.
        for (let i = 0; i < m.length; i++) {
          const k = m[i]!;
          if (k >= 1) continue;
          const o = i * 4;
          const [a0, a1] = [before[o + 3]! * (1 - k), d[o + 3]! * k];
          const a = a0 + a1;
          for (let c = 0; c < 3; c++) d[o + c] = a > 0 ? (before[o + c]! * a0 + d[o + c]! * a1) / a : 0;
          d[o + 3] = a;
        }
      });
    }
    const poly = area as Pt[];
    this.ctx.save();
    this.ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y)));
    this.ctx.closePath();
    this.ctx.clip();
    fn();
    this.ctx.restore();
    return this;
  }

  /** Rub an area back to nothing, as an eraser does. What lies on the layers beneath shows through. */
  erase(area: Area, feather = 0): this {
    const m = this.p.mask(moved(area, this.xf), feather * (this.xf?.k ?? 1)).a;
    return this.pixels((d) => {
      for (let i = 0; i < m.length; i++) if (m[i]) d[i * 4 + 3] = d[i * 4 + 3]! * (1 - m[i]!);
    });
  }

  /** Vertical gradient over the whole layer (or the current clip), evenly spaced stops from y0 to y1. */
  vgrad(stops: Color[], y0 = 0, y1 = this.p.height): this {
    return this.grad(stops, [0, y0], [0, y1]);
  }

  /** Gradient over the whole layer (or the current clip). Stops are evenly spaced. Straight from `from` to `to`, or round when a radius is given: centred on `from`, from radius `r0` out to `r`. */
  grad(stops: Color[], from: [number, number], to: [number, number] | number, r0 = 0): this {
    const g = typeof to === "number" ? this.ctx.createRadialGradient(from[0], from[1], r0, from[0], from[1], to) : this.ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), rgba(c)));
    this.ctx.fillStyle = g;
    // Inside a group the sheet is no longer the rectangle from 0, 0, so cover far more than it.
    if (this.xf) this.ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
    else this.ctx.fillRect(0, 0, this.p.width, this.p.height);
    this.p.tick(4);
    return this;
  }

  /** Displace pixels. fn maps a logical position to the logical offset it samples from. Bilinear. */
  warp(fn: (x: number, y: number) => [number, number], region?: [number, number, number, number]): this {
    const s = this.p.scale;
    const [lx, ly, lw, lh] = region ?? [0, 0, this.p.width, this.p.height];
    const rx = Math.max(0, Math.floor(lx * s));
    const ry = Math.max(0, Math.floor(ly * s));
    const rw = Math.min(this.p.pxW - rx, Math.ceil(lw * s));
    const rh = Math.min(this.p.pxH - ry, Math.ceil(lh * s));
    const img = this.ctx.getImageData(rx, ry, rw, rh);
    const src = img.data.slice();
    const d = img.data;
    for (let py = 0; py < rh; py++) {
      for (let px = 0; px < rw; px++) {
        const [dx, dy] = fn((rx + px) / s, (ry + py) / s);
        const sx = Math.min(rw - 1.001, Math.max(0, px + dx * s));
        const sy = Math.min(rh - 1.001, Math.max(0, py + dy * s));
        const x0 = sx | 0;
        const y0 = sy | 0;
        const fx = sx - x0;
        const fy = sy - y0;
        const i00 = (y0 * rw + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + rw * 4;
        const i11 = i01 + 4;
        const o = (py * rw + px) * 4;
        for (let c = 0; c < 4; c++) {
          d[o + c] =
            (src[i00 + c]! * (1 - fx) + src[i10 + c]! * fx) * (1 - fy) + (src[i01 + c]! * (1 - fx) + src[i11 + c]! * fx) * fy;
        }
      }
    }
    this.ctx.putImageData(img, rx, ry);
    this.p.tick(6);
    return this;
  }

  /** Pigment pooling at the rim of every mark, as wet ink and watercolor dry. Radius in logical units. */
  wetEdge(radius = 3, strength = 0.6): this {
    const R = Math.max(1, Math.round(radius * this.p.scale));
    return this.pixels((d, w, h) => {
      const a = new Float32Array(w * h);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]!;
      const b = boxBlur(boxBlur(a, w, h, R), w, h, R);
      for (let i = 0; i < a.length; i++) {
        const al = a[i]!;
        if (al < 2) continue;
        const e = Math.min(1, Math.max(0, 1 - b[i]! / al)) * strength;
        const k = 1 - 0.45 * e;
        d[i * 4] = d[i * 4]! * k;
        d[i * 4 + 1] = d[i * 4 + 1]! * k;
        d[i * 4 + 2] = d[i * 4 + 2]! * k;
        d[i * 4 + 3] = Math.min(255, al * (1 + e));
      }
    });
  }

  /** Soften the whole layer. Radius in logical units. Use on a far or near layer for depth of field, or on a shadow. */
  blur(radius: number): this {
    const R = Math.round((radius * this.p.scale) / 2);
    if (R < 1) return this;
    return this.pixels((d, w, h) => {
      // Blur premultiplied color so transparent pixels do not bleed black.
      const ch = [0, 1, 2, 3].map(() => new Float32Array(w * h));
      for (let i = 0; i < w * h; i++) {
        const a = d[i * 4 + 3]! / 255;
        ch[0]![i] = d[i * 4]! * a;
        ch[1]![i] = d[i * 4 + 1]! * a;
        ch[2]![i] = d[i * 4 + 2]! * a;
        ch[3]![i] = a;
      }
      const b = ch.map((c) => boxBlur(boxBlur(boxBlur(c, w, h, R), w, h, R), w, h, R));
      for (let i = 0; i < w * h; i++) {
        const a = b[3]![i]!;
        d[i * 4] = a > 0 ? b[0]![i]! / a : 0;
        d[i * 4 + 1] = a > 0 ? b[1]![i]! / a : 0;
        d[i * 4 + 2] = a > 0 ? b[2]![i]! / a : 0;
        d[i * 4 + 3] = a * 255;
      }
    });
  }

  /** Stamp the silhouette of another layer in one color, offset. Blur afterwards for a soft shadow or a glow. */
  silhouette(src: { canvas: Canvas }, o: { color: Color; dx?: number; dy?: number; opacity?: number }): this {
    const t = createCanvas(this.p.pxW, this.p.pxH);
    const g = t.getContext("2d");
    g.drawImage(src.canvas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = rgba(o.color);
    g.fillRect(0, 0, this.p.pxW, this.p.pxH);
    this.ctx.save();
    this.ctx.globalAlpha = o.opacity ?? 1;
    this.ctx.drawImage(t, o.dx ?? 0, o.dy ?? 0, this.p.width, this.p.height);
    this.ctx.restore();
    this.p.tick(2);
    return this;
  }

  /** Lettering. Font is any installed family. */
  text(str: string, x: number, y: number, o: { size: number; color: Color; font?: string; weight?: number | string; align?: "left" | "center" | "right"; italic?: boolean }): this {
    this.ctx.save();
    this.ctx.font = `${o.italic ? "italic " : ""}${o.weight ?? 400} ${o.size}px ${o.font ?? "Georgia, 'Songti SC', serif"}`;
    this.ctx.textAlign = o.align ?? "left";
    this.ctx.fillStyle = rgba(o.color);
    this.ctx.fillText(str, x, y);
    this.ctx.restore();
    this.p.tick(2);
    return this;
  }

  /** Raw pixel access in device pixels. */
  pixels(fn: (data: Uint8ClampedArray, w: number, h: number) => void): this {
    const img = this.ctx.getImageData(0, 0, this.p.pxW, this.p.pxH);
    fn(img.data, this.p.pxW, this.p.pxH);
    this.ctx.putImageData(img, 0, 0);
    this.p.tick(3);
    return this;
  }
}
