// bun paint <work> [--full] [--scale n] [--seed n] [--crop x,y,w,h] [--only a,b] [--out file] [--gray] [--t 0..1] [--frames n]
// --gray shows lightness only, to judge whether the picture holds together by value before color.
// --frames renders an animation as numbered PNGs into out/<work>-frames/. The work reads p.time.
// Preview fits the long edge to 1400px. --crop is in logical units and renders that region at 1400px.
import { createCanvas } from "@napi-rs/canvas";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Meta, Painting } from "../index.ts";

const PREVIEW = 1400;
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? undefined : (args[i + 1] ?? "");
};
if (!name) {
  console.error("usage: bun paint <work> [--full] [--scale n] [--seed n] [--crop x,y,w,h] [--only a,b] [--out file]");
  process.exit(1);
}

const root = resolve(import.meta.dir, "../..");
const id = name.replace(/^works\//, "").replace(/\.ts$/, "");
const file = resolve(root, "works", `${id}.ts`);
if (!existsSync(file)) {
  console.error(`no such work: ${file}`);
  process.exit(1);
}

const mod = (await import(file)) as { meta: Meta; default: (p: Painting) => void | Promise<void> };
const { width, height } = mod.meta;
const seed = flag("seed") ? Number(flag("seed")) : mod.meta.seed;
const crop = flag("crop")?.split(",").map(Number);
const long = crop ? Math.max(crop[2]!, crop[3]!) : Math.max(width, height);
const scale = args.includes("--full") ? 1 : flag("scale") ? Number(flag("scale")) : PREVIEW / long;

const frames = flag("frames") ? Number(flag("frames")) : 0;
if (frames) {
  const dir = resolve(root, "out", `${id}-frames`);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    const fp = new Painting(width, height, seed, scale, i / Math.max(1, frames - 1));
    await mod.default(fp);
    await Bun.write(resolve(dir, `${String(i + 1).padStart(4, "0")}.png`), fp.flatten().toBuffer("image/png"));
  }
  console.log(`${dir}\n${frames} frames. To assemble: ffmpeg -framerate 24 -i ${dir}/%04d.png -pix_fmt yuv420p out.mp4`);
  process.exit(0);
}

const t0 = performance.now();
const p = new Painting(width, height, seed, scale, flag("t") ? Number(flag("t")) : 0);
await mod.default(p);
const t1 = performance.now();
let canvas = p.flatten(flag("only")?.split(","));
if (crop) {
  const [x, y, w, h] = crop.map((v) => Math.round(v * scale)) as [number, number, number, number];
  const c = createCanvas(w, h);
  c.getContext("2d").drawImage(canvas, -x, -y);
  canvas = c;
}
if (args.includes("--gray")) {
  const g = canvas.getContext("2d");
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
}
const t2 = performance.now();

const tag = [
  args.includes("--full") ? "@full" : "",
  flag("seed") ? `-s${seed}` : "",
  crop ? "-crop" : "",
  flag("only") ? `-${flag("only")}` : "",
  args.includes("--gray") ? "-gray" : "",
].join("");
const out = flag("out") ? resolve(flag("out")!) : resolve(root, "out", `${id}${tag}.png`);
mkdirSync(dirname(out), { recursive: true });
await Bun.write(out, canvas.toBuffer("image/png"));
const ms = (a: number, b: number) => `${Math.round(b - a)}ms`;
console.log(
  `${out}\n${canvas.width}x${canvas.height} seed ${seed} | paint ${ms(t0, t1)} | flatten ${ms(t1, t2)} | encode ${ms(t2, performance.now())} | layers: ${p.layers.map((l) => l.name).join(", ")}`,
);
