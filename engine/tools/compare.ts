// bun compare <work> <reference image> [--crop fx,fy,fw,fh] [--height 700]
// Puts the reference and the latest preview of a work side by side, in color and in gray, at one size.
// --crop is in fractions of the image (0..1), so the same region is cut from both.
import { type Canvas, createCanvas, loadImage } from "@napi-rs/canvas";
const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? undefined : args[i + 1];
};
const [work, refFile] = args;
if (!work || !refFile) throw new Error("usage: bun compare <work> <reference image> [--crop fx,fy,fw,fh] [--height 700]");
const H = Number(flag("height") ?? 700);
const [fx, fy, fw, fh] = (flag("crop") ?? "0,0,1,1").split(",").map(Number) as [number, number, number, number];

async function panel(file: string): Promise<Canvas> {
  const im = await loadImage(file);
  const sw = im.width * fw;
  const sh = im.height * fh;
  const c = createCanvas(Math.round((H * sw) / sh), H);
  c.getContext("2d").drawImage(im, im.width * fx, im.height * fy, sw, sh, 0, 0, c.width, H);
  return c;
}
function gray(src: Canvas): Canvas {
  const c = createCanvas(src.width, src.height);
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]!;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const ref = await panel(refFile);
const mine = await panel(`out/${work}.png`);
const gap = 12;
const out = createCanvas(ref.width + mine.width + gap, H * 2 + gap);
const g = out.getContext("2d");
g.fillStyle = "#808080";
g.fillRect(0, 0, out.width, out.height);
g.drawImage(ref, 0, 0);
g.drawImage(mine, ref.width + gap, 0);
g.drawImage(gray(ref), 0, H + gap);
g.drawImage(gray(mine), ref.width + gap, H + gap);
// Two measured numbers for the region shown. They rank renders of one work against each other. They do not replace looking.
// match: 100 minus the mean absolute difference per channel, in percent of full range. Blind to where the difference is.
// ssim: structural similarity of lightness over 8x8 blocks, 1 is identical. Sensitive to line and texture.
if (ref.width === mine.width) {
  const a = ref.getContext("2d").getImageData(0, 0, ref.width, H).data;
  const b = mine.getContext("2d").getImageData(0, 0, ref.width, H).data;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
  const lum = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
  let ssim = 0;
  let blocks = 0;
  for (let y = 0; y + 8 <= H; y += 8) {
    for (let x = 0; x + 8 <= ref.width; x += 8) {
      let [ma, mb, saa, sbb, sab] = [0, 0, 0, 0, 0];
      for (let j = 0; j < 8; j++) {
        for (let k = 0; k < 8; k++) {
          const i = ((y + j) * ref.width + x + k) * 4;
          const [u, v] = [lum(a, i), lum(b, i)];
          ma += u;
          mb += v;
          saa += u * u;
          sbb += v * v;
          sab += u * v;
        }
      }
      ma /= 64;
      mb /= 64;
      const [va, vb, cov] = [saa / 64 - ma * ma, sbb / 64 - mb * mb, sab / 64 - ma * mb];
      ssim += ((2 * ma * mb + 6.5) * (2 * cov + 58.5)) / ((ma * ma + mb * mb + 6.5) * (va + vb + 58.5));
      blocks++;
    }
  }
  console.log(`match ${(100 - (diff / (a.length * 0.75) / 255) * 100).toFixed(1)}%  ssim ${(ssim / blocks).toFixed(3)}  (measured on the ${ref.width}x${H} panels)`);
}
const file = `out/${work}-compare.png`;
await Bun.write(file, out.toBuffer("image/png"));
console.log(file);
