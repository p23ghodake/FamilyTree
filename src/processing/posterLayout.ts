import { RawFamilyMember, RawParentChildRelation, RawSpouseRelation } from '../types/FamilyTypes';

export interface PosterNode {
  id: string;
  /** 0 = the person at the base of the trunk; grows upward. Forks sit half a level above their parent. */
  depth: number;
  /** Horizontal position in leaf slots (centre of a slot is n + 0.5). */
  x: number;
  /** The node one level closer to the trunk; null for the base. */
  stemId: string | null;
  /** 'fork' is an unlabelled branch point splitting a couple's sons from their daughters. */
  kind: 'person' | 'fork';
  /** Shown on the same card as the person. */
  spouseId: string | null;
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
type Marriage = Pick<RawSpouseRelation, 'spouse1Id' | 'spouse2Id' | 'endYear' | 'endReason'> & { status?: 'current' | 'former' };

/** The spouse shown on a person's card: a current spouse, else one lost to death; never an ex. */
function spouseFinder(marriages: Marriage[]): (id: string) => string | null {
  const ended = (s: Marriage) => s.status ? s.status === 'former' : s.endYear != null;
  return id => {
    const own = marriages.filter(s => s.spouse1Id === id || s.spouse2Id === id);
    const pick = own.find(s => !ended(s)) ?? own.find(s => s.endReason === 'death');
    if (!pick) return null;
    return pick.spouse1Id === id ? pick.spouse2Id : pick.spouse1Id;
  };
}

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
  marriages: Marriage[] = [],
): PosterLayout {
  if (!members.some(m => m.id === rootId)) return { nodes: [], slots: 0, levels: 0, focusDepth: 0 };

  const spouseOf = spouseFinder(marriages);
  const down = descendantLayout(rootId, generations, members, parentChild, spouseOf);
  const onTree = new Set(down.nodes.flatMap(n => (n.spouseId ? [n.id, n.spouseId] : [n.id])));
  const chain: string[] = [];
  for (const id of ancestorLine(rootId, generations - 1, members, parentChild)) {
    if (onTree.has(id)) break;
    chain.unshift(id);
  }
  const k = chain.length;
  const x = down.nodes[0].x;
  const nodes: PosterNode[] = chain.map((id, i) => ({
    id, depth: i, x, stemId: i ? chain[i - 1] : null, kind: 'person' as const, spouseId: spouseOf(id),
  }));
  down.nodes.forEach(n => nodes.push({ ...n, depth: n.depth + k, stemId: n.stemId ?? (k ? chain[k - 1] : null) }));
  return { nodes, slots: down.slots, levels: down.levels + k, focusDepth: k };
}

/** Bottom-up descendant tree: leaves get one slot each, every branch is centred over its leaves. */
function descendantLayout(
  rootId: string,
  generations: number,
  members: Member[],
  parentChild: RawParentChildRelation[],
  spouseOf: (id: string) => string | null,
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

  const placeGroup = (ids: string[], depth: number, stemId: string): number[] => ids.map(c => place(c, depth, stemId));

  const place = (id: string, depth: number, stemId: string | null): number => {
    const spouseId = spouseOf(id);
    placed.add(id);
    if (spouseId) placed.add(spouseId);
    levels = Math.max(levels, depth + 1);
    const node: PosterNode = { id, depth, x: 0, stemId, kind: 'person', spouseId };
    nodes.push(node);
    // A couple's children may be recorded under either parent.
    const children = depth + 1 < generations
      ? Array.from(new Set([...(next.get(id) ?? []), ...(spouseId ? next.get(spouseId) ?? [] : [])]))
        .filter(b => !placed.has(b)).sort(compare)
      : [];
    const daughters = children.filter(c => byId.get(c)!.m.gender === 'female');
    const sons = children.filter(c => !daughters.includes(c));
    if (children.length === 0) {
      node.x = slot + 0.5;
      slot += 1;
    } else if (sons.length && daughters.length) {
      const forkXs = ([['m', sons], ['f', daughters]] as const).map(([g, group]) => {
        const fork: PosterNode = { id: `${id}~${g}`, depth: depth + 0.5, x: 0, stemId: id, kind: 'fork', spouseId: null };
        nodes.push(fork);
        const xs = placeGroup(group, depth + 1, fork.id);
        fork.x = (xs[0] + xs[xs.length - 1]) / 2;
        return fork.x;
      });
      node.x = (forkXs[0] + forkXs[1]) / 2;
    } else {
      const xs = placeGroup(children, depth + 1, id);
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
