# atelier

A painting engine built for Claude, and the paintings made with it.

A painting is a TypeScript file in `works/`. Rendering it gives a PNG that Claude looks at, judges, and revises. The engine grows only when a painting needs a mark it cannot make yet. How the work is done is in [`METHOD.md`](METHOD.md).

[中文](README.zh-CN.md)

![赶集图 · Market Day](docs/images/003-market-day.jpg)

<table>
  <tr>
    <td width="33%"><img src="docs/images/001-someone-is-awake.jpg" alt="有人醒着 · Someone Is Awake"></td>
    <td width="33%"><img src="docs/images/003-new-friend.jpg" alt="新朋友 · New Friend"></td>
    <td width="33%"><img src="docs/images/002-the-one-taken.jpg" alt="选中的那一条 · The One Taken"></td>
  </tr>
  <tr>
    <td align="center">有人醒着 · Someone Is Awake</td>
    <td align="center">新朋友 · New Friend</td>
    <td align="center">选中的那一条 · The One Taken</td>
  </tr>
</table>

Each image is a downscaled `--full` render of the work. `bun paint <work> --full` reproduces it.

## Commands

```
bun paint 001-name                          # preview, long edge 1400px, usually under a second
bun paint 001-name --scale 0.3              # a smaller preview
bun paint 001-name --crop 800,600,400,300   # zoom into a region, in logical units
bun paint 001-name --only sky,mist          # isolate layers
bun paint 001-name --seed 12                # try another variation
bun paint 001-name --full                   # final render at the work's own resolution
bun paint 001-name --frames 48              # animation frames, the work reads p.time

bun verify                                  # compare every work's pixels with the baseline
bun verify --update                         # record the current renders as the baseline
bun sheet out.png a.png b.png c.png         # tile images into one, to compare side by side
bun record 001-name                         # mp4 of the painting being made, mark by mark. needs ffmpeg
bun run check                               # typecheck
```

Output lands in `out/`. Coordinates are logical units, so a preview and a full render are the same picture at two pixel densities. The same seed always renders the same image.

## Works

| File | Title | What it is |
| --- | --- | --- |
| `001-someone-is-awake` | 有人醒着 | Blue hour over a lake, ridges in mist, one lit window |
| `002-the-one-taken` | 选中的那一条 | A branching tree in grey ink, one path in vermilion |
| `003-market-day` | 赶集图 | An old town on market day in ruled-line oblique view, about 430 generated figures, on aged silk |
| `003-new-friend` | 新朋友 | A ragdoll cat meets the little Claude crab, with the Claude spark on the wall |

`works/000-*.ts` are proof sheets. Each checks one family of engine behaviour.

| Proof sheet | What it checks |
| --- | --- |
| `000-proof` | The five canvas brushes and three textured tips |
| `000-wet` | Wet layer. Pigment mixing, smudge, wet over wet and wet over dry, bristles, running dry |
| `000-media` | Dry media. Pencil, charcoal, pastel and paper tooth |
| `000-water` | Watercolor. Dark rims, wet in wet, glazing, blooms, granulation |
| `000-space` | Camera, lighting, cast shadows, depth blur, lettering |
| `000-reference` | Painting from a reference. It reads `out/001-someone-is-awake@full.png`, so render that first |

## Stack

- **Bun.** Runs the TypeScript directly. No build step.
- **`@napi-rs/canvas`.** Skia behind the standard Canvas 2D API.
- **`culori`.** Color math in OKLCH and OKLab.
- **`simplex-noise`.** Seeded noise.
- **`perfect-freehand`.** Pressure-shaped stroke outlines.

## Layout

```
engine/
  index.ts            the whole public surface. works import only from here
  painting.ts         Painting. seed, paper, layer stack, compositing, effects
  core/               foundations
    rng.ts              seeded randomness and noise
    color.ts            color. lch, mix, shift, ramp, mixPigment
    pigment.ts          Kubelka-Munk pigment model
    path.ts             control points to samples. spline, taper, loop, inPoly, ribbon
    field.ts            scalar field math. boxBlur
  layers/             the three kinds of layer
    canvas.ts           canvas layer, Skia
    wet.ts              wet layer, also carries dry media
    water.ts            watercolor layer
  brushes/            brushes for canvas layers
    registry.ts         what a brush is, and the table of brushes
    builtin.ts          round, ink, dry, wash, stamp
    tips.ts             textured tips. sponge, chalk, speckle
  effects.ts          whole-image passes. grain, vignette, silk
  camera.ts           pinhole camera, lighting, ground shadows
  reference.ts        sampling a reference image
  tools/              command line. cli, verify, sheet, record
works/                paintings and proof sheets, plus baseline.json
```

## Three kinds of layer

A painting can mix all three. They composite in creation order.

| | Canvas `p.layer()` | Wet `p.wet()` | Watercolor `p.water()` |
| --- | --- | --- | --- |
| Underneath | Skia | Float arrays, a dry and a wet film per pixel | Water and pigment simulated on a fixed logical grid |
| Does the brush know what is on the canvas | No | Yes, it picks up wet paint | Yes, the water flows |
| Good for | Flat shapes, line, gradients, silhouettes, lettering, illustration | Oil, impasto, smudging, pencil, charcoal, pastel | Watercolor, washes, glazing |
| Speed | Fastest | Medium | Slowest, and independent of preview size |
| Edges | Crisp | Bristled | Dark rims and ragged outlines |

When unsure, use a canvas layer. Use a wet layer when paint should push against paint. Use a watercolor layer when water should move on its own.

## Writing a work

```ts
import { grain, lch, type Meta, type Painting } from "../engine/index.ts";

export const meta: Meta = { width: 2400, height: 3000, seed: 1 };

export default function paint(p: Painting) {
  p.background = "#f3ede0";
  const sky = p.layer("sky", { blend: "multiply" });
  sky.stroke("wash", [[200, 400], [1200, 300], [2200, 500]], { color: lch(0.7, 0.1, 230), size: 400 });
  p.post(grain(0.05));
}
```

A control point is `[x, y, pressure]`, pressure optional. Take randomness from `p.rng.fork("name")`. Each fork is an independent stream, so adding a random call in one place does not shift results in another.

## Canvas layer

### Brushes

`layer.stroke(brush, points, options)`. Options shared by all brushes are `color`, `size`, `opacity`, `taper` (pressure fade in and out), and `knockout` (erase a slightly wider halo first, so crossings read as over and under).

| Brush | Mark | Use |
| --- | --- | --- |
| `round` | Stamped dabs, soft to hard | Glow, blocking in, airbrush |
| `ink` | One pressure-shaped ribbon. `rough` makes the edge ragged | Line work, calligraphy, hair |
| `dry` | Separate bristles that run out of paint | Grass, wood grain, glints on water |
| `wash` | Stacked deformed translucent films | Quick washes, mist |
| `stamp` | Textured tips, rotated and scattered | Mottling, foliage, grit, spatter |

`stamp` takes a `tip`, one of `sponge`, `chalk`, `speckle`.

### Layer methods

- **Shapes.** `shape(poly, color)` fills a polygon. `loop(pts)` turns control points into a closed smooth outline. `vgrad(stops)` lays a vertical gradient. `fill(color)` covers the layer.
- **Confining.** `clip(poly, fn)` confines drawing to a shape. `atop(fn)` confines drawing to what the layer already covers, for shading and markings on a finished form.
- **Pixels.** `warp(fn)` displaces, used for water. `blur(r)` softens, for depth of field and soft shadows. `wetEdge()` pools ink at the rim of marks. `pixels(fn)` gives raw access.
- **Other.** `silhouette(src, {...})` stamps another layer's shape, for shadows and glows. `text(...)` sets lettering. `draw(ctx => ...)` gives raw Canvas 2D.

## Wet layer

```ts
const oil = p.wet("oil", { impasto: 0.4 });
oil.fill("#d8cfc0");
oil.stroke(pts, { ...media.oil, color, size: 80, reach: 8 });
oil.smudge(pts, { size: 100, strength: 0.7 });
oil.dry();
```

- Every pixel has a dry film and a wet film. Only the wet film can be picked up.
- A stroke over dry paint covers it. A stroke over wet paint mixes with it. Wet paint dries after `life` strokes, or at once with `dry()`.
- The brush carries a row of bristle reservoirs, so dragging through two colors leaves streaks.
- Paint stirred together mixes as pigment (Kubelka-Munk), so blue and yellow make green. A film lying over another is averaged as reflected light.
- `smudge` is a clean brush. What it takes leaves the canvas and is laid down further on.
- Paint thickness is tracked and lit from the upper left. `impasto` sets how much.

Stroke options are `load` (paint on the brush), `pickup` (how readily it takes up wet paint), `hardness`, `bristle` (depth of streaks), `reach` (how far the load lasts), and `tooth` (resistance of the paper).

### Dry media

Pencil, charcoal and pastel are wet-layer strokes with `tooth` set. The whole painting shares one paper height field. Light pressure touches only the peaks, heavy pressure reaches the valleys.

```ts
const d = p.wet("drawing", { life: Infinity, impasto: 0 });
d.stroke(pts, { ...media.pencil, color: graphite, size: 5 });
d.stroke(pts, { ...media.charcoal, color: coal, size: 46 });
d.smudge(pts, { size: 80, strength: 0.8 });
```

`life: Infinity` keeps the marks smudgeable. `media` has five presets, `oil`, `knife`, `pencil`, `charcoal`, `pastel`.

## Watercolor layer

```ts
const w = p.water("sky", { granulation: 0.6 });
w.wetArea(pts, { size: 300 });                                   // flood the paper first, for wet in wet
w.stroke(pts, { color, size: 120, water: 0.9, pigment: 0.7 });
w.flow(100);                                                     // let it run
w.dry();                                                         // then glaze on top
```

- Water spreads through wet paper and creeps unevenly into dry paper. Pigment rides it, settles, and can lift again.
- Rims dry first and go dark. Clean water dropped into a damp wash pushes a bloom. Dry washes glaze over each other.
- The grid is fixed in logical units, so a preview and a full render run the same simulation.
- It multiplies onto what is beneath by default.

## Space and light

- `camera({ eye, target, fov, width, height })`. `cam.project(p)` returns the screen position and the size of one world unit at that depth. `cam.depth(p)` sorts far to near.
- `lambert(normal, light)` gives the tone of a face. `groundShadow(p, light)` gives where a point's shadow lands on the ground.
- Depth of field is `layer.blur()`. A soft shadow is `silhouette` followed by `blur`.

## Painting from a reference

```ts
const ref = await Reference.load(file, width, height);
layer.stroke(ref.trace(x, y, length, rng), { ...media.oil, color: ref.color(x, y), size });
```

- `color` and `lum` sample color and lightness.
- `along` is the direction forms run in. It comes from a structure tensor, so thin lines keep their orientation.
- `detail` says how much is going on. Small strokes belong where it is high.
- `trace` returns a stroke path that follows the form and stops at an edge.

## Extending

| To add | Do this |
| --- | --- |
| A canvas brush | Call `defineBrush(name, { defaults, draw })` in `brushes/builtin.ts` |
| A textured tip | Call `defineTip(name, alphaFn)` in `brushes/tips.ts` |
| A media preset | Add an entry to `media` in `layers/wet.ts` |
| A finishing effect | Return an `Effect` from `effects.ts` |
| A kind of layer | Implement `name`, `blend`, `opacity`, `canvas`, and add it to `AnyLayer` in `painting.ts` |

After changing the engine, run `bun verify`. Every work reporting `same` means no painting changed. If one changed, look at it, and update the baseline only when the change is intended.

## Known limits

- **Mixtures of several colors go grey and dark.** The pigment model has three bands. Fixing it needs a spectral model, at two to three times the memory per pixel.
- **The wet layer is memory hungry.** Ten floats per pixel, about 290MB at 2400×3000.
- **Wet-layer strokes end softly.**
- **Watercolor blooms are faint.** Visible, but without the crisp cauliflower edge real paper gives.
- **Very small shapes stay loose when painting from a reference.**
- **No vector output.** Wet, watercolor and tooth-aware layers are pixel simulations.
- **No realistic painting has been made yet.** The camera, lighting and reference tools work, but only on proof sheets.
