// bun verify            Render every work small and compare its pixels with the recorded baseline.
// bun verify --update   Record the current renders as the baseline.
// Rendering is deterministic, so any difference means the engine changed what a painting looks like.
// Run it before and after touching the engine. A refactor must report every work as "same".
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Meta, Painting } from "../index.ts";

const root = resolve(import.meta.dir, "../..");
const file = resolve(root, "works/baseline.json");
const base: Record<string, string> = existsSync(file) ? await Bun.file(file).json() : {};
const now: Record<string, string> = {};
let changed = 0;
for (const f of readdirSync(resolve(root, "works")).filter((n) => n.endsWith(".ts")).sort()) {
  const id = f.replace(/\.ts$/, "");
  const t0 = performance.now();
  try {
    const mod = (await import(resolve(root, "works", f))) as { meta: Meta; default: (p: Painting) => void | Promise<void> };
    const { width, height, seed } = mod.meta;
    const p = new Painting(width, height, seed, 360 / Math.max(width, height));
    await mod.default(p);
    const c = p.flatten();
    now[id] = Bun.hash(c.getContext("2d").getImageData(0, 0, c.width, c.height).data).toString(16);
  } catch (e) {
    now[id] = `error: ${(e as Error).message}`;
  }
  const state = !(id in base) ? "new" : base[id] === now[id] ? "same" : "CHANGED";
  if (state === "CHANGED") changed++;
  console.log(`${state.padEnd(8)} ${id.padEnd(28)} ${Math.round(performance.now() - t0)}ms${now[id]!.startsWith("error") ? `  ${now[id]}` : ""}`);
}
if (process.argv.includes("--update")) {
  await Bun.write(file, `${JSON.stringify(now, null, 2)}\n`);
  console.log(`baseline written: ${Object.keys(now).length} works`);
} else if (changed) {
  console.log(`${changed} changed. Look at them. If the change is intended, run: bun verify --update`);
  process.exit(1);
}
