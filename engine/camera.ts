// A pinhole camera, so things can be placed in space and land on the sheet in correct perspective.
// World: right-handed. With the camera looking down -z, x is right, y is up and z comes toward the viewer.
// A camera placed at -z looking toward +z sees +x on its left. Screen: logical units, y down.
import type { Pt } from "./core/path.ts";

export type V3 = [number, number, number];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface Camera {
  /** Screen x, y and the size of one world unit at that depth. Undefined when behind the camera. */
  project(p: V3): [number, number, number] | undefined;
  /** Distance along the view axis. Sort by this to draw far things first. */
  depth(p: V3): number;
  /** The line of sight through a point of the sheet: where it starts and the direction it travels (not unit length). */
  ray(x: number, y: number): { o: V3; d: V3 };
  /** A world-space polyline as stroke points. Points behind the camera are dropped. */
  path(pts: V3[], pressure?: number): Pt[];
}

/** `width` and `height` are the size of the view. `left` and `top` set where its corner sits on the sheet, so several views can share one sheet. */
export function camera(o: { eye: V3; target: V3; fov?: number; width: number; height: number; left?: number; top?: number }): Camera {
  const [cx, cy] = [(o.left ?? 0) + o.width / 2, (o.top ?? 0) + o.height / 2];
  const f = norm(sub(o.target, o.eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const focal = o.height / 2 / Math.tan((((o.fov ?? 50) * Math.PI) / 180) / 2);
  const project = (p: V3): [number, number, number] | undefined => {
    const d = sub(p, o.eye);
    const z = dot(d, f);
    if (z < 0.01) return undefined;
    return [cx + (dot(d, r) / z) * focal, cy - (dot(d, u) / z) * focal, focal / z];
  };
  return {
    project,
    depth: (p) => dot(sub(p, o.eye), f),
    ray: (x, y) => {
      const [a, b] = [x - cx, cy - y];
      return { o: o.eye, d: [f[0] * focal + r[0] * a + u[0] * b, f[1] * focal + r[1] * a + u[1] * b, f[2] * focal + r[2] * a + u[2] * b] };
    },
    path: (pts, pressure) => pts.flatMap((p) => { const s = project(p); return s ? [[s[0], s[1], pressure] as Pt] : []; }),
  };
}

/** Diffuse brightness of a surface facing `normal` under a light travelling along `light`. 0..1. */
export const lambert = (normal: V3, light: V3) => Math.max(0, -dot(norm(normal), norm(light)));

/** Where the shadow of a world point falls on the ground plane y = 0, for a light travelling along `light`. */
export const groundShadow = (p: V3, light: V3): V3 => [p[0] - (light[0] * p[1]) / light[1], 0, p[2] - (light[2] * p[1]) / light[1]];
