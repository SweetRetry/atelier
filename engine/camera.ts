// A pinhole camera, so things can be placed in space and land on the sheet in correct perspective.
// World: x right, y up, z away. Screen: logical units, y down.
import type { Pt } from "./core/path.ts";

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface Camera {
  /** Screen x, y and the size of one world unit at that depth. Undefined when behind the camera. */
  project(p: V3): [number, number, number] | undefined;
  /** Distance along the view axis. Sort by this to draw far things first. */
  depth(p: V3): number;
  /** A world-space polyline as stroke points. Points behind the camera are dropped. */
  path(pts: V3[], pressure?: number): Pt[];
}

export function camera(o: { eye: V3; target: V3; fov?: number; width: number; height: number }): Camera {
  const f = norm(sub(o.target, o.eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const focal = o.height / 2 / Math.tan((((o.fov ?? 50) * Math.PI) / 180) / 2);
  const project = (p: V3): [number, number, number] | undefined => {
    const d = sub(p, o.eye);
    const z = dot(d, f);
    if (z < 0.01) return undefined;
    return [o.width / 2 + (dot(d, r) / z) * focal, o.height / 2 - (dot(d, u) / z) * focal, focal / z];
  };
  return {
    project,
    depth: (p) => dot(sub(p, o.eye), f),
    path: (pts, pressure) => pts.flatMap((p) => { const s = project(p); return s ? [[s[0], s[1], pressure] as Pt] : []; }),
  };
}

/** Diffuse brightness of a surface facing `normal` under a light travelling along `light`. 0..1. */
export const lambert = (normal: V3, light: V3) => Math.max(0, -dot(norm(normal), norm(light)));

/** Where the shadow of a world point falls on the ground plane y = 0, for a light travelling along `light`. */
export const groundShadow = (p: V3, light: V3): V3 => [p[0] - (light[0] * p[1]) / light[1], 0, p[2] - (light[2] * p[1]) / light[1]];
