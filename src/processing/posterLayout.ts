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
  /** Wives shown on the same card as the person; always empty for women. */
  spouseIds: string[];
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
type Marriage = Pick<RawSpouseRelation, 'spouse1Id' | 'spouse2Id' | 'marriageYear' | 'endYear' | 'endReason'> & { status?: 'current' | 'former' };

/**
 * The poster follows the blood line through the sons: a woman is shown alone, without her husband or children.
 * A man's card lists every wife whose marriage was not ended by divorce, annulment or separation, earliest first.
 */
function wifeFinder(members: Member[], marriages: Marriage[]): (id: string) => string[] {
  const genderOf = new Map(members.map(m => [m.id, m.gender]));
  const ended = (s: Marriage) => s.status ? s.status === 'former' : s.endYear != null;
  return id => {
    if (genderOf.get(id) === 'female') return [];
    const wives = marriages
      .map((s, i) => ({ s, i, wife: s.spouse1Id === id ? s.spouse2Id : s.spouse2Id === id ? s.spouse1Id : null }))
      .filter(({ s, wife }) => wife && wife !== id && genderOf.has(wife) && genderOf.get(wife) !== 'male'
        && (!ended(s) || s.endReason === 'death'))
      .sort((a, b) => (a.s.marriageYear ?? Infinity) - (b.s.marriageYear ?? Infinity) || a.i - b.i)
      .map(({ wife }) => wife as string);
    return Array.from(new Set(wives));
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

  const wivesOf = wifeFinder(members, marriages);
  const down = descendantLayout(rootId, generations, members, parentChild, wivesOf);
  const onTree = new Set(down.nodes.flatMap(n => [n.id, ...n.spouseIds]));
  const chain: string[] = [];
  for (const id of ancestorLine(rootId, generations - 1, members, parentChild)) {
    if (onTree.has(id)) break;
    chain.unshift(id);
  }
  const k = chain.length;
  const x = down.nodes[0].x;
  const nodes: PosterNode[] = chain.map((id, i) => ({
    id, depth: i, x, stemId: i ? chain[i - 1] : null, kind: 'person' as const, spouseIds: wivesOf(id),
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
  wivesOf: (id: string) => string[],
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
    const spouseIds = wivesOf(id);
    placed.add(id);
    spouseIds.forEach(w => placed.add(w));
    levels = Math.max(levels, depth + 1);
    const node: PosterNode = { id, depth, x: 0, stemId, kind: 'person', spouseIds };
    nodes.push(node);
    // A couple's children may be recorded under either parent. Daughters' children belong to another family line.
    const children = depth + 1 < generations && byId.get(id)!.m.gender !== 'female'
      ? Array.from(new Set([id, ...spouseIds].flatMap(p => next.get(p) ?? [])))
        .filter(b => !placed.has(b)).sort(compare)
      : [];
    const daughters = children.filter(c => byId.get(c)!.m.gender === 'female');
    const sons = children.filter(c => !daughters.includes(c));
    if (children.length === 0) {
      node.x = slot + 0.5;
      slot += 1;
    } else if (sons.length && daughters.length) {
      const forkXs = ([['m', sons], ['f', daughters]] as const).map(([g, group]) => {
        const fork: PosterNode = { id: `${id}~${g}`, depth: depth + 0.5, x: 0, stemId: id, kind: 'fork', spouseIds: [] };
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

/** Where the longest line through the sons first branches; a single-child chain makes a bare poster. */
export function findPosterRoot(members: Pick<RawFamilyMember, 'id' | 'gender'>[], parentChild: RawParentChildRelation[]): string | null {
  const hasParent = new Set(parentChild.map(r => r.childId));
  const women = new Set(members.filter(m => m.gender === 'female').map(m => m.id));
  const childrenOf = new Map<string, string[]>();
  parentChild.forEach(r => {
    if (!women.has(r.parentId)) childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r.childId]);
  });

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
