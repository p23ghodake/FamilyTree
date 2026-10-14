import { PosterNode } from '../../processing/posterLayout';

export type Point = { x: number; y: number };
export type LeafShape = 'oak' | 'round';

export const PAPER = '#f8f1e4';
export const BARK_DARK = '#4a3529';
export const BARK_LIGHT = '#735641';
// Faded autumn browns and rust, with soft olive green, gold and orange.
export const LEAF_COLORS = ['#a7744a', '#8e6040', '#b8683f', '#7d5a3d', '#8f9a5b', '#a8ad6e', '#d9b85a', '#e6cc7f', '#d08a4e', '#c9763f'];

const LEAF_SHAPES: LeafShape[] = ['oak', 'oak', 'round'];
const LEAF_SIZE = 16;
const LEAVES_PER_TWIG: [number, number] = [10, 15];
const TWIG_SPACING = 40;
const MAX_TWIGS_PER_LIMB = 6;
const TWIG_WIDTH = 2.8;
const TRUNK_K = 9;
const MAX_LIMB = 80;
const FLARE = 1.9;
const TAPER = 0.35;
const BEND = 0.24;

export interface LeafArt {
  x: number;
  y: number;
  angle: number;
  size: number;
  color: string;
  shape: LeafShape;
  opacity: number;
}

export interface PosterArt {
  /** Tapered limbs, filled with the bark gradient. */
  wood: string[];
  /** Bark grain lines on the trunk. */
  texture: string[];
  twigs: string[];
  leaves: LeafArt[];
  fallen: LeafArt[];
  drifting: LeafArt[];
  ground: { cx: number; cy: number; rx: number };
}

export interface PosterArtInput {
  nodes: PosterNode[];
  focusDepth: number;
  posOf: (n: PosterNode) => Point;
  /** Card height of a node; 0 for forks, which are bare branch points. */
  cardH: (n: PosterNode) => number;
  groundY: number;
  trunkH: number;
  /** Grows leaves and twigs on large posters so they stay in proportion. */
  scale: number;
  minX: number;
  maxX: number;
}

const fmt = (n: number) => n.toFixed(1);

function outline(half: (x: number) => number, steps = 22): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const h = half(x);
    top.push(`${x.toFixed(3)},${(-h).toFixed(3)}`);
    bottom.push(`${x.toFixed(3)},${h.toFixed(3)}`);
  }
  return `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
}

/** Unit-length leaf outlines pointing along +x with the stem at 0,0. */
export const LEAF_PATHS: Record<LeafShape, string> = {
  oak: outline(x => Math.sin(Math.PI * x) * (0.19 + 0.11 * Math.abs(Math.sin(4.5 * Math.PI * x))), 48),
  round: outline(x => 0.4 * Math.max(0, Math.sin(Math.PI * x ** 0.8)) ** 0.7),
};

/** Deterministic random numbers so the tree looks the same on screen, in exports and in print. */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Curve = [Point, Point, Point, Point];

function bez([p0, p1, p2, p3]: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function bezD([p0, p1, p2, p3]: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

const widthAt = (w0: number, w1: number, ease: number, t: number) => w0 + (w1 - w0) * t ** ease;

/** Filled outline of a curve that narrows from width w0 to w1. */
export function taperPath(curve: Curve, w0: number, w1: number, ease = 1): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const p = bez(curve, t);
    const d = bezD(curve, t);
    const len = Math.hypot(d.x, d.y) || 1;
    const nx = -d.y / len;
    const ny = d.x / len;
    const w = widthAt(w0, w1, ease, t) / 2;
    left.push(`${fmt(p.x + nx * w)},${fmt(p.y + ny * w)}`);
    right.push(`${fmt(p.x - nx * w)},${fmt(p.y - ny * w)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

function grainLine(curve: Curve, w0: number, w1: number, ease: number, offset: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = 0.05 + 0.9 * (i / 20);
    const p = bez(curve, t);
    const d = bezD(curve, t);
    const len = Math.hypot(d.x, d.y) || 1;
    const w = (widthAt(w0, w1, ease, t) / 2) * offset;
    pts.push(`${fmt(p.x - (d.y / len) * w)},${fmt(p.y + (d.x / len) * w)}`);
  }
  return `M${pts.join('L')}`;
}

function scatterLeaf(rand: () => number, x: number, y: number, size: number, opacity: number): LeafArt {
  return {
    x, y, angle: rand() * 360, size,
    color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
    shape: LEAF_SHAPES[Math.floor(rand() * LEAF_SHAPES.length)],
    opacity,
  };
}

/** A small tapered twig carrying 10–15 leaves of varying size. */
function twig(rand: () => number, x: number, y: number, angleDeg: number, length: number, scale: number, art: PosterArt) {
  const leafSize = LEAF_SIZE * scale;
  const [lo, hi] = LEAVES_PER_TWIG;
  const count = lo + Math.floor(rand() * (hi - lo + 1));
  const len = Math.max(length, count * leafSize * 0.34);
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const bend = (rand() - 0.5) * len * 0.35;
  const curve: Curve = [
    { x, y },
    { x: x + dx * len * 0.35 - dy * bend, y: y + dy * len * 0.35 + dx * bend },
    { x: x + dx * len * 0.7 - dy * bend * 0.6, y: y + dy * len * 0.7 + dx * bend * 0.6 },
    { x: x + dx * len, y: y + dy * len },
  ];
  art.twigs.push(taperPath(curve, TWIG_WIDTH * Math.sqrt(scale), 0.45));
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    const t = last ? 1 : 0.22 + 0.72 * (i / (count - 1));
    const p = bez(curve, t);
    const d = bezD(curve, t);
    const along = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    art.leaves.push({
      x: p.x,
      y: p.y,
      angle: last ? along + (rand() - 0.5) * 20 : along + (i % 2 ? 1 : -1) * (30 + rand() * 30),
      size: leafSize * (0.55 + rand() * 0.6) * (0.75 + 0.35 * t),
      color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
      shape: LEAF_SHAPES[Math.floor(rand() * LEAF_SHAPES.length)],
      opacity: 0.78 + rand() * 0.2,
    });
  }
}

/** Trunk, tapering limbs, leafy twigs and fallen leaves around an already laid-out poster. */
export function buildPosterArt({ nodes, focusDepth, posOf, cardH, groundY, trunkH, scale, minX, maxX }: PosterArtInput): PosterArt {
  const art: PosterArt = { wood: [], texture: [], twigs: [], leaves: [], fallen: [], drifting: [], ground: { cx: 0, cy: 0, rx: 0 } };
  if (nodes.length === 0) return art;
  // How far a limb reaches into a card from its edge.
  const inset = (n: PosterNode) => (cardH(n) ? cardH(n) / 2 - 6 : 0);

  const rand = rng(`${nodes[0].id}:${nodes.length}`);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const kids = new Map<string, PosterNode[]>();
  nodes.forEach(n => { if (n.stemId) kids.set(n.stemId, [...(kids.get(n.stemId) ?? []), n]); });
  const weight = new Map<string, number>();
  const weightOf = (n: PosterNode): number => {
    if (!weight.has(n.id)) weight.set(n.id, (n.kind === 'fork' ? 0 : 1) + (kids.get(n.id) ?? []).reduce((sum, c) => sum + weightOf(c), 0));
    return weight.get(n.id)!;
  };
  // Pipe model: a limb's cross-section grows with the number of people it carries.
  const widthOf = (n: PosterNode) => Math.min(MAX_LIMB, Math.max(2.4, TRUNK_K * Math.sqrt(weightOf(n))));

  // Trunk below the oldest ancestor, flaring into roots
  const base = posOf(nodes[0]);
  const top = widthOf(nodes[0]);
  const flare = top * FLARE;
  const trunk: Curve = [
    { x: base.x - top * 0.25, y: groundY + 4 },
    { x: base.x - 5, y: groundY - trunkH * 0.45 },
    { x: base.x + 4, y: base.y + trunkH * 0.3 },
    { x: base.x, y: base.y + inset(nodes[0]) },
  ];
  art.ground = { cx: base.x, cy: groundY + 8, rx: flare * 3.2 + 60 };
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    const sx = base.x + dir * flare * (0.15 + rand() * 0.3);
    const ex = sx + dir * (flare * 0.9 + rand() * 50);
    const ey = groundY + 6 + rand() * 10;
    art.wood.push(taperPath(
      [{ x: sx, y: groundY - 2 }, { x: sx + (ex - sx) * 0.3, y: groundY }, { x: sx + (ex - sx) * 0.7, y: ey - 3 }, { x: ex, y: ey }],
      flare * 0.32, 1, 0.7,
    ));
  }
  art.wood.push(taperPath(trunk, flare, top, 0.45));
  [-0.45, 0.1, 0.5].forEach(o => art.texture.push(grainLine(trunk, flare, top, 0.45, o)));

  // Limbs, thickest first so thinner ones sit on top
  const limbs = nodes.filter(n => n.stemId).map(n => {
    const stem = byId.get(n.stemId!)!;
    const from = posOf(stem);
    const to = posOf(n);
    const p0 = { x: from.x, y: from.y - inset(stem) };
    const p3 = { x: to.x, y: to.y + inset(n) };
    const dx = p3.x - p0.x;
    const dy = p0.y - p3.y;
    const curve: Curve = [p0, { x: p0.x + dx * BEND, y: p0.y - dy * 0.5 }, { x: p3.x - dx * 0.06, y: p3.y + dy * 0.38 }, p3];
    const onTrunk = n.depth <= focusDepth;
    const w0 = onTrunk ? Math.max(widthOf(n), widthOf(byId.get(n.stemId!)!) * 0.96) : widthOf(n);
    const w1 = onTrunk ? widthOf(n) : Math.max(1.6, widthOf(n) * TAPER);
    return { curve, w0, w1, onTrunk, length: Math.hypot(dx, dy) * 1.1 };
  }).sort((a, b) => b.w0 - a.w0);

  limbs.forEach(({ curve, w0, w1, onTrunk, length }) => {
    art.wood.push(taperPath(curve, w0, w1, 0.85));
    if (onTrunk) {
      [-0.4, 0.3].forEach(o => art.texture.push(grainLine(curve, w0, w1, 0.85, o)));
      return;
    }
    const count = Math.min(MAX_TWIGS_PER_LIMB, Math.max(1, Math.round(length / (TWIG_SPACING * scale))));
    let side = rand() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const t = Math.min(0.92, 0.28 + (0.64 * (i + 0.5)) / count + (rand() - 0.5) * 0.08);
      const p = bez(curve, t);
      const d = bezD(curve, t);
      const len = Math.hypot(d.x, d.y) || 1;
      const half = widthAt(w0, w1, 0.85, t) / 2;
      const along = (Math.atan2(d.y, d.x) * 180) / Math.PI;
      const x = p.x - (d.y / len) * half * side * 0.8;
      const y = p.y + (d.x / len) * half * side * 0.8;
      twig(rand, x, y, along - side * (35 + rand() * 30), LEAF_SIZE * scale * (1.5 + rand() * 1.3), scale, art);
      side = -side;
    }
  });

  // Leafy sprigs above the outermost names
  nodes.filter(n => n.depth >= focusDepth && !kids.has(n.id)).forEach(n => {
    const { x, y } = posOf(n);
    const crown = y - cardH(n) / 2 + 2;
    [-38, 0, 38].forEach(off =>
      twig(rand, x + off * 0.15, crown, -90 + off + (rand() - 0.5) * 14, LEAF_SIZE * scale * (1.9 + rand() * 1.1), scale, art));
  });

  // Fallen leaves around the roots and a few drifting down
  const spread = Math.min((maxX - minX) * 0.25, 350);
  for (let i = 0; i < 24; i++) {
    art.fallen.push(scatterLeaf(rand, base.x + (rand() - 0.5) * 2 * spread, groundY + rand() * 14 - 2, LEAF_SIZE * scale * (0.6 + rand() * 0.5), 0.75));
  }
  const focusY = posOf(nodes.find(n => n.depth === focusDepth) ?? nodes[0]).y;
  for (let i = 0; i < 8; i++) {
    art.drifting.push(scatterLeaf(rand, minX + rand() * (maxX - minX), focusY - rand() * trunkH, LEAF_SIZE * scale * (0.6 + rand() * 0.4), 0.55));
  }
  return art;
}
