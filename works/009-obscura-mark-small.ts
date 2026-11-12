// 暗箱 · Obscura, the mark at favicon size
// The same ring and light as 009, drawn heavier so they survive 16 and 32 pixels.
// Focal point: the light. Rendered at 1024 and scaled down, never viewed at full size.
import { grain, type Meta, type Painting } from "../engine/index.ts";
import { mark, ROOM, ROOM_LOW } from "./008-obscura-mark.ts";

export const meta: Meta = { width: 1024, height: 1024, seed: 2 };

export default function paint(p: Painting) {
  p.background = ROOM;
  p.layer("room").vgrad([ROOM, ROOM_LOW]);
  mark(p, 512, 512, 470, 1.9);
  p.post(grain(0.02));
}
