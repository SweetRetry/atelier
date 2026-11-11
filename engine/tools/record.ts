// bun record <work> [--seconds 9] [--hold 2.5] [--width 1080] [--fps 30] [--seed n] [--out file.mp4]
// Records the painting being made, mark by mark, as an mp4. Needs ffmpeg on the PATH.
// The work runs twice. The first run counts how much work there is. The second takes a snapshot each time
// another 1/N of it is done, so the video moves at an even pace from blank sheet to finished painting.
// Only canvas layers report progress, so wet and watercolor layers appear in steps.
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Meta, Painting } from "../index.ts";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (k: string, d: number) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : Number(args[i + 1]);
};
if (!name) {
  console.error("usage: bun record <work> [--seconds 9] [--hold 2.5] [--width 1080] [--fps 30] [--seed n] [--out file.mp4]");
  process.exit(1);
}
const root = resolve(import.meta.dir, "../..");
const id = name.replace(/^works\//, "").replace(/\.ts$/, "");
const mod = (await import(resolve(root, "works", `${id}.ts`))) as { meta: Meta; default: (p: Painting) => void | Promise<void> };
const { width, height } = mod.meta;
const seed = flag("seed", mod.meta.seed);
const fps = flag("fps", 30);
const even = (v: number) => Math.round(v / 2) * 2; // h264 needs even dimensions
const outW = even(flag("width", 1080));
const outH = even((outW * height) / width);
const scale = outW / width;
const N = Math.round(flag("seconds", 9) * fps);
const FADE = Math.round(fps * 0.6);
const HOLD = Math.round(flag("hold", 2.5) * fps);

// Pass 1: how much work is there in total.
let total = 0;
const probe = new Painting(width, height, seed, 0.08);
probe.onTick = (w) => (total += w);
await mod.default(probe);

// Pass 2: paint again and take a frame at each even step.
const dir = resolve(root, "out", `${id}-rec`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let n = 0;
const frame = createCanvas(outW, outH);
const fctx = frame.getContext("2d");
const lay = (c: Canvas, alpha = 1) => {
  fctx.globalAlpha = alpha;
  fctx.drawImage(c, 0, 0, outW, outH);
};
const write = (c: Canvas) => {
  lay(c);
  writeFileSync(resolve(dir, `${String(++n).padStart(5, "0")}.jpg`), frame.toBuffer("image/jpeg", 95));
};
const p = new Painting(width, height, seed, scale);
let done = 0;
let due = total / N;
p.onTick = (w) => {
  done += w;
  if (done < due || n >= N) return;
  const shot = p.composite();
  while (done >= due && n < N) {
    write(shot);
    due += total / N;
  }
};
write(p.composite()); // the blank sheet
await mod.default(p);
// Finishing effects such as grain and vignette arrive as a short fade, then the finished painting holds.
const last = p.composite();
const final = p.flatten();
for (let i = 1; i <= FADE; i++) {
  lay(last);
  lay(final, i / FADE);
  writeFileSync(resolve(dir, `${String(++n).padStart(5, "0")}.jpg`), frame.toBuffer("image/jpeg", 95));
}
for (let i = 0; i < HOLD; i++) write(final);

const outFlag = args.indexOf("--out");
const out = outFlag >= 0 ? resolve(args[outFlag + 1]!) : resolve(root, "out", `${id}.mp4`);
const ff = Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-framerate", String(fps), "-i", resolve(dir, "%05d.jpg"), "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-color_range", "tv", "-c:v", "libx264", "-crf", "17", "-movflags", "+faststart", out]);
if (ff.exitCode !== 0) {
  console.error(ff.stderr.toString());
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
if (!existsSync(out)) throw new Error("ffmpeg produced no file");
console.log(`${out}\n${outW}x${outH} ${fps}fps ${n} frames ${(n / fps).toFixed(1)}s`);
