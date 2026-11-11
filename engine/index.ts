// Public surface of the engine. Works import only from here.
import "./brushes/builtin.ts";

// Foundations: randomness, color, pigment, paths.
export * from "./core/color.ts";
export * from "./core/path.ts";
export * from "./core/rng.ts";

// The sheet and its three kinds of layer.
export { type AnyLayer, type Effect, type LayerOpts, Painting } from "./painting.ts";
export { Layer } from "./layers/canvas.ts";
export { media, WetLayer, type WetOpts, type WetStroke } from "./layers/wet.ts";
export { WaterLayer, type WaterOpts, type WaterStroke } from "./layers/water.ts";

// Brushes and tips for canvas layers.
export { type Brush, type BrushEnv, brushNames, type BrushOpts, type Ctx, defineBrush, type StrokeOpts } from "./brushes/registry.ts";
export { defineTip, tipNames } from "./brushes/tips.ts";

// Finishing, space, and looking at a reference.
export * from "./effects.ts";
export * from "./camera.ts";
export { Reference } from "./reference.ts";

/** What a file in works/ exports next to its default paint function. */
export interface Meta {
  /** Logical size. Also the pixel size of a --full render. */
  width: number;
  height: number;
  seed: number;
}
