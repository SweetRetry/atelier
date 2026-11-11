// What a brush is, and the table of brushes by name.
// A new kind of mark is one defineBrush call. Nothing else in the engine changes.
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { Color } from "../core/color.ts";
import type { Sample } from "../core/path.ts";
import type { Noise, Rng } from "../core/rng.ts";

export type Ctx = SKRSContext2D;

/** Everything a brush gets. Coordinates are logical units, the ctx is pre-scaled. */
export interface BrushEnv {
  ctx: Ctx;
  rng: Rng;
  noise: Noise;
  /** Device pixels per logical unit. */
  scale: number;
}

export interface BrushOpts {
  color: Color;
  /** Diameter in logical units. */
  size: number;
  opacity: number;
  [k: string]: any;
}

export interface Brush<O extends BrushOpts = BrushOpts> {
  defaults: O;
  /** Sample spacing as a fraction of size. */
  spacing?: number;
  draw(env: BrushEnv, path: Sample[], o: O): void;
}

const registry = new Map<string, Brush<any>>();

/** Register a brush. New kinds of mark are added here, nothing else changes. */
export function defineBrush<O extends BrushOpts>(name: string, brush: Brush<O>) {
  registry.set(name, brush);
}
export const brushNames = () => [...registry.keys()];

export interface StrokeOpts extends Partial<BrushOpts> {
  /** Pressure fade in and out, as fractions of length. */
  taper?: [number, number];
  /** Erase a halo this much wider than the stroke before drawing it, so it reads as passing over what is beneath. Fraction of size. */
  knockout?: number;
}

export function getBrush(name: string): Brush<any> {
  const b = registry.get(name);
  if (!b) throw new Error(`unknown brush "${name}". have: ${brushNames().join(", ")}`);
  return b;
}
