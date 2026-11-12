// Forms in space. A hand builds a head from a ball and a jaw, and a figure from a stack of masses, before drawing either.
// This file is that construction. A solid placed in the world gives the sheet three things: its outline, how much light
// each point of it catches (with the shadows other solids cast on it), and where its shadow falls on the ground.
// World: right-handed, as in camera.ts. Seen by a camera looking down -z, x is right, y is up and z comes toward the viewer.
import { type Camera, cross, dot, lambert, norm, sub, type V3 } from "./camera.ts";
import { hull, type Pt } from "./core/path.ts";

/** The three local axes of a solid, as world directions. */
export type Basis = [V3, V3, V3];

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/**
 * The basis of something that faces the viewer of a camera looking down -z. Local z points out of its front, toward +z at rest.
 * `yaw` turns the front toward the viewer's right, `pitch` tips it up, `roll` tilts it clockwise as seen. Radians.
 */
export function facing(yaw = 0, pitch = 0, roll = 0): Basis {
  const [sy, cy, sp, cp, sr, cr] = [Math.sin(yaw), Math.cos(yaw), Math.sin(pitch), Math.cos(pitch), Math.sin(roll), Math.cos(roll)];
  const right: V3 = [cy, 0, -sy];
  const up: V3 = [-sy * sp, cp, -cy * sp];
  const front: V3 = [sy * cp, sp, cy * cp];
  return [add([right[0] * cr, right[1] * cr, right[2] * cr], up, -sr), add([up[0] * cr, up[1] * cr, up[2] * cr], right, sr), front];
}

/** A basis whose local y runs along `dir`, for limbs and anything long. `side` says roughly where local x should point. */
export function along(dir: V3, side: V3 = Math.abs(norm(dir)[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0]): Basis {
  const y = norm(dir);
  const x = norm(add(side, y, -dot(side, y)));
  return [x, y, cross(x, y)];
}

/** A convex solid: a unit ball, cube or cylinder (axis along local y) scaled by `r` along its own axes and set at `c`. */
export interface Solid {
  kind: "ball" | "box" | "tube";
  c: V3;
  /** Half extents along the local axes. */
  r: V3;
  m: Basis;
}

/** An ellipsoid. One radius makes a sphere. */
export const ball = (c: V3, r: number | V3, m: Basis = facing()): Solid => ({ kind: "ball", c, r: typeof r === "number" ? [r, r, r] : r, m });
/** A box of the given full size, centred at c. */
export const box = (c: V3, size: V3, m: Basis = facing()): Solid => ({ kind: "box", c, r: [size[0] / 2, size[1] / 2, size[2] / 2], m });
/** A cylinder of the given radius and full height, centred at c, standing along local y. */
export const tube = (c: V3, radius: number, height: number, m: Basis = facing()): Solid => ({ kind: "tube", c, r: [radius, height / 2, radius], m });

const toLocal = (s: Solid, v: V3): V3 => [dot(v, s.m[0]) / s.r[0], dot(v, s.m[1]) / s.r[1], dot(v, s.m[2]) / s.r[2]];
const toWorld = (s: Solid, l: V3): V3 => add(add(add(s.c, s.m[0], l[0] * s.r[0]), s.m[1], l[1] * s.r[1]), s.m[2], l[2] * s.r[2]);

/** Where a line of sight first meets a solid: the distance along `d` (in lengths of d) and the surface normal there. */
export function hit(s: Solid, o: V3, d: V3): { t: number; n: V3 } | undefined {
  const lo = toLocal(s, sub(o, s.c));
  const ld = toLocal(s, d);
  let t = Infinity;
  let n: V3 = [0, 0, 0];
  const take = (tt: number, nn: V3) => {
    if (tt > 1e-6 && tt < t) [t, n] = [tt, nn];
  };
  if (s.kind === "ball") {
    const [a, b, c] = [dot(ld, ld), dot(lo, ld), dot(lo, lo) - 1];
    const disc = b * b - a * c;
    if (disc < 0) return undefined;
    const tt = (-b - Math.sqrt(disc)) / a;
    take(tt, add(lo, ld, tt));
  } else if (s.kind === "box") {
    let [t0, t1, axis] = [-Infinity, Infinity, 0];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]!) < 1e-12) {
        if (Math.abs(lo[i]!) > 1) return undefined;
        continue;
      }
      const [a, b] = [(-1 - lo[i]!) / ld[i]!, (1 - lo[i]!) / ld[i]!];
      if (Math.min(a, b) > t0) [t0, axis] = [Math.min(a, b), i];
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > t1) return undefined;
    const nn: V3 = [0, 0, 0];
    nn[axis] = ld[axis]! > 0 ? -1 : 1;
    take(t0, nn);
  } else {
    const [a, b, c] = [ld[0] * ld[0] + ld[2] * ld[2], lo[0] * ld[0] + lo[2] * ld[2], lo[0] * lo[0] + lo[2] * lo[2] - 1];
    const disc = b * b - a * c;
    if (a > 1e-12 && disc >= 0) {
      const tt = (-b - Math.sqrt(disc)) / a;
      if (Math.abs(lo[1] + ld[1] * tt) <= 1) take(tt, [lo[0] + ld[0] * tt, 0, lo[2] + ld[2] * tt]);
    }
    for (const cap of [-1, 1]) {
      if (Math.abs(ld[1]) < 1e-12) continue;
      const tt = (cap - lo[1]) / ld[1];
      if ((lo[0] + ld[0] * tt) ** 2 + (lo[2] + ld[2] * tt) ** 2 <= 1) take(tt, [0, cap, 0]);
    }
  }
  if (t === Infinity) return undefined;
  // A normal goes back to the world through the inverse scale.
  return { t, n: norm(add(add(add([0, 0, 0], s.m[0], n[0] / s.r[0]), s.m[1], n[1] / s.r[1]), s.m[2], n[2] / s.r[2])) };
}

/** Points on the surface of a solid, enough that their convex outline is the solid's outline. */
function surface(s: Solid): V3[] {
  const out: V3[] = [];
  if (s.kind === "box") {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push(toWorld(s, [x, y, z]));
  } else if (s.kind === "tube") {
    for (const y of [-1, 1]) for (let i = 0; i < 40; i++) out.push(toWorld(s, [Math.cos((i / 40) * Math.PI * 2), y, Math.sin((i / 40) * Math.PI * 2)]));
  } else {
    for (let j = 0; j <= 16; j++) {
      const [sy, cy] = [Math.sin((j / 16 - 0.5) * Math.PI), Math.cos((j / 16 - 0.5) * Math.PI)];
      for (let i = 0; i < 32; i++) out.push(toWorld(s, [cy * Math.cos((i / 32) * Math.PI * 2), sy, cy * Math.sin((i / 32) * Math.PI * 2)]));
    }
  }
  return out;
}

/** One solid as it lands on the sheet. */
export interface Form {
  solid: Solid;
  /** Its outline on the sheet, a convex polygon. */
  outline: Pt[];
  /** Lines inside the outline: the edges of a box between two faces in view, and the rim of a cylinder's near end. */
  edges: Pt[][];
  /** The outline of its shadow on the ground y = 0, as seen on the sheet. Empty when the light does not come from above. */
  shadow: Pt[];
  /** Bounding box of the outline: x, y, w, h. Pass it to `p.mask` as `within`. */
  box: [number, number, number, number];
  /** Distance from the camera. Forms come sorted far to near. */
  depth: number;
  /** Light caught at a point of the sheet, 0..1. 0 where the form turns away, where another solid shades it, and outside the form. */
  lit(x: number, y: number): number;
  /** Whether the form covers a point of the sheet, ignoring what stands in front of it. */
  covers(x: number, y: number): boolean;
}

/** Several solids seen as one form, such as a head or a hand. Unlike a single solid it can be hollow, and it knows what stands in front of it. */
export interface Part {
  /** Whether the part is what the eye sees at a point of the sheet. `p.mask(part.covers, 0, part.box).outlines()` is its outline. */
  covers(x: number, y: number): boolean;
  /** Light on the part where it is in view, 0..1, with the shadows its own solids and all others cast on it. */
  lit(x: number, y: number): number;
  box: [number, number, number, number];
}

export interface Scene {
  /** Every solid, far to near. Paint them in this order and each covers what is behind it. */
  forms: Form[];
  /** Several of the scene's solids taken as one form. */
  part(solids: Solid[]): Part;
  /** Light on the ground y = 0 at a point of the sheet: 1 in the open, 0 in a cast shadow. */
  ground(x: number, y: number): number;
  /** Light at a point of the sheet on whatever is nearest there, a solid or the ground. */
  lit(x: number, y: number): number;
  /** Whether a world point is in plain sight, with no solid between it and the camera. For deciding if a far eye or a hidden hand is drawn. */
  sees(p: V3): boolean;
}

/** Put solids under one camera and one light (the direction the light travels). */
export function scene(cam: Camera, light: V3, solids: Solid[]): Scene {
  const back = norm([-light[0], -light[1], -light[2]]);
  const eye = cam.ray(0, 0).o;
  // A sphere round each solid. A ray that misses the sphere misses the solid, which spares most of the exact tests.
  const reach = new Map(solids.map((s) => [s, s.kind === "ball" ? Math.max(...s.r) : Math.hypot(...s.r)]));
  const near = (s: Solid, o: V3, d: V3) => {
    const oc = sub(s.c, o);
    const t = dot(oc, d);
    const R = reach.get(s)!;
    return dot(oc, oc) - (t > 0 ? (t * t) / dot(d, d) : 0) <= R * R;
  };
  const shaded = (p: V3, self?: Solid) => solids.some((s) => s !== self && near(s, p, back) && hit(s, p, back));
  const project = (pts: V3[]) => pts.flatMap((q): Pt[] => { const s = cam.project(q); return s ? [[s[0], s[1]]] : []; });
  const lightAt = (s: Solid, h: { n: V3; p: V3 }) => {
    const l = lambert(h.n, light);
    return l > 0 && !shaded(add(h.p, h.n, 1e-4), s) ? l : 0;
  };
  const made = solids.map((solid) => {
    const pts = surface(solid);
    const outline = hull(project(pts));
    const xs = outline.map((q) => q[0]);
    const ys = outline.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const at = (x: number, y: number) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return undefined;
      const { o, d } = cam.ray(x, y);
      const h = hit(solid, o, d);
      return h && { ...h, p: add(o, d, h.t) };
    };
    // A face is in view when it turns toward the eye.
    const inView = (axis: number, sign: number) => {
      const n: V3 = [solid.m[axis]![0] * sign, solid.m[axis]![1] * sign, solid.m[axis]![2] * sign];
      return dot(n, sub(add(solid.c, n, solid.r[axis]!), eye)) < 0;
    };
    const edges: Pt[][] = [];
    if (solid.kind === "box") {
      for (let axis = 0; axis < 3; axis++) {
        const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
        for (const su of [-1, 1]) for (const sv of [-1, 1]) {
          if (!inView(u, su) || !inView(v, sv)) continue;
          const [p0, p1]: V3[] = [[0, 0, 0], [0, 0, 0]];
          [p0[axis], p0[u], p0[v]] = [-1, su, sv];
          [p1[axis], p1[u], p1[v]] = [1, su, sv];
          const e = project([toWorld(solid, p0), toWorld(solid, p1)]);
          if (e.length === 2) edges.push(e);
        }
      }
    } else if (solid.kind === "tube") {
      for (const cap of [-1, 1]) {
        if (!inView(1, cap)) continue;
        const rim = project(Array.from({ length: 41 }, (_, i): V3 => toWorld(solid, [Math.cos((i / 40) * Math.PI * 2), cap, Math.sin((i / 40) * Math.PI * 2)])));
        if (rim.length === 41) edges.push(rim);
      }
    }
    const form: Form = {
      solid,
      outline,
      edges,
      box: [x0, y0, x1 - x0, y1 - y0],
      shadow: light[1] < 0 ? hull(project(pts.filter((q) => q[1] >= 0).map((q): V3 => [q[0] - (light[0] * q[1]) / light[1], 0, q[2] - (light[2] * q[1]) / light[1]]))) : [],
      depth: cam.depth(solid.c),
      covers: (x, y) => !!at(x, y),
      lit: (x, y) => {
        const h = at(x, y);
        return h ? lightAt(solid, h) : 0;
      },
    };
    return { form, at };
  });
  const forms = made.map((m) => m.form).sort((a, b) => b.depth - a.depth);
  /** The solid the eye meets first at a point of the sheet. */
  const first = (x: number, y: number) => {
    let best: { solid: Solid; t: number; n: V3; p: V3 } | undefined;
    for (const m of made) {
      const h = m.at(x, y);
      if (h && (!best || h.t < best.t)) best = { solid: m.form.solid, ...h };
    }
    return best;
  };
  const ground = (x: number, y: number) => {
    const { o, d } = cam.ray(x, y);
    if (d[1] >= 0 || o[1] <= 0) return 1;
    return shaded(add(o, d, -o[1] / d[1])) ? 0 : 1;
  };
  return {
    forms,
    ground,
    part: (group) => {
      const own = new Set(group);
      const boxes = made.filter((m) => own.has(m.form.solid)).map((m) => m.form.box);
      const [x0, y0] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1]))];
      const [x1, y1] = [Math.max(...boxes.map((b) => b[0] + b[2])), Math.max(...boxes.map((b) => b[1] + b[3]))];
      const seen = (x: number, y: number) => {
        const h = first(x, y);
        return h && own.has(h.solid) ? h : undefined;
      };
      return {
        box: [x0, y0, x1 - x0, y1 - y0],
        covers: (x, y) => !!seen(x, y),
        lit: (x, y) => {
          const h = seen(x, y);
          return h ? lightAt(h.solid, h) : 0;
        },
      };
    },
    lit: (x, y) => {
      const h = first(x, y);
      return h ? lightAt(h.solid, h) : ground(x, y);
    },
    sees: (p) => {
      const d = sub(p, eye);
      return !solids.some((s) => {
        const h = near(s, eye, d) && hit(s, eye, d);
        return h && h.t < 0.985;
      });
    },
  };
}

/**
 * A hand as a palm, four fingers of two joints and a thumb. `at` is the wrist, `dir` the way the fingers point,
 * `palm` the way the palm faces, `size` the length from wrist to fingertip. `curl` closes the fingers from 0 (flat) to 1 (fist),
 * `spread` fans them. `left` puts the thumb on the other side.
 */
export function hand(o: { at: V3; dir: V3; palm: V3; size: number; curl?: number; spread?: number; left?: boolean }): Solid[] {
  const [L, curl, spread] = [o.size, o.curl ?? 0.25, o.spread ?? 0.3];
  const y = norm(o.dir);
  const z = norm(add(o.palm, y, -dot(o.palm, y)));
  const x = cross(y, z);
  const m: Basis = [x, y, z];
  const P = (lx: number, ly: number, lz = 0): V3 => add(add(add(o.at, x, lx * L), y, ly * L), z, lz * L);
  const bent = (a: number, fan: number): V3 => norm(add(add([y[0] * Math.cos(a), y[1] * Math.cos(a), y[2] * Math.cos(a)], z, Math.sin(a)), x, fan));
  const out: Solid[] = [box(P(0, 0.25), [0.42 * L, 0.5 * L, 0.12 * L], m)];
  const digit = (from: V3, dirs: V3[], lens: number[], w: number) => {
    dirs.forEach((d, i) => {
      out.push(ball(add(from, d, (lens[i]! * L) / 2), [w * L, (lens[i]! * L) / 2 + w * L * 0.5, w * L], along(d, x)));
      from = add(from, d, lens[i]! * L);
    });
  };
  for (let i = 0; i < 4; i++) {
    const fan = (i - 1.5) * spread * 0.16;
    digit(P((i - 1.5) * 0.105, 0.5), [bent(curl * 1.2, fan), bent(curl * 2.7, fan)], i === (o.left ? 3 : 0) ? [0.22, 0.17] : [0.27, 0.23], 0.047);
  }
  const t = o.left ? -1 : 1;
  digit(P(t * 0.2, 0.1), [norm(add(add([y[0] * 0.6, y[1] * 0.6, y[2] * 0.6], x, t * 0.75), z, 0.35 * curl)), norm(add(add([y[0], y[1], y[2]], x, t * (0.35 - 0.5 * curl)), z, 0.5 * curl))], [0.2, 0.17], 0.055);
  return out;
}

/** A head built the way it is drawn: a cranium ball, a jaw mass hung under its front, a nose, two ears and a neck. */
export interface Head {
  solids: Solid[];
  /**
   * A point on the surface of the face. `u` runs across the face and `v` up it, in cranium radii from the centre of the ball,
   * so features typed in flat face coordinates land foreshortened however the head is turned. u is positive toward the head's own left.
   * Undefined where the face has no surface in front of that position.
   */
  on(u: number, v: number): V3 | undefined;
  /** A line across the face as world points, for `cam.path`. Positions off the face are dropped. */
  curve(uv: [number, number][]): V3[];
  /** Landmarks by the usual thirds: the brow on the equator of the ball, the base of the nose two thirds of a radius under it, the chin as far again. */
  marks: Record<"eyeL" | "eyeR" | "browL" | "browR" | "noseTip" | "noseBase" | "mouth" | "chin" | "top" | "earL" | "earR", V3>;
}

export function head(o: { at: V3; size: number; yaw?: number; pitch?: number; roll?: number; neck?: boolean }): Head {
  const m = facing(o.yaw, o.pitch, o.roll);
  const P = (l: V3): V3 => add(add(add(o.at, m[0], l[0] * o.size), m[1], l[1] * o.size), m[2], l[2] * o.size);
  const R = (r: V3): V3 => [r[0] * o.size, r[1] * o.size, r[2] * o.size];
  const face = [ball(P([0, 0, 0]), R([0.8, 0.95, 1]), m), ball(P([0, -0.55, 0.3]), R([0.62, 0.82, 0.62]), m), ball(P([0, -0.42, 0.9]), R([0.12, 0.24, 0.2]), m)];
  const solids = [...face, ball(P([0.8, -0.3, -0.08]), R([0.07, 0.24, 0.15]), m), ball(P([-0.8, -0.3, -0.08]), R([0.07, 0.24, 0.15]), m)];
  if (o.neck !== false) solids.push(tube(P([0, -1.35, -0.25]), 0.42 * o.size, 1.3 * o.size, m));
  const inward: V3 = [-m[2][0], -m[2][1], -m[2][2]];
  const on = (u: number, v: number) => {
    const from = P([u, v, 3]);
    let t = Infinity;
    for (const s of face) t = Math.min(t, hit(s, from, inward)?.t ?? Infinity);
    return t === Infinity ? undefined : add(from, inward, t);
  };
  const need = (u: number, v: number) => on(u, v)!;
  return {
    solids,
    on,
    curve: (uv) => uv.flatMap(([u, v]) => { const q = on(u, v); return q ? [q] : []; }),
    marks: {
      eyeL: need(0.36, -0.1),
      eyeR: need(-0.36, -0.1),
      browL: need(0.38, 0.1),
      browR: need(-0.38, 0.1),
      noseTip: need(0, -0.44),
      noseBase: need(0, -0.67),
      mouth: need(0, -0.9),
      chin: need(0, -1.3),
      top: P([0, 0.95, 0]),
      earL: P([0.87, -0.3, -0.08]),
      earR: P([-0.87, -0.3, -0.08]),
    },
  };
}

export type Bone = "spine" | "neck" | "upperArmL" | "forearmL" | "upperArmR" | "forearmR" | "thighL" | "shinL" | "thighR" | "shinR";
export type Joint = "pelvis" | "chest" | "head" | "shoulderL" | "elbowL" | "wristL" | "shoulderR" | "elbowR" | "wristR" | "hipL" | "kneeL" | "ankleL" | "hipR" | "kneeR" | "ankleR";

/** A mannequin seven and a half heads tall. */
export interface Figure {
  joints: Record<Joint, V3>;
  /** Masses for the pelvis, ribcage, neck, limbs, hands and feet, and the solids of the head. Hand them to `scene`. */
  solids: Solid[];
  head: Head;
  /** The solids of each hand when the figure was made with `hands`, for `scene.part`. Empty otherwise, and the hand is one mitten. */
  hands: { L: Solid[]; R: Solid[] };
  /** One head height in world units. */
  unit: number;
}

/**
 * A posed mannequin. `at` is the point of the ground under the pelvis and `height` the standing height.
 * `pose` gives the direction each bone runs, in the figure's own frame: x toward its left, y up, z out of its chest.
 * Bones left out hang as in a relaxed stand. `hip` is the height of the pelvis in heads, 3.95 standing, lower to sit or crouch.
 * Lengths are fixed in heads, so a pose cannot break proportion. `hands` builds each hand from a palm and fingers instead of a mitten.
 */
export function figure(o: { at: V3; height: number; yaw?: number; hip?: number; pose?: Partial<Record<Bone, V3>>; head?: { yaw?: number; pitch?: number; roll?: number }; hands?: boolean | { curl?: number; spread?: number } }): Figure {
  const H = o.height / 7.5;
  const m = facing(o.yaw);
  const dir = (b: Bone, rest: V3): V3 => {
    const l = norm(o.pose?.[b] ?? rest);
    return add(add(add([0, 0, 0], m[0], l[0]), m[1], l[1]), m[2], l[2]);
  };
  const [side, front] = [m[0], m[2]];
  const spine = dir("spine", [0, 1, 0]);
  const neck = dir("neck", o.pose?.spine ?? [0, 1, 0]);
  const pelvis = add(o.at, [0, 1, 0], (o.hip ?? 3.95) * H);
  const chest = add(pelvis, spine, 2.25 * H);
  const j = { pelvis, chest, head: add(chest, neck, 0.8 * H) } as Record<Joint, V3>;
  const solids: Solid[] = [];
  const hands: { L: Solid[]; R: Solid[] } = { L: [], R: [] };
  const torso = along(spine, side);
  solids.push(ball(add(pelvis, spine, 0.1 * H), [0.72 * H, 0.52 * H, 0.45 * H], torso), ball(add(pelvis, spine, 1.4 * H), [0.82 * H, 0.98 * H, 0.5 * H], torso));
  solids.push(tube(add(chest, neck, 0.2 * H), 0.2 * H, 0.6 * H, along(neck, side)));
  const limb = (from: V3, d: V3, len: number, w: number) => {
    solids.push(ball(add(from, d, (len * H) / 2), [w * H, (len * H) / 2 + w * H * 0.4, w * H], along(d, side)));
    return add(from, d, len * H);
  };
  for (const [s, k] of [["L", 1], ["R", -1]] as const) {
    j[`shoulder${s}`] = add(add(chest, spine, -0.2 * H), side, 0.9 * H * k);
    j[`elbow${s}`] = limb(j[`shoulder${s}`], dir(`upperArm${s}`, [0.12 * k, -1, 0]), 1.45, 0.21);
    const fore = dir(`forearm${s}`, o.pose?.[`upperArm${s}`] ?? [0.12 * k, -1, 0]);
    j[`wrist${s}`] = limb(j[`elbow${s}`], fore, 1.2, 0.17);
    if (o.hands) {
      const hs = hand({ at: j[`wrist${s}`], dir: fore, palm: [-side[0] * k, -side[1] * k, -side[2] * k], size: 0.75 * H, left: s === "L", ...(o.hands === true ? {} : o.hands) });
      hands[s] = hs;
      solids.push(...hs);
    } else solids.push(ball(add(j[`wrist${s}`], fore, 0.32 * H), [0.13 * H, 0.36 * H, 0.2 * H], along(fore, side)));
    j[`hip${s}`] = add(add(pelvis, spine, -0.1 * H), side, 0.42 * H * k);
    j[`knee${s}`] = limb(j[`hip${s}`], dir(`thigh${s}`, [0, -1, 0]), 1.9, 0.36);
    j[`ankle${s}`] = limb(j[`knee${s}`], dir(`shin${s}`, o.pose?.[`thigh${s}`] ?? [0, -1, 0]), 1.75, 0.25);
    solids.push(ball(add(add(j[`ankle${s}`], front, 0.35 * H), [0, 1, 0], -0.06 * H), [0.2 * H, 0.14 * H, 0.52 * H], m));
  }
  const hd = head({ at: j.head, size: 0.5 * H, yaw: (o.yaw ?? 0) + (o.head?.yaw ?? 0), pitch: o.head?.pitch, roll: o.head?.roll, neck: false });
  return { joints: j, solids: [...solids, ...hd.solids], head: hd, hands, unit: H };
}
