// A mask: how much of each device pixel is let through, 0..1.
// Every kind of layer takes one wherever it takes a shape, so masking film, a stencil, an eraser and
// "only where that other layer is painted" are the same thing on canvas, wet and watercolor layers.
import { createCanvas } from "@napi-rs/canvas";
import { boxBlur } from "./field.ts";
import { facet, type Pt } from "./path.ts";

export class Mask {
  constructor(
    readonly a: Float32Array,
    readonly w: number,
    readonly h: number,
    /** Device pixels per logical unit. */
    readonly scale: number,
  ) {}

  /** A polygon, antialiased. Several polygons are filled together by the even-odd rule, so a polygon inside another is a hole. */
  static poly(polys: Pt[] | Pt[][], w: number, h: number, scale: number): Mask {
    const list = (typeof polys[0]?.[0] === "number" ? [polys] : polys) as Pt[][];
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.beginPath();
    for (const poly of list) {
      poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    }
    g.fill(list.length > 1 ? "evenodd" : "nonzero");
    return Mask.alpha(c, scale);
  }

  /** Where a canvas is painted. */
  static alpha(c: { width: number; height: number; getContext(k: "2d"): any }, scale: number): Mask {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data as Uint8ClampedArray;
    const a = new Float32Array(c.width * c.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]! / 255;
    return new Mask(a, c.width, c.height, scale);
  }

  /** A function of logical position, read at the centre of every pixel and clamped to 0..1. True counts as 1. */
  static fn(f: (x: number, y: number) => number | boolean, w: number, h: number, scale: number, within?: [x: number, y: number, w: number, h: number]): Mask {
    const a = new Float32Array(w * h);
    const [bx, by, bw, bh] = within ?? [0, 0, w / scale, h / scale];
    const [x0, y0, x1, y1] = [Math.max(0, Math.floor(bx * scale)), Math.max(0, Math.floor(by * scale)), Math.min(w, Math.ceil((bx + bw) * scale)), Math.min(h, Math.ceil((by + bh) * scale))];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * w + x] = Math.min(1, Math.max(0, +f((x + 0.5) / scale, (y + 0.5) / scale)));
    return new Mask(a, w, h, scale);
  }

  private map(f: (v: number, i: number) => number): Mask {
    const a = new Float32Array(this.a.length);
    for (let i = 0; i < a.length; i++) a[i] = f(this.a[i]!, i);
    return new Mask(a, this.w, this.h, this.scale);
  }

  /** Soften the edge. Radius in logical units. */
  feather(r: number): Mask {
    const R = Math.round((r * this.scale) / 2);
    if (R < 1) return this;
    return new Mask(boxBlur(boxBlur(this.a, this.w, this.h, R), this.w, this.h, R), this.w, this.h, this.scale);
  }
  /** Everything this mask blocks. */
  not(): Mask {
    return this.map((v) => 1 - v);
  }
  /** Only where both let through. */
  and(o: Mask): Mask {
    return this.map((v, i) => v * o.a[i]!);
  }
  /** Where either lets through. */
  or(o: Mask): Mask {
    return this.map((v, i) => 1 - (1 - v) * (1 - o.a[i]!));
  }
  /** This mask with another cut out of it. */
  minus(o: Mask): Mask {
    return this.map((v, i) => v * (1 - o.a[i]!));
  }
  /** Value at a logical position. */
  at(x: number, y: number): number {
    const px = Math.floor(x * this.scale);
    const py = Math.floor(y * this.scale);
    return px < 0 || py < 0 || px >= this.w || py >= this.h ? 0 : this.a[py * this.w + px]!;
  }
  /**
   * The outline of every separate patch of the mask, as polygons, largest first. For ruling a line round a painted layer
   * or round several solids seen as one. `tol` is how far a corner may be cut, in logical units, and never less than 1.2 pixels, which is what it takes to smooth the steps of the pixel grid. Holes are not traced.
   */
  outlines(tol = 0.5): Pt[][] {
    const { w, h, a } = this;
    const comp = new Int32Array(w * h).fill(-1);
    const out: { poly: Pt[]; n: number }[] = [];
    const stack: number[] = [];
    for (let s = 0; s < a.length; s++) {
      if (a[s]! < 0.5 || comp[s] !== -1) continue;
      const id = out.length;
      let n = 0;
      comp[s] = id;
      stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        n++;
        const x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (j < 0 || j >= a.length || comp[j] !== -1 || a[j]! < 0.5) continue;
          comp[j] = id;
          stack.push(j);
        }
      }
      // Walk the pixel edges with the patch on the right, starting at its first pixel in reading order.
      const isIn = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && comp[y * w + x] === id;
      const [sx, sy] = [s % w, Math.floor(s / w)];
      let [vx, vy, dx, dy] = [sx, sy, 1, 0];
      const ring: Pt[] = [];
      do {
        ring.push([vx, vy]);
        vx += dx;
        vy += dy;
        const [rx, ry] = [-dy, dx];
        const right = isIn(vx + (dx + rx - 1) / 2, vy + (dy + ry - 1) / 2);
        const left = isIn(vx + (dx - rx - 1) / 2, vy + (dy - ry - 1) / 2);
        if (!right) [dx, dy] = [rx, ry];
        else if (left) [dx, dy] = [-rx, -ry];
      } while (vx !== sx || vy !== sy || dx !== 1 || dy !== 0);
      const poly = facet(ring, Math.max(1.2, tol * this.scale)).map(([x, y]): Pt => [x / this.scale, y / this.scale]);
      out.push({ poly: poly.length >= 3 ? poly : [], n });
    }
    return out.filter((o) => o.poly.length).sort((p, q) => q.n - p.n).map((o) => o.poly);
  }

  /** Bounding box of everything above 0.02, in logical units. Undefined when the mask is empty. */
  box(): [x: number, y: number, w: number, h: number] | undefined {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.a[y * this.w + x]! <= 0.02) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return x1 < 0 ? undefined : [x0 / this.scale, y0 / this.scale, (x1 - x0 + 1) / this.scale, (y1 - y0 + 1) / this.scale];
  }
}

/** Anything that says where: a polygon, several polygons (the inner ones are holes), or a mask. */
export type Area = Pt[] | Pt[][] | Mask;
