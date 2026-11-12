// bun measure <work> [--at x,y;x,y] [--ref image] [--grid n] [--seed n] [--crop x,y,w,h]
// Reads a render back as numbers, for what an eye judges at a glance and a painter working in code cannot.
// Positions are logical units, the same ones the work is written in. Lightness is 0 (black) to 100 (white).
//   layers   where each layer is painted: bounding box, centre of its paint, share of the sheet covered
//   values   the darkest, middle and lightest lightness (5th, 50th, 95th percentile)
//   grid     mean lightness of each cell of an n by n grid, to check the value plan
//   pull     the three cells with the strongest edges, which is where the eye lands first
//   at       color and lightness at given points. With --ref, also the reference there and how far off the render has that spot
// Writes out/<work>-measure.png: the render under a labelled grid of logical units, beside its edges.
import { createCanvas } from "@napi-rs/canvas";
import { resolve } from "node:path";
import { loadImage } from "@napi-rs/canvas";
import { toOklab } from "../core/color.ts";
import { boxBlur } from "../core/field.ts";
import { toLin } from "../core/pigment.ts";
import { type Meta, Painting } from "../index.ts";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? undefined : args[i + 1];
};
if (!name) {
  console.error("usage: bun measure <work> [--at x,y;x,y] [--grid n] [--seed n] [--crop x,y,w,h]");
  process.exit(1);
}
const root = resolve(import.meta.dir, "../..");
const id = name.replace(/^works\//, "").replace(/\.ts$/, "");
const mod = (await import(resolve(root, "works", `${id}.ts`))) as { meta: Meta; default: (p: Painting) => void | Promise<void> };
const { width, height } = mod.meta;
const [cx, cy, cw, ch] = (flag("crop") ?? `0,0,${width},${height}`).split(",").map(Number) as [number, number, number, number];
const scale = 1000 / Math.max(cw, ch);
const p = new Painting(width, height, flag("seed") ? Number(flag("seed")) : mod.meta.seed, scale);
await mod.default(p);
const flat = p.flatten();
const [x0, y0] = [Math.round(cx * scale), Math.round(cy * scale)];
const [w, h] = [Math.min(p.pxW - x0, Math.round(cw * scale)), Math.min(p.pxH - y0, Math.round(ch * scale))];
const px = flat.getContext("2d").getImageData(x0, y0, w, h).data;
const r1 = (v: number) => Math.round(v);

// Lightness as CIE L*, so equal steps look equal.
const lstar = (d: Uint8ClampedArray) => {
  const out = new Float32Array(d.length / 4);
  for (let i = 0; i < out.length; i++) {
    const Y = 0.2126 * toLin(d[i * 4]! / 255) + 0.7152 * toLin(d[i * 4 + 1]! / 255) + 0.0722 * toLin(d[i * 4 + 2]! / 255);
    out[i] = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }
  return out;
};
const L = lstar(px);

console.log(`${id}  ${width}x${height}${flag("crop") ? `  crop ${cx},${cy},${cw},${ch}` : ""}\n`);
console.log("layers (x, y, w, h of the painted area | centre of paint | share of sheet)");
for (const l of p.layers) {
  const d = l.canvas.getContext("2d").getImageData(0, 0, p.pxW, p.pxH).data;
  let [bx0, by0, bx1, by1, sx, sy, sa] = [Infinity, Infinity, -1, -1, 0, 0, 0];
  for (let y = 0; y < p.pxH; y++) {
    for (let x = 0; x < p.pxW; x++) {
      const i = (y * p.pxW + x) * 4;
      // A watercolor layer is opaque white where nothing is painted, so white counts as bare there.
      const a = l.blend === "multiply" && d[i + 3] === 255 ? 1 - Math.min(d[i]!, d[i + 1]!, d[i + 2]!) / 255 : d[i + 3]! / 255;
      if (a < 0.03) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      sx += x * a;
      sy += y * a;
      sa += a;
    }
  }
  const box = bx1 < 0 ? "empty" : `${r1(bx0 / scale)},${r1(by0 / scale)},${r1((bx1 - bx0 + 1) / scale)},${r1((by1 - by0 + 1) / scale)} | ${r1(sx / sa / scale)},${r1(sy / sa / scale)} | ${((sa / (p.pxW * p.pxH)) * 100).toFixed(1)}%`;
  console.log(`  ${l.name.padEnd(22)} ${box}`);
}

const sorted = Float32Array.from(L).sort();
const pct = (q: number) => r1(sorted[Math.floor(q * (sorted.length - 1))]!);
console.log(`\nvalues  dark ${pct(0.05)}  middle ${pct(0.5)}  light ${pct(0.95)}  range ${pct(0.95) - pct(0.05)}`);

// Edge strength: how far the color steps across each pixel, in OKLab so a change of hue at equal lightness counts too.
// It is taken after a slight blur (half a percent of the long edge), so the grain of hatching and paper does not count
// as an edge and the boundaries between shapes do. Scaled by 100 to sit beside the lightness numbers.
const lab = [0, 1, 2].map(() => new Float32Array(w * h));
for (let i = 0; i < w * h; i++) {
  const c = toOklab(toLin(px[i * 4]! / 255), toLin(px[i * 4 + 1]! / 255), toLin(px[i * 4 + 2]! / 255));
  for (let k = 0; k < 3; k++) lab[k]![i] = c[k]! * 100;
}
const S = lab.map((c) => boxBlur(boxBlur(c, w, h, 5), w, h, 5));
const E = new Float32Array(w * h);
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let e = 0;
    for (const c of S) e += (c[i + 1]! - c[i - 1]!) ** 2 + (c[i + w]! - c[i - w]!) ** 2;
    E[i] = Math.sqrt(e);
  }
}
const n = Number(flag("grid") ?? 6);
const cells: { gx: number; gy: number; mean: number; edge: number }[] = [];
for (let gy = 0; gy < n; gy++) {
  for (let gx = 0; gx < n; gx++) {
    let [sum, e, c] = [0, 0, 0];
    for (let y = Math.floor((gy * h) / n); y < Math.floor(((gy + 1) * h) / n); y++) {
      for (let x = Math.floor((gx * w) / n); x < Math.floor(((gx + 1) * w) / n); x++) {
        sum += L[y * w + x]!;
        e += E[y * w + x]!;
        c++;
      }
    }
    cells.push({ gx, gy, mean: sum / c, edge: e / c });
  }
}
const mid = (g: number, size: number, off: number) => r1(off + ((g + 0.5) * size) / n);
console.log(`\ngrid ${n}x${n}, mean lightness. columns are centred at x = ${Array.from({ length: n }, (_, g) => mid(g, cw, cx)).join(", ")}`);
for (let gy = 0; gy < n; gy++) console.log(`  y ${String(mid(gy, ch, cy)).padStart(5)} | ${cells.filter((c) => c.gy === gy).map((c) => String(r1(c.mean)).padStart(3)).join(" ")}`);
console.log("\npull, the cells with the strongest edges (centre x, y | edge strength)");
for (const c of [...cells].sort((a, b) => b.edge - a.edge).slice(0, 3)) console.log(`  ${mid(c.gx, cw, cx)}, ${mid(c.gy, ch, cy)} | ${c.edge.toFixed(1)}`);

// With --ref, the reference image is stretched over the sheet (or the crop) and each point is looked up in it.
// "off by" is how far from that point the render shows what the reference shows there, found by matching lightness
// within 6 percent of the long edge. A fit under 0.5 means nothing in the render looks like that patch.
let refL: Float32Array | undefined;
let refPx: Uint8ClampedArray | undefined;
if (flag("ref")) {
  const im = await loadImage(resolve(flag("ref")!));
  const c = createCanvas(w, h);
  const g = c.getContext("2d");
  g.drawImage(im, (cx / width) * im.width, (cy / height) * im.height, (cw / width) * im.width, (ch / height) * im.height, 0, 0, w, h);
  refPx = g.getImageData(0, 0, w, h).data;
  refL = lstar(refPx);
}
const hex = (d: Uint8ClampedArray, i: number) => `#${[0, 1, 2].map((c) => d[i * 4 + c]!.toString(16).padStart(2, "0")).join("")}`;
function moved(qx: number, qy: number): string {
  const [R, reach] = [40, 60];
  if (qx < R + reach || qy < R + reach || qx >= w - R - reach || qy >= h - R - reach) return "too near the border to match";
  const stat = (src: Float32Array, ox: number, oy: number) => {
    let [sum, sq] = [0, 0];
    for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { const v = src[(oy + y) * w + ox + x]!; sum += v; sq += v * v; }
    const n = (R + 1) ** 2;
    return [sum / n, Math.sqrt(Math.max(1e-6, sq / n - (sum / n) ** 2))] as const;
  };
  const [rm, rs] = stat(refL!, qx, qy);
  if (rs < 1.5) return "reference is flat here, nothing to match";
  let best = [-2, 0, 0];
  for (let dy = -reach; dy <= reach; dy += 2) {
    for (let dx = -reach; dx <= reach; dx += 2) {
      const [m, sd] = stat(L, qx + dx, qy + dy);
      let cov = 0;
      for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) cov += (refL![(qy + y) * w + qx + x]! - rm) * (L[(qy + dy + y) * w + qx + dx + x]! - m);
      const fit = cov / (R + 1) ** 2 / (rs * sd);
      if (fit > best[0]!) best = [fit, dx, dy];
    }
  }
  return best[0]! < 0.5 ? `no match (fit ${best[0]!.toFixed(2)})` : `off by ${r1(best[1]! / scale)}, ${r1(best[2]! / scale)} (fit ${best[0]!.toFixed(2)})`;
}
if (flag("at")) {
  console.log(refL ? "\nat (x, y | color, lightness | reference color, lightness | how far the render has that spot from where the reference has it)" : "\nat (x, y | color | lightness)");
  for (const s of flag("at")!.split(";")) {
    const [ax, ay] = s.split(",").map(Number) as [number, number];
    const [qx, qy] = [Math.round((ax - cx) * scale), Math.round((ay - cy) * scale)];
    const i = qy * w + qx;
    if (qx < 0 || qy < 0 || qx >= w || qy >= h) console.log(`  ${ax}, ${ay} | outside`);
    else if (refL) console.log(`  ${ax}, ${ay} | ${hex(px, i)} ${r1(L[i]!)} | ${hex(refPx!, i)} ${r1(refL[i]!)} | ${moved(qx, qy)}`);
    else console.log(`  ${ax}, ${ay} | ${hex(px, i)} | ${r1(L[i]!)}`);
  }
}

// The picture under a grid of logical units, beside its edges.
const out = createCanvas(w * 2 + 10, h);
const g = out.getContext("2d");
g.fillStyle = "#808080";
g.fillRect(0, 0, out.width, out.height);
g.drawImage(flat, x0, y0, w, h, 0, 0, w, h);
const em = g.createImageData(w, h);
for (let i = 0; i < E.length; i++) {
  const v = 255 - Math.min(255, E[i]! * 30);
  em.data[i * 4] = em.data[i * 4 + 1] = em.data[i * 4 + 2] = v;
  em.data[i * 4 + 3] = 255;
}
g.putImageData(em, w + 10, 0);
const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => Math.max(cw, ch) / s <= 12) ?? 1000;
g.font = "13px Menlo, monospace";
const tag = (s: string, x: number, y: number) => {
  g.fillStyle = "rgba(255,255,255,0.82)";
  g.fillRect(x, y, s.length * 8 + 6, 16);
  g.fillStyle = "#0044cc";
  g.fillText(s, x + 3, y + 12);
};
for (let x = Math.ceil(cx / step) * step; x < cx + cw; x += step) {
  g.fillStyle = "rgba(0,90,255,0.4)";
  g.fillRect((x - cx) * scale, 0, 1, h);
  tag(String(x), (x - cx) * scale + 2, 2);
}
for (let y = Math.ceil(cy / step) * step; y < cy + ch; y += step) {
  g.fillStyle = "rgba(0,90,255,0.4)";
  g.fillRect(0, (y - cy) * scale, w, 1);
  tag(String(y), 2, (y - cy) * scale + 2);
}
const file = resolve(root, "out", `${id}-measure.png`);
await Bun.write(file, out.toBuffer("image/png"));
console.log(`\n${file}`);
