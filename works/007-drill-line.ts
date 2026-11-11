// 练习一 · 徒手临线 / Drill 1: copying line by hand
// A drill, not a picture. The face of refs/006-design.png is redrawn as named curves whose coordinates were read
// off a grid by eye and typed in. Nothing is sampled from the reference. `bun drill score` says how much of the line is right.
// Coordinates are the reference's own pixels (1024 x 1824).
import { type Meta, type Painting, type Pt } from "../engine/index.ts";

export const meta: Meta = { width: 1024, height: 1824, seed: 1 };

/** Each curve is named for what it is, so the numbers can be reused as a vocabulary later. */
export const CURVES: Record<string, Pt[]> = {
  // near eye (her right, image left)
  nearLash: [[300, 783], [360, 768], [420, 758], [480, 752], [540, 750], [590, 752]],
  nearLower: [[300, 790], [340, 822], [400, 840], [470, 838], [540, 815], [580, 790]],
  nearCrease: [[330, 730], [430, 712], [520, 705], [590, 722]],
  nearIris: [[400, 795], [415, 830], [455, 848], [495, 835], [512, 795], [500, 770]],
  nearBrow: [[310, 650], [400, 630], [500, 620], [620, 626], [720, 642]],
  // far eye
  farLash: [[800, 785], [830, 745], [870, 715], [910, 698], [940, 690]],
  farLower: [[800, 785], [850, 800], [890, 800], [925, 770]],
  farIris: [[848, 760], [860, 790], [885, 798], [912, 780], [915, 745]],
  farBrow: [[830, 640], [900, 605], [960, 580], [1000, 570]],
  // nose and mouth
  nostril: [[682, 1042], [700, 1036], [718, 1040]],
  noseTip: [[800, 1050], [822, 1036], [838, 1020]],
  mouth: [[590, 1183], [640, 1172], [700, 1163], [760, 1150], [790, 1142]],
  lipTop: [[600, 1180], [680, 1140], [735, 1125], [765, 1135], [800, 1140]],
  lipBottom: [[610, 1200], [660, 1225], [720, 1228], [770, 1205], [790, 1170]],
  // jaw and neck
  jawNear: [[380, 1270], [440, 1300], [520, 1340], [600, 1368], [640, 1378]],
  jawFar: [[640, 1378], [700, 1340], [760, 1280], [800, 1230]],
  neck: [[655, 1380], [660, 1450]],
  // two loose strands on the cheek
  strandA: [[385, 955], [460, 978], [540, 1000]],
  strandB: [[390, 1010], [450, 1070], [560, 1097]],
};

export default function paint(p: Painting) {
  p.background = "#ffffff";
  const L = p.layer("line");
  for (const pts of Object.values(CURVES)) L.stroke("ink", pts, { color: "#222", size: 3, thinning: 0 });
}
