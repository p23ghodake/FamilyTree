import { RawFamilyMember, RawParentChildRelation } from '../types/FamilyTypes';

export interface PosterNode {
  id: string;
  /** 0 = the person at the base of the trunk; grows upward. */
  depth: number;
  /** Horizontal position in leaf slots (centre of a slot is n + 0.5). */
  x: number;
  /** The node one level closer to the trunk; null for the base. */
  stemId: string | null;
}

export interface PosterLayout {
  nodes: PosterNode[];
  /** Number of leaf slots, i.e. the poster width in slots. */
  slots: number;
  /** Number of levels actually drawn. */
  levels: number;
  /** Depth of the chosen person; non-zero when their ancestors are stacked on the trunk below them. */
  focusDepth: number;
}

type Member = Pick<RawFamilyMember, 'id' | 'gender' | 'birthYear'>;

/** Direct line of ancestors, nearest first, following the father where known. */
function ancestorLine(id: string, max: number, members: Member[], parentChild: RawParentChildRelation[]): string[] {
  const genderOf = new Map(members.map(m => [m.id, m.gender]));
  const rank = (pid: string) => (genderOf.get(pid) === 'male' ? 0 : genderOf.get(pid) === 'female' ? 1 : 2);
  const line: string[] = [];
  const seen = new Set([id]);
  const parentsOf = (child: string) => parentChild
    .filter(r => r.childId === child && genderOf.has(r.parentId) && !seen.has(r.parentId))
    .map(r => r.parentId)
    .sort((a, b) => rank(a) - rank(b));
  let current = id;
  while (line.length < max) {
    const parent = parentsOf(current)[0];
    if (!parent) break;
    line.push(parent);
    seen.add(parent);
    current = parent;
  }
  return line;
}

/** Stacks the chosen person's ancestor line on the trunk, then lays out their descendants above it. */
export function buildPosterLayout(
  rootId: string,
  generations: number,
  members: Member[],
  parentChild: RawParentChildRelation[],
): PosterLayout {
  if (!members.some(m => m.id === rootId)) return { nodes: [], slots: 0, levels: 0, focusDepth: 0 };

  const down = descendantLayout(rootId, generations, members, parentChild);
  const onTree = new Set(down.nodes.map(n => n.id));
  const chain: string[] = [];
  for (const id of ancestorLine(rootId, generations - 1, members, parentChild)) {
    if (onTree.has(id)) break;
    chain.unshift(id);
  }
  const k = chain.length;
  const x = down.nodes[0].x;
  const nodes: PosterNode[] = chain.map((id, i) => ({ id, depth: i, x, stemId: i ? chain[i - 1] : null }));
  down.nodes.forEach(n => nodes.push({ ...n, depth: n.depth + k, stemId: n.stemId ?? (k ? chain[k - 1] : null) }));
  return { nodes, slots: down.slots, levels: down.levels + k, focusDepth: k };
}

/** Bottom-up descendant tree: leaves get one slot each, every branch is centred over its leaves. */
function descendantLayout(
  rootId: string,
  generations: number,
  members: Member[],
  parentChild: RawParentChildRelation[],
): { nodes: PosterNode[]; slots: number; levels: number } {
  const byId = new Map(members.map((m, i) => [m.id, { m, i }]));
  const next = new Map<string, string[]>();
  parentChild.forEach(({ parentId, childId }) => {
    if (!byId.has(childId)) return;
    const list = next.get(parentId) ?? [];
    if (!list.includes(childId)) list.push(childId);
    next.set(parentId, list);
  });

  // Eldest on the left; unknown birth years keep their data order.
  const compare = (a: string, b: string) => {
    const ma = byId.get(a)!;
    const mb = byId.get(b)!;
    return (ma.m.birthYear ?? Infinity) - (mb.m.birthYear ?? Infinity) || ma.i - mb.i;
  };

  const nodes: PosterNode[] = [];
  const placed = new Set<string>();
  let slot = 0;
  let levels = 0;

  const place = (id: string, depth: number, stemId: string | null): number => {
    placed.add(id);
    levels = Math.max(levels, depth + 1);
    const node: PosterNode = { id, depth, x: 0, stemId };
    nodes.push(node);
    const branches = depth + 1 < generations
      ? (next.get(id) ?? []).filter(b => !placed.has(b)).sort(compare)
      : [];
    if (branches.length === 0) {
      node.x = slot + 0.5;
      slot += 1;
    } else {
      const xs = branches.map(b => place(b, depth + 1, id));
      node.x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    return node.x;
  };

  place(rootId, 0, null);
  return { nodes, slots: slot, levels };
}

/** Where the longest descendant line first branches; a single-child chain makes a bare poster. */
export function findPosterRoot(members: Pick<RawFamilyMember, 'id'>[], parentChild: RawParentChildRelation[]): string | null {
  const hasParent = new Set(parentChild.map(r => r.childId));
  const childrenOf = new Map<string, string[]>();
  parentChild.forEach(r => childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r.childId]));

  const depthMemo = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = 1 + Math.max(0, ...(childrenOf.get(id) ?? []).map(c => depth(c, seen)));
    depthMemo.set(id, d);
    return d;
  };

  let best: string | null = null;
  let bestDepth = -1;
  members.forEach(m => {
    if (hasParent.has(m.id)) return;
    const d = depth(m.id, new Set());
    if (d > bestDepth) { best = m.id; bestDepth = d; }
  });

  const seen = new Set<string>();
  let current: string | null = best;
  while (current && !seen.has(current)) {
    seen.add(current);
    const children: string[] = Array.from(new Set(childrenOf.get(current) ?? []));
    if (children.length !== 1) break;
    current = children[0];
  }
  return current;
}
