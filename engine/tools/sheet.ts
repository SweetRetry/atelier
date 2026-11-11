// bun engine/sheet.ts <out.png> <a.png> <b.png> ...   Tile images side by side to compare variants in one look.
import { createCanvas, loadImage } from "@napi-rs/canvas";
const [out, ...files] = process.argv.slice(2);
const imgs = await Promise.all(files.map((f) => loadImage(f)));
const cols = Math.ceil(Math.sqrt(imgs.length));
const rows = Math.ceil(imgs.length / cols);
const w = Math.max(...imgs.map((i) => i.width));
const h = Math.max(...imgs.map((i) => i.height));
const c = createCanvas(cols * w, rows * h);
const g = c.getContext("2d");
imgs.forEach((im, i) => g.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h));
await Bun.write(out!, c.toBuffer("image/png"));
console.log(out);
