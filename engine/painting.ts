// The painting: one sheet with a seed, a paper, a stack of layers and a list of finishing effects.
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { type Color, rgba } from "./core/color.ts";
import { type Area, Mask } from "./core/mask.ts";
import { makeNoise, type Noise, Rng } from "./core/rng.ts";
import { Layer } from "./layers/canvas.ts";
import { WaterLayer, type WaterOpts } from "./layers/water.ts";
import { WetLayer, type WetOpts } from "./layers/wet.ts";

/** Post-process on device pixels of the flattened image. */
export type Effect = (data: Uint8ClampedArray, w: number, h: number, p: Painting) => void;

/** Every layer kind ends as a canvas with a name, a blend mode and an opacity. That is all compositing needs. */
export type AnyLayer = Layer | WetLayer | WaterLayer;
export interface LayerOpts {
  blend?: string;
  opacity?: number;
}

export class Painting {
  readonly rng: Rng;
  readonly noise: Noise;
  readonly pxW: number;
  readonly pxH: number;
  readonly layers: AnyLayer[] = [];
  private effects: Effect[] = [];
  /** Called after every mark on a canvas layer, with a weight for how much was done. The recorder listens here. */
  onTick?: (weight: number) => void;
  tick(weight = 1) {
    this.onTick?.(weight);
  }
  /** Color of the sheet. `null` is no sheet at all: the PNG keeps its transparency, for marks and stickers. */
  background: Color | null = "#ffffff";
  /** Size of the paper tooth in logical units. Set before the first stroke that uses it. */
  toothSize = 2.4;
  private toothField?: Float32Array;

  /** Paper height per device pixel, 0 is a valley, 1 is a peak. Dry media catch on the peaks. Shared by every layer. */
  get tooth(): Float32Array {
    if (!this.toothField) {
      const n = makeNoise(this.rng.fork("paper"));
      const f = 1 / (this.toothSize * this.scale);
      const t = new Float32Array(this.pxW * this.pxH);
      for (let y = 0; y < this.pxH; y++) {
        for (let x = 0; x < this.pxW; x++) {
          t[y * this.pxW + x] = 0.5 + 0.5 * (0.62 * n(x * f, y * f) + 0.38 * n(x * f * 2.7 + 9, y * f * 2.7));
        }
      }
      this.toothField = t;
    }
    return this.toothField;
  }

  constructor(
    readonly width: number,
    readonly height: number,
    readonly seed: number,
    readonly scale: number,
    /** Position in an animation, 0..1. A work may read it to move things. Always 0 for a still. */
    readonly time = 0,
  ) {
    this.rng = new Rng(seed);
    this.noise = makeNoise(this.rng.fork("noise"));
    this.pxW = Math.round(width * scale);
    this.pxH = Math.round(height * scale);
  }

  private obtain<T extends AnyLayer>(kind: new (...a: any[]) => T, name: string, make: () => T, o: LayerOpts): T {
    let l = this.layers.find((x): x is T => x instanceof kind && x.name === name);
    if (!l) {
      l = make();
      this.layers.push(l);
    }
    if (o.blend) l.blend = o.blend;
    if (o.opacity !== undefined) l.opacity = o.opacity;
    return l;
  }

  /** Get or create a canvas layer. Layers of every kind composite in creation order. */
  layer(name: string, o: LayerOpts = {}): Layer {
    return this.obtain(Layer, name, () => new Layer(name, this), o);
  }

  /** Get or create a wet layer, where strokes pick up and mix with the paint already there. Also used for dry media on paper tooth. */
  wet(name: string, o: WetOpts & LayerOpts = {}): WetLayer {
    return this.obtain(WetLayer, name, () => new WetLayer(name, this, o), o);
  }

  /** Get or create a watercolor layer, where water and pigment flow, settle and dry. Multiplies onto what is beneath. */
  water(name: string, o: WaterOpts & LayerOpts = {}): WaterLayer {
    return this.obtain(WaterLayer, name, () => new WaterLayer(name, this, o), o);
  }

  /**
   * A mask over the sheet. From a polygon, from several polygons (inner ones are holes), from a layer (where it is painted),
   * or from a function of logical position returning 0..1. Feather softens the edge, in logical units.
   * `within` limits a function to a box (x, y, w, h), so a costly one is not asked about the whole sheet.
   */
  mask(src: Area | AnyLayer | ((x: number, y: number) => number | boolean), feather = 0, within?: [x: number, y: number, w: number, h: number]): Mask {
    const m =
      src instanceof Mask
        ? src
        : typeof src === "function"
          ? Mask.fn(src, this.pxW, this.pxH, this.scale, within)
          : Array.isArray(src)
            ? Mask.poly(src, this.pxW, this.pxH, this.scale)
            : Mask.alpha(src.canvas, this.scale);
    return m.feather(feather);
  }

  post(e: Effect): this {
    this.effects.push(e);
    return this;
  }

  /** Composite layers without effects. Use mid-painting to reuse what is already there, e.g. a reflection. */
  composite(only?: string[]): Canvas {
    const out = createCanvas(this.pxW, this.pxH);
    const ctx = out.getContext("2d");
    if (this.background !== null) {
      ctx.fillStyle = rgba(this.background);
      ctx.fillRect(0, 0, this.pxW, this.pxH);
    }
    for (const l of this.layers) {
      if (only && !only.includes(l.name)) continue;
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = l.blend as GlobalCompositeOperation;
      ctx.drawImage(l.canvas, 0, 0);
    }
    return out;
  }

  /** Composite layers, then run effects. `only` isolates layers for inspection. */
  flatten(only?: string[]): Canvas {
    const out = this.composite(only);
    const ctx = out.getContext("2d");
    if (this.effects.length) {
      const img = ctx.getImageData(0, 0, this.pxW, this.pxH);
      for (const e of this.effects) e(img.data, this.pxW, this.pxH, this);
      ctx.putImageData(img, 0, 0);
    }
    return out;
  }
}
