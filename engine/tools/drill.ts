// Tools for drawing drills: copying a reference by hand and being scored on it.
//
// bun drill grid <image> [--crop x,y,w,h] [--step n]
//   A magnified crop of the image under a labelled coordinate grid, in image pixels. For reading where things are.
// bun drill score <work> <image> [--crop x,y,w,h]
//   Lays the dark lines of out/<work>.png over the image and scores them against the edges found in the image.
//   A line pixel is right when an edge of the reference lies within 3 reference pixels. Right is drawn green, wrong red.
//   Prints precision (share of drawn line that is right) and the mean distance to the nearest edge.
//   It scores only what was drawn. It does not know what was left out.
//   The share of the reference covered by edges is printed too. A line dropped at random scores about
//   that share widened by 3px each side, so read precision against it.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { boxBlur } from "../core/field.ts";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? undefined : args[i + 1];
};
const mode = args[0];

if (mode === "grid") {
  const im = await loadImage(args[1]!);
  const [cx, cy, cw, ch] = (flag("crop") ?? `0,0,${im.width},${im.height}`).split(",").map(Number) as [number, number, number, number];
  const k = 1400 / Math.max(cw, ch);
  const step = Number(flag("step") ?? Math.max(10, Math.round(Math.max(cw, ch) / 14 / 10) * 10));
  const c = createCanvas(Math.round(cw * k), Math.round(ch * k));
  const g = c.getContext("2d");
  g.drawImage(im, cx, cy, cw, ch, 0, 0, c.width, c.height);
  g.font = "15px Menlo, monospace";
  for (let x = Math.ceil(cx / step) * step; x < cx + cw; x += step) {
    g.fillStyle = "rgba(0,90,255,0.45)";
    g.fillRect((x - cx) * k, 0, 1, c.height);
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillRect((x - cx) * k + 2, 2, 38, 18);
    g.fillStyle = "#0044cc";
    g.fillText(String(x), (x - cx) * k + 4, 16);
  }
  for (let y = Math.ceil(cy / step) * step; y < cy + ch; y += step) {
    g.fillStyle = "rgba(0,90,255,0.45)";
    g.fillRect(0, (y - cy) * k, c.width, 1);
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillRect(2, (y - cy) * k + 2, 38, 18);
    g.fillStyle = "#0044cc";
    g.fillText(String(y), 4, (y - cy) * k + 16);
  }
  await Bun.write("out/drill-grid.png", c.toBuffer("image/png"));
  console.log(`out/drill-grid.png  step ${step}`);
} else if (mode === "score") {
  const ref = await loadImage(args[2]!);
  const mine = await loadImage(`out/${args[1]}.png`);
  const [w, h] = [ref.width, ref.height];
  const data = (im: typeof ref) => {
    const c = createCanvas(w, h);
    const g = c.getContext("2d");
    g.drawImage(im, 0, 0, w, h);
    return g.getImageData(0, 0, w, h).data;
  };
  const [rd, md] = [data(ref), data(mine)];
  const lum = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!) / 255;
  // Edges of the reference. Each channel is blurred first so paper grain and brush texture do not count as edges,
  // then the strongest channel gradient is taken, so that a warm line on warm skin still counts.
  const chans = [0, 1, 2].map((c) => {
    let f: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) f[i] = rd[i * 4 + c]!;
    for (let k = 0; k < 2; k++) f = boxBlur(f, w, h, 2);
    return f;
  });
  const edge = new Uint8Array(w * h);
  let edges = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      let m = 0;
      for (const f of chans) m = Math.max(m, Math.hypot(f[i + 2]! - f[i - 2]!, f[i + 2 * w]! - f[i - 2 * w]!));
      if (m > 22) {
        edge[i] = 1;
        edges++;
      }
    }
  }
  // Distance to the nearest edge, two-pass chamfer.
  const dist = new Float32Array(w * h).fill(1e6);
  for (let i = 0; i < w * h; i++) if (edge[i]) dist[i] = 0;
  const relax = (i: number, j: number, c: number) => {
    if (dist[j]! + c < dist[i]!) dist[i] = dist[j]! + c;
  };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    relax(i, i - 1, 1); relax(i, i - w, 1); relax(i, i - w - 1, 1.414); relax(i, i - w + 1, 1.414);
  }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) {
    const i = y * w + x;
    relax(i, i + 1, 1); relax(i, i + w, 1); relax(i, i + w + 1, 1.414); relax(i, i + w - 1, 1.414);
  }
  const [cx, cy, cw, ch] = (flag("crop") ?? `0,0,${w},${h}`).split(",").map(Number) as [number, number, number, number];
  const out = createCanvas(w, h);
  const g = out.getContext("2d");
  const img = g.createImageData(w, h);
  let [n, ok, sum] = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const drawn = lum(md, i) < 0.62;
    const o = i * 4;
    if (drawn) {
      const x = i % w;
      const y = (i / w) | 0;
      const d = dist[i]!;
      if (x >= cx && x < cx + cw && y >= cy && y < cy + ch) {
        n++;
        sum += Math.min(d, 40);
        if (d <= 3) ok++;
      }
      img.data.set(d <= 3 ? [0, 150, 60, 255] : [230, 30, 30, 255], o);
    } else {
      for (let c = 0; c < 3; c++) img.data[o + c] = 255 - (255 - rd[o + c]!) * 0.5;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const k = 1400 / Math.max(cw, ch);
  const view = createCanvas(Math.round(cw * k), Math.round(ch * k));
  view.getContext("2d").drawImage(out, cx, cy, cw, ch, 0, 0, view.width, view.height);
  await Bun.write(`out/${args[1]}-score.png`, view.toBuffer("image/png"));
  console.log(`precision ${((ok / Math.max(1, n)) * 100).toFixed(1)}%  mean distance ${(sum / Math.max(1, n)).toFixed(2)}px  line pixels ${n}  edges cover ${((edges / (w * h)) * 100).toFixed(0)}% of the reference  (measured at ${w}x${h})\nout/${args[1]}-score.png`);
} else {
  console.error("usage: bun drill grid <image> [--crop x,y,w,h] [--step n] | bun drill score <work> <image> [--crop x,y,w,h]");
  process.exit(1);
}
