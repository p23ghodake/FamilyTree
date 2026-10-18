import { PosterNode } from '../../processing/posterLayout';

export type Point = { x: number; y: number };
export type LeafShape = 'oak' | 'round' | 'banyan' | 'blossom';
export type PosterTheme = 'autumn' | 'spring' | 'summer' | 'banyan';

export const PAPER = '#f8f1e4';
export const BARK_DARK = '#4a3529';
export const BARK_MID = '#5f4535';
export const BARK_LIGHT = '#8a6a50';
export const SOIL = '#7a5a41';
/** Light falls from the upper left; shadows fall to the lower right by this offset. */
export const LIGHT = { x: -0.55, y: -0.835 };
export const SHADOW_OFFSET = { x: 7, y: 9 };

export interface ThemeSpec {
  /** Leaves near the trunk and lower in the crown. */
  inner: string[];
  /** Leaves at the outer tips and the top of the crown. */
  outer: string[];
  shapes: LeafShape[];
  /** Occasional replacement for a leaf, e.g. spring blossom. */
  accent?: { shape: LeafShape; colors: string[]; chance: number };
  canopy: string;
  grass: string;
  fallen: { count: number; colors: string[]; shapes: LeafShape[] };
  drifting: number;
  aerialRoots: boolean;
}

export const THEMES: Record<PosterTheme, ThemeSpec> = {
  autumn: {
    inner: ['#7d8a4a', '#8f9a5b', '#a8ad6e', '#97904f'],
    outer: ['#a7744a', '#8e6040', '#b8683f', '#7d5a3d', '#d9b85a', '#e6cc7f', '#d08a4e', '#c9763f'],
    shapes: ['oak', 'oak', 'round'],
    canopy: '#b9905a',
    grass: '#8a8a4a',
    fallen: { count: 26, colors: ['#a7744a', '#b8683f', '#d9b85a', '#d08a4e', '#8e6040', '#c9763f'], shapes: ['oak', 'round'] },
    drifting: 9,
    aerialRoots: false,
  },
  spring: {
    inner: ['#5f8f3e', '#6fa04a', '#7fae55'],
    outer: ['#9cc46a', '#b4d47e', '#a7cf73', '#c4dd8f'],
    shapes: ['round', 'round', 'oak'],
    accent: { shape: 'blossom', colors: ['#f4b6c6', '#f7cdd8', '#fbe3e9', '#eea0b6'], chance: 0.42 },
    canopy: '#a9cf7e',
    grass: '#6f9f45',
    fallen: { count: 16, colors: ['#f4b6c6', '#f7cdd8', '#fbe3e9'], shapes: ['blossom'] },
    drifting: 10,
    aerialRoots: false,
  },
  summer: {
    inner: ['#2f5d2a', '#3b6b30', '#355f2c', '#456f35'],
    outer: ['#4f7f36', '#5e8f3c', '#6d9a42', '#7aa64a', '#8cb257'],
    shapes: ['oak', 'round', 'round'],
    canopy: '#5d8a44',
    grass: '#4f7f36',
    fallen: { count: 6, colors: ['#6d9a42', '#8cb257'], shapes: ['round'] },
    drifting: 3,
    aerialRoots: false,
  },
  banyan: {
    inner: ['#2c5228', '#355f2e', '#2f5a30', '#3d6a34'],
    outer: ['#4a7a38', '#58873f', '#6b9446', '#7d9f4c', '#a9a94f'],
    shapes: ['banyan'],
    accent: { shape: 'round', colors: ['#c0432f', '#d0573a', '#b33a2b'], chance: 0.05 },
    canopy: '#4f7c40',
    grass: '#5b8a3c',
    fallen: { count: 10, colors: ['#a9a94f', '#c9b75a', '#8a9a45'], shapes: ['banyan'] },
    drifting: 4,
    aerialRoots: true,
  },
};

export const POSTER_THEMES = Object.keys(THEMES) as PosterTheme[];

const LEAF_SIZE = 16;
const LEAVES_PER_TWIG: [number, number] = [10, 15];
const BACK_LEAF_SHARE = 0.3;
const TWIG_SPACING = 40;
const MAX_TWIGS_PER_LIMB = 6;
const TWIG_WIDTH = 2.8;
const TRUNK_K = 9;
const MAX_LIMB = 80;
const FLARE = 1.9;
const TAPER = 0.35;
const BEND = 0.24;
/** How much a side limb swells where it leaves its parent. */
const COLLAR = 0.2;

export interface LeafArt {
  x: number;
  y: number;
  angle: number;
  size: number;
  /** Width relative to length, below 1 for leaves seen edge-on. */
  squash: number;
  color: string;
  shape: LeafShape;
  opacity: number;
}

export interface WoodPiece {
  body: string;
  /** Darker half facing away from the light. */
  shade: string;
  /** Thin lit strip facing the light. */
  light: string;
  /** Broken bark cracks. */
  cracks: string;
  knots: Knot[];
}

export interface Knot { cx: number; cy: number; rx: number; ry: number; angle: number }

export interface PosterArt {
  /** Tapered limbs, thickest first. */
  wood: WoodPiece[];
  twigs: string[];
  /** Leaves behind the wood, already darkened for depth. */
  backLeaves: LeafArt[];
  leaves: LeafArt[];
  fallen: LeafArt[];
  drifting: LeafArt[];
  /** Soft foliage masses behind the branches that give the crown its outline. */
  canopy: { cx: number; cy: number; r: number }[];
  /** Hanging banyan roots. */
  aerialRoots: string[];
  ground: {
    cx: number;
    cy: number;
    rx: number;
    /** Soil mound the trunk grows out of. */
    mound: string;
    grass: string;
    pebbles: Knot[];
    /** Where hanging roots reach the ground. */
    footings: Point[];
  };
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
  theme?: PosterTheme;
}

const fmt = (n: number) => n.toFixed(1);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function outline(half: (x: number) => number, steps = 22): { body: string; upper: string } {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const h = half(x);
    top.push(`${x.toFixed(3)},${(-h).toFixed(3)}`);
    bottom.push(`${x.toFixed(3)},${h.toFixed(3)}`);
  }
  return { body: `M${top.join('L')}L${bottom.reverse().join('L')}Z`, upper: `M${top.join('L')}Z` };
}

const circle = (cx: number, cy: number, r: number) =>
  `M${(cx + r).toFixed(3)},${cy.toFixed(3)}a${r},${r} 0 1,0 ${-2 * r},0a${r},${r} 0 1,0 ${2 * r},0Z`;

const oak = outline(x => Math.sin(Math.PI * x) * (0.19 + 0.11 * Math.abs(Math.sin(4.5 * Math.PI * x))), 48);
const round = outline(x => 0.4 * Math.max(0, Math.sin(Math.PI * x ** 0.8)) ** 0.7);
// Broad, glossy banyan (vad) leaf with a short blunt tip.
const banyan = outline(x => 0.34 * Math.max(0, Math.sin(Math.PI * x ** 0.9)) ** 0.75 * (1 - 0.25 * x ** 6), 30);

export interface LeafDef {
  body: string;
  /** Upper half, lightened to give the leaf a fold. */
  half?: string;
  vein?: string;
  /** Flower centre. */
  centre?: string;
}

/** Unit-length leaf drawings pointing along +x with the stem at 0,0. Drawn once in <defs> and reused. */
export const LEAF_DEFS: Record<LeafShape, LeafDef> = {
  oak: { body: oak.body, half: oak.upper, vein: 'M0.02,0Q0.5,-0.02 0.94,0' },
  round: { body: round.body, half: round.upper, vein: 'M0.02,0Q0.45,-0.03 0.86,0' },
  banyan: {
    body: banyan.body,
    half: banyan.upper,
    vein: 'M0.02,0Q0.5,-0.02 0.95,0M0.3,0L0.42,-0.16M0.3,0L0.42,0.16M0.55,0L0.67,-0.15M0.55,0L0.67,0.15',
  },
  blossom: {
    body: [0, 1, 2, 3, 4].map(i => {
      const a = (i * 2 * Math.PI) / 5;
      return circle(0.5 + Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.17);
    }).join(''),
    centre: circle(0.5, 0, 0.09),
  },
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

/** Mixes two #rrggbb colours; amount 0 keeps a, 1 gives b. */
export function mix(a: string, b: string, amount: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`;
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

/** Unit normal pointing to the left of the direction of travel. */
function normalAt(curve: Curve, t: number): Point {
  const d = bezD(curve, t);
  const len = Math.hypot(d.x, d.y) || 1;
  return { x: -d.y / len, y: d.x / len };
}

interface Taper { w0: number; w1: number; ease: number; collar: number }

const widthAt = ({ w0, w1, ease, collar }: Taper, t: number) => (w0 + (w1 - w0) * t ** ease) * (1 + collar * Math.exp(-t * 12));

/** Filled strip of a tapered curve between two signed fractions of its half-width (-1..1). */
function band(curve: Curve, taper: Taper, from: number, to: number): string {
  const a: string[] = [];
  const b: string[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const p = bez(curve, t);
    const n = normalAt(curve, t);
    const w = widthAt(taper, t) / 2;
    a.push(`${fmt(p.x + n.x * w * from)},${fmt(p.y + n.y * w * from)}`);
    b.push(`${fmt(p.x + n.x * w * to)},${fmt(p.y + n.y * w * to)}`);
  }
  return `M${a.join('L')}L${b.reverse().join('L')}Z`;
}

/** Filled outline of a curve that narrows from width w0 to w1. */
export function taperPath(curve: Curve, w0: number, w1: number, ease = 1, collar = 0): string {
  return band(curve, { w0, w1, ease, collar }, -1, 1);
}

/** Body plus a shaded side away from the light and a lit strip facing it. */
function woodPiece(curve: Curve, taper: Taper): WoodPiece {
  const n = normalAt(curve, 0.5);
  const lit = n.x * LIGHT.x + n.y * LIGHT.y >= 0 ? 1 : -1;
  return {
    body: band(curve, taper, -1, 1),
    shade: band(curve, taper, -lit, -lit * 0.05),
    light: band(curve, taper, lit * 0.25, lit * 0.62),
    cracks: '',
    knots: [],
  };
}

function curveLength(curve: Curve): number {
  let len = 0;
  let prev = bez(curve, 0);
  for (let i = 1; i <= 16; i++) {
    const p = bez(curve, i / 16);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** Gently wavy, broken cracks running along the bark, gathered into one path. */
function barkCracks(rand: () => number, curve: Curve, taper: Taper, lanes: number[]): string {
  const total = Math.max(1, curveLength(curve));
  const parts: string[] = [];
  lanes.forEach(lane => {
    let t = 0.03 + rand() * 0.06;
    while (t < 0.94) {
      const end = Math.min(0.96, t + (14 + rand() * 34) / total);
      const phase = rand() * Math.PI * 2;
      const pts: string[] = [];
      for (let i = 0; i <= 6; i++) {
        const s = t + ((end - t) * i) / 6;
        const p = bez(curve, s);
        const n = normalAt(curve, s);
        // Cracks follow the limb and narrow with it, wobbling by a pixel or so.
        const o = lane * (widthAt(taper, s) / 2) * 0.92 + Math.sin(phase + i * 0.9) * 1.1;
        pts.push(`${fmt(p.x + n.x * o)},${fmt(p.y + n.y * o)}`);
      }
      parts.push(`M${pts.join('L')}`);
      t = end + (4 + rand() * 16) / total;
    }
  });
  return parts.join('');
}

function addKnots(rand: () => number, curve: Curve, taper: Taper, count: number, piece: WoodPiece) {
  for (let i = 0; i < count; i++) {
    const t = 0.25 + rand() * 0.5;
    const p = bez(curve, t);
    const n = normalAt(curve, t);
    const w = widthAt(taper, t) / 2;
    const off = (rand() - 0.5) * 0.8 * w;
    const d = bezD(curve, t);
    // Knots are stretched along the grain.
    const rx = Math.min(9, Math.max(2, w * (0.12 + rand() * 0.06)));
    piece.knots.push({
      cx: p.x + n.x * off, cy: p.y + n.y * off, rx, ry: rx * (0.45 + rand() * 0.15),
      angle: (Math.atan2(d.y, d.x) * 180) / Math.PI,
    });
  }
}

interface Palette {
  theme: ThemeSpec;
  /** 0 near the trunk base, 1 at the outer tips and top of the crown. */
  outerness: (x: number, y: number) => number;
}

function pickLeaf(rand: () => number, { theme, outerness }: Palette, x: number, y: number): Pick<LeafArt, 'color' | 'shape'> {
  const { accent } = theme;
  if (accent && rand() < accent.chance * (0.4 + outerness(x, y))) {
    return { color: accent.colors[Math.floor(rand() * accent.colors.length)], shape: accent.shape };
  }
  const list = rand() < outerness(x, y) ** 1.2 ? theme.outer : theme.inner;
  return { color: list[Math.floor(rand() * list.length)], shape: theme.shapes[Math.floor(rand() * theme.shapes.length)] };
}

function scatterLeaf(rand: () => number, x: number, y: number, size: number, opacity: number, colors: string[], shapes: LeafShape[]): LeafArt {
  return {
    x, y, angle: rand() * 360, size, squash: 0.55 + rand() * 0.45,
    color: colors[Math.floor(rand() * colors.length)],
    shape: shapes[Math.floor(rand() * shapes.length)],
    opacity,
  };
}

/** A small tapered twig carrying 10–15 leaves; some sit behind the wood for depth. */
function twig(rand: () => number, x: number, y: number, angleDeg: number, length: number, scale: number, palette: Palette, art: PosterArt) {
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
    const back = !last && rand() < BACK_LEAF_SHARE;
    const { color, shape } = pickLeaf(rand, palette, p.x, p.y);
    (back ? art.backLeaves : art.leaves).push({
      x: p.x,
      y: p.y,
      angle: last ? along + (rand() - 0.5) * 20 : along + (i % 2 ? 1 : -1) * (30 + rand() * 30),
      size: leafSize * (0.55 + rand() * 0.6) * (0.75 + 0.35 * t),
      squash: 0.6 + rand() * 0.4,
      color: back ? mix(color, '#2a2418', 0.3) : color,
      shape,
      opacity: back ? 0.85 : 0.8 + rand() * 0.18,
    });
  }
}

/** A thin banyan root hanging from a branch; long ones reach the ground and thicken into pillars. */
function aerialRoot(rand: () => number, from: Point, groundY: number): { d: string; foot?: Point } {
  const drop = groundY - from.y;
  const reach = rand() < 0.3 ? 1 : 0.3 + rand() * 0.5;
  const end = { x: from.x + (rand() - 0.5) * 16, y: reach === 1 ? groundY + 4 : from.y + drop * reach };
  const sway = (rand() - 0.5) * 22;
  const curve: Curve = [
    from,
    { x: from.x + sway, y: from.y + (end.y - from.y) * 0.35 },
    { x: end.x - sway * 0.6, y: from.y + (end.y - from.y) * 0.7 },
    end,
  ];
  return reach === 1 ? { d: taperPath(curve, 2.2, 4.2, 1.5), foot: end } : { d: taperPath(curve, 2, 0.5, 0.8) };
}

/** Trunk, tapering limbs, leafy twigs, ground and fallen leaves around an already laid-out poster. */
export function buildPosterArt({ nodes, focusDepth, posOf, cardH, groundY, trunkH, scale, minX, maxX, theme = 'autumn' }: PosterArtInput): PosterArt {
  const art: PosterArt = {
    wood: [], twigs: [], backLeaves: [], leaves: [], fallen: [], drifting: [], canopy: [], aerialRoots: [],
    ground: { cx: 0, cy: 0, rx: 0, mound: '', grass: '', pebbles: [], footings: [] },
  };
  if (nodes.length === 0) return art;
  const spec = THEMES[theme];
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

  const base = posOf(nodes[0]);
  const topY = Math.min(...nodes.map(n => posOf(n).y)) - 60;
  const midX = (minX + maxX) / 2;
  const halfSpan = Math.max(1, (maxX - minX) / 2);
  const palette: Palette = {
    theme: spec,
    outerness: (x, y) => clamp01(0.62 * clamp01((groundY - y) / Math.max(1, groundY - topY)) ** 1.4 + 0.5 * (Math.abs(x - midX) / halfSpan) ** 1.5),
  };

  // Soft crown behind everything, one mass per descendant
  nodes.forEach(n => {
    if (n.depth < focusDepth || n.kind === 'fork') return;
    const { x, y } = posOf(n);
    art.canopy.push({ cx: x + (rand() - 0.5) * 40, cy: y - 30 - rand() * 30, r: 95 * scale * (0.85 + rand() * 0.5) });
  });

  // Roots of varied length, some diving into the soil, then the trunk itself
  const top = widthOf(nodes[0]);
  const flare = top * FLARE;
  const trunkTaper: Taper = { w0: flare, w1: top, ease: 0.45, collar: 0 };
  // Control points are spaced along the visible trunk so it never folds back under a tall card.
  const trunkTop = base.y + inset(nodes[0]);
  const trunkLen = groundY + 4 - trunkTop;
  const trunk: Curve = [
    { x: base.x - top * 0.25, y: groundY + 4 },
    { x: base.x - 5 - rand() * 6, y: groundY + 4 - trunkLen * 0.4 },
    { x: base.x + 3 + rand() * 6, y: trunkTop + trunkLen * 0.3 },
    { x: base.x, y: trunkTop },
  ];
  // Soil mound the trunk grows out of; roots sink below its surface.
  const moundRx = flare * 2.4 + 60;
  const mTop = groundY + 1;
  const surface = (x: number) => mTop + 13 * Math.min(1, Math.abs(x - base.x) / moundRx) ** 2;
  art.ground = { ...art.ground, cx: base.x + SHADOW_OFFSET.x * 2, cy: groundY + 12, rx: flare * 3.2 + 80 };
  for (let i = 0; i < 7; i++) {
    const dir = i % 2 ? 1 : -1;
    const sx = base.x + dir * flare * (0.12 + rand() * 0.28);
    const reach = Math.min(moundRx * 0.6, flare * (0.35 + rand() * 0.6) + rand() * 25);
    const ex = sx + dir * reach;
    const ey = surface(ex) + 3 + rand() * 4;
    const curve: Curve = [
      { x: sx, y: groundY - 8 - rand() * 6 },
      { x: sx + dir * reach * 0.25, y: groundY - 4 },
      { x: sx + dir * reach * 0.6, y: surface(sx + dir * reach * 0.6) - 2 },
      { x: ex, y: ey },
    ];
    art.wood.push(woodPiece(curve, { w0: flare * (0.26 + rand() * 0.14), w1: 2, ease: 0.7, collar: 0 }));
  }
  const trunkPiece = woodPiece(trunk, trunkTaper);
  trunkPiece.cracks = barkCracks(rand, trunk, trunkTaper, [-0.62, -0.3, 0.02, 0.32, 0.6]);
  addKnots(rand, trunk, trunkTaper, 2, trunkPiece);
  art.wood.push(trunkPiece);

  art.ground.mound = `M${fmt(base.x - moundRx)},${fmt(mTop + 13)}`
    + `C${fmt(base.x - moundRx * 0.5)},${fmt(mTop + 5)} ${fmt(base.x - moundRx * 0.25)},${fmt(mTop)} ${fmt(base.x)},${fmt(mTop)}`
    + `C${fmt(base.x + moundRx * 0.25)},${fmt(mTop)} ${fmt(base.x + moundRx * 0.5)},${fmt(mTop + 5)} ${fmt(base.x + moundRx)},${fmt(mTop + 13)}`
    + `Q${fmt(base.x)},${fmt(groundY + 42)} ${fmt(base.x - moundRx)},${fmt(mTop + 13)}Z`;
  const blades: string[] = [];
  for (let i = 0; i < 16; i++) {
    const gx = base.x + (rand() * 2 - 1) * moundRx * 0.9;
    if (Math.abs(gx - base.x) < flare * 0.5) continue;
    const gy = surface(gx) + 1;
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const h = 7 + rand() * 9;
      const lean = (j - (n - 1) / 2) * 3 + (rand() - 0.5) * 3;
      blades.push(`M${fmt(gx + j * 1.6)},${fmt(gy)}Q${fmt(gx + j * 1.6 + lean * 0.3)},${fmt(gy - h * 0.6)} ${fmt(gx + j * 1.6 + lean)},${fmt(gy - h)}`);
    }
  }
  art.ground.grass = blades.join('');
  for (let i = 0; i < 6; i++) {
    const px = base.x + (rand() * 2 - 1) * moundRx * 0.75;
    if (Math.abs(px - base.x) < flare * 0.6) continue;
    const r = 2.5 + rand() * 3.5;
    art.ground.pebbles.push({ cx: px, cy: surface(px) + r * 0.4 + 2, rx: r * 1.35, ry: r, angle: (rand() - 0.5) * 30 });
  }

  // Limbs, thickest first so thinner ones sit on top
  const limbs = nodes.filter(n => n.stemId).map(n => {
    const stem = byId.get(n.stemId!)!;
    const from = posOf(stem);
    const to = posOf(n);
    // Start from the middle of the card so a thick limb's end stays hidden behind it.
    const p0 = { x: from.x, y: from.y };
    const p3 = { x: to.x, y: to.y + inset(n) };
    const dx = p3.x - p0.x;
    const dy = p0.y - p3.y;
    // Long sideways limbs sag under their own weight before turning up.
    const sag = Math.abs(dx) > dy ? Math.min(Math.abs(dx) * 0.1, 36) * (0.5 + rand()) : 0;
    const curve: Curve = [
      p0,
      { x: p0.x + dx * BEND * (0.6 + rand() * 0.8), y: p0.y - dy * (0.4 + rand() * 0.2) + sag },
      { x: p3.x - dx * (0.02 + rand() * 0.1), y: p3.y + dy * (0.3 + rand() * 0.16) },
      p3,
    ];
    const onTrunk = n.depth <= focusDepth;
    const w0 = onTrunk ? Math.max(widthOf(n), widthOf(stem) * 0.96) : widthOf(n);
    // Limbs only taper towards a card; at a bare fork they keep their width for the limbs that carry on.
    const w1 = onTrunk || n.kind === 'fork' ? widthOf(n) : Math.max(1.6, widthOf(n) * TAPER);
    // A collar only shows where a limb leaves a bare fork; cards hide the other joints.
    const taper: Taper = { w0, w1, ease: 0.85, collar: stem.kind === 'fork' ? COLLAR : 0 };
    return { curve, taper, onTrunk, depth: n.depth, length: Math.hypot(dx, dy) * 1.1, dx, toFork: n.kind === 'fork' };
  }).sort((a, b) => b.taper.w0 - a.taper.w0);

  limbs.forEach(({ curve, taper, onTrunk, depth, length, dx, toFork }) => {
    const piece = woodPiece(curve, taper);
    art.wood.push(piece);
    // Round off the limb's end where it splits at a bare fork.
    if (toFork) art.wood.push({ body: circle(curve[3].x, curve[3].y, taper.w1 * 0.54), shade: '', light: '', cracks: '', knots: [] });
    if (taper.w0 > 10) {
      piece.cracks = barkCracks(rand, curve, taper, onTrunk ? [-0.5, -0.1, 0.3, 0.6] : [-0.35, 0.3]);
      if (onTrunk || taper.w0 > 24) addKnots(rand, curve, taper, onTrunk ? 1 : rand() < 0.5 ? 1 : 0, piece);
    }
    if (spec.aerialRoots && !onTrunk && depth <= focusDepth + 1.5 && Math.abs(dx) > 40) {
      const roots = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < roots; i++) {
        const t = 0.25 + rand() * 0.5;
        const p = bez(curve, t);
        const root = aerialRoot(rand, { x: p.x, y: p.y + widthAt(taper, t) * 0.3 }, groundY);
        art.aerialRoots.push(root.d);
        if (root.foot) art.ground.footings.push(root.foot);
      }
    }
    if (onTrunk) return;
    const count = Math.min(MAX_TWIGS_PER_LIMB, Math.max(1, Math.round(length / (TWIG_SPACING * scale))));
    let side = rand() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const t = Math.min(0.92, 0.28 + (0.64 * (i + 0.5)) / count + (rand() - 0.5) * 0.08);
      const p = bez(curve, t);
      const d = bezD(curve, t);
      const n = normalAt(curve, t);
      const half = widthAt(taper, t) / 2;
      const along = (Math.atan2(d.y, d.x) * 180) / Math.PI;
      twig(rand, p.x - n.x * half * side * 0.8, p.y - n.y * half * side * 0.8,
        along - side * (35 + rand() * 30), LEAF_SIZE * scale * (1.5 + rand() * 1.3), scale, palette, art);
      side = -side;
    }
  });

  // Leafy sprigs above the outermost names
  nodes.filter(n => n.depth >= focusDepth && !kids.has(n.id)).forEach(n => {
    const { x, y } = posOf(n);
    const crown = y - cardH(n) / 2 + 2;
    [-38, 0, 38].forEach(off =>
      twig(rand, x + off * 0.15, crown, -90 + off + (rand() - 0.5) * 14, LEAF_SIZE * scale * (1.9 + rand() * 1.1), scale, palette, art));
  });

  // Fallen leaves around the roots and a few drifting down
  const spread = Math.min((maxX - minX) * 0.25, 350);
  const { fallen } = spec;
  for (let i = 0; i < fallen.count; i++) {
    const fx = base.x + (rand() - 0.5) * 2 * spread;
    const fy = Math.abs(fx - base.x) < moundRx ? surface(fx) + rand() * 8 : groundY + 14 + rand() * 12;
    art.fallen.push(scatterLeaf(rand, fx, fy, LEAF_SIZE * scale * (0.6 + rand() * 0.5), 0.8, fallen.colors, fallen.shapes));
  }
  const focusY = posOf(nodes.find(n => n.depth === focusDepth) ?? nodes[0]).y;
  for (let i = 0; i < spec.drifting; i++) {
    const leaf = scatterLeaf(rand, minX + rand() * (maxX - minX), focusY - rand() * trunkH, LEAF_SIZE * scale * (0.6 + rand() * 0.4), 0.6, fallen.colors, fallen.shapes);
    art.drifting.push({ ...leaf, squash: 0.35 + rand() * 0.4 });
  }
  return art;
}
