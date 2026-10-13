import { StyledFamilyMember, StyledRelationships } from '../types/FamilyTypes';

type Gender = 'male' | 'female' | 'unknown';

// ─── Build bidirectional adjacency map ───

function buildAdjacency(
  members: StyledFamilyMember[],
  relationships: StyledRelationships,
  bloodOnly = false
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  relationships.parentChild.forEach(r => add(r.parentId, r.childId));
  if (!bloodOnly) relationships.spouses.forEach(r => add(r.spouse1Id, r.spouse2Id));

  // Also use embedded member data as fallback
  members.forEach(m => {
    (m.parentIds ?? []).forEach(pid => add(m.id, pid));
    if (!bloodOnly && m.spouseId) add(m.id, m.spouseId);
    (m.childrenIds ?? []).forEach(cid => add(m.id, cid));
  });

  return adj;
}

// ─── Path selection ───
//
// Precedence rule (documented, deterministic):
//   1. Direct spouse link
//   2. Shortest blood path (parent/child links only)
//   3. Shortest path that crosses a marriage
// Blood ties are never overridden by marriage routes, so a person who is both
// a cousin and an in-law is reported as a cousin.

export function findRelationshipPath(
  sourceId: string,
  targetId: string,
  members: StyledFamilyMember[],
  relationships: StyledRelationships
): string[] | null {
  if (sourceId === targetId) return [sourceId];

  const full = buildAdjacency(members, relationships);
  if (full.get(sourceId)?.has(targetId)) {
    const isParentChild =
      relationships.parentChild.some(
        r => (r.parentId === sourceId && r.childId === targetId) ||
             (r.parentId === targetId && r.childId === sourceId)
      ) ||
      members.some(
        mb => (mb.id === sourceId && (mb.parentIds ?? []).includes(targetId)) ||
              (mb.id === targetId && (mb.parentIds ?? []).includes(sourceId))
      );
    if (!isParentChild) return [sourceId, targetId];
  }

  return bloodPath(sourceId, targetId, members, relationships) ?? bfsPath(sourceId, targetId, full);
}

function parentChildMaps(members: StyledFamilyMember[], relationships: StyledRelationships) {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  const link = (p: string, c: string) => {
    if (!parentsOf.has(c)) parentsOf.set(c, new Set());
    if (!childrenOf.has(p)) childrenOf.set(p, new Set());
    parentsOf.get(c)!.add(p);
    childrenOf.get(p)!.add(c);
  };
  relationships.parentChild.forEach(r => link(r.parentId, r.childId));
  members.forEach(mb => {
    (mb.parentIds ?? []).forEach(pid => link(pid, mb.id));
    (mb.childrenIds ?? []).forEach(cid => link(mb.id, cid));
  });
  return { parentsOf, childrenOf };
}

// Shortest true blood path: climb to a common ancestor, then descend.
// Paths that go down and back up (e.g. through a shared child) are not blood ties.
function bloodPath(
  sourceId: string,
  targetId: string,
  members: StyledFamilyMember[],
  relationships: StyledRelationships
): string[] | null {
  const { parentsOf, childrenOf } = parentChildMaps(members, relationships);

  // State key: id + phase (0 = may still climb, 1 = descending only)
  const key = (id: string, phase: number) => `${id}|${phase}`;
  const prev = new Map<string, string | null>([[key(sourceId, 0), null]]);
  const queue: Array<[string, number]> = [[sourceId, 0]];
  while (queue.length > 0) {
    const [id, phase] = queue.shift()!;
    const next: Array<[string, number]> = [];
    if (phase === 0) Array.from(parentsOf.get(id) ?? []).forEach(p => next.push([p, 0]));
    Array.from(childrenOf.get(id) ?? []).forEach(c => next.push([c, 1]));
    for (const [nid, nphase] of next) {
      const k = key(nid, nphase);
      if (prev.has(k)) continue;
      prev.set(k, key(id, phase));
      if (nid === targetId) {
        const path: string[] = [];
        let cur: string | null = k;
        while (cur !== null) {
          path.push(cur.split('|')[0]);
          cur = prev.get(cur) ?? null;
        }
        return path.reverse();
      }
      queue.push([nid, nphase]);
    }
  }
  return null;
}

function bfsPath(
  sourceId: string,
  targetId: string,
  adj: Map<string, Set<string>>
): string[] | null {
  // Parent-pointer BFS: O(n) space instead of O(n²) path-copy approach
  const parent = new Map<string, string | null>([[sourceId, null]]);
  const queue: string[] = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of Array.from(adj.get(current) ?? [])) {
      if (parent.has(neighbor)) continue;
      parent.set(neighbor, current);
      if (neighbor === targetId) {
        // Reconstruct path by walking parent pointers backwards
        const path: string[] = [];
        let node: string | null = targetId;
        while (node !== null) {
          path.push(node);
          node = parent.get(node) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}

// ─── Step direction ───

type StepType = 'up' | 'down' | 'spouse';

function getStepType(
  fromId: string,
  toId: string,
  relationships: StyledRelationships,
  members: StyledFamilyMember[]
): StepType {
  // toId is a parent of fromId → going UP
  const isUp =
    relationships.parentChild.some(r => r.parentId === toId && r.childId === fromId) ||
    (members.find(m => m.id === fromId)?.parentIds ?? []).includes(toId);
  if (isUp) return 'up';

  // toId is a child of fromId → going DOWN
  const isDown =
    relationships.parentChild.some(r => r.parentId === fromId && r.childId === toId) ||
    (members.find(m => m.id === toId)?.parentIds ?? []).includes(fromId);
  if (isDown) return 'down';

  return 'spouse';
}

// ─── Shared helpers ───
//
// Every label answers "SOURCE is TARGET's ___", so gendered words use the source's gender.

const pick = (g: Gender, male: string, female: string, other: string) =>
  g === 'male' ? male : g === 'female' ? female : other;

const countSteps = (dirs: StepType[]) => ({
  up: dirs.filter(d => d === 'up').length,
  down: dirs.filter(d => d === 'down').length,
});

/** Blood ties climb to a common ancestor and then descend; going down and back up is not one. */
function isBloodShape(dirs: StepType[]): boolean {
  const firstDown = dirs.indexOf('down');
  return firstDown === -1 || !dirs.slice(firstDown).includes('up');
}

function splitAtSpouses(dirs: StepType[]): StepType[][] {
  const segments: StepType[][] = [[]];
  dirs.forEach(d => (d === 'spouse' ? segments.push([]) : segments[segments.length - 1].push(d)));
  return segments;
}

// ─── English labels ───

type LabelKind = 'blood' | 'spouse' | 'step' | 'inLaw' | 'other';

const BY_MARRIAGE_EN = 'Relative by marriage';

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "", "great-", "great-great-", then "3rd great-", "4th great-" … */
function greats(n: number): string {
  if (n <= 0) return '';
  if (n <= 2) return 'great-'.repeat(n);
  return `${ordinal(n)} great-`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** What the source is when it climbs `up` generations to a common ancestor and the target is `down` below it. */
function bloodLabelEn(up: number, down: number, g: Gender): string {
  if (up === 0 && down === 0) return 'Same person';
  if (up === 0) {
    return down === 1
      ? pick(g, 'Father', 'Mother', 'Parent')
      : capitalize(greats(down - 2) + pick(g, 'grandfather', 'grandmother', 'grandparent'));
  }
  if (down === 0) {
    return up === 1
      ? pick(g, 'Son', 'Daughter', 'Child')
      : capitalize(greats(up - 2) + pick(g, 'grandson', 'granddaughter', 'grandchild'));
  }
  if (up === 1 && down === 1) return pick(g, 'Brother', 'Sister', 'Sibling');
  if (up === 1) return capitalize(greats(down - 2) + pick(g, 'uncle', 'aunt', 'uncle/aunt'));
  if (down === 1) return capitalize(greats(up - 2) + pick(g, 'nephew', 'niece', 'nephew/niece'));
  // Cousins of every degree are simply "Cousin" (no 2nd/3rd or "removed").
  return 'Cousin';
}

function stepLabel(label: string): string {
  return /^(Father|Mother|Parent|Son|Daughter|Child|Brother|Sister|Sibling)$/.test(label)
    ? `Step${label.toLowerCase()}`
    : `Step-${lowerFirst(label)}`;
}

function labelEn(dirs: StepType[], g: Gender): { label: string; kind: LabelKind } {
  const segments = splitAtSpouses(dirs);
  if (!segments.every(isBloodShape)) return { label: 'Relative', kind: 'other' };
  const counts = segments.map(countSteps);
  const isEmpty = (c: { up: number; down: number }) => c.up + c.down === 0;

  if (segments.length === 1) return { label: bloodLabelEn(counts[0].up, counts[0].down, g), kind: 'blood' };

  if (segments.length === 2) {
    const [a, b] = counts; // a: source → X, then X is married to Y, b: Y → target
    if (isEmpty(a) && isEmpty(b)) return { label: pick(g, 'Husband', 'Wife', 'Spouse'), kind: 'spouse' };
    if (isEmpty(a)) {
      // Source is married to Y, a blood relative of the target.
      if (b.up === 0) return { label: stepLabel(bloodLabelEn(0, b.down, g)), kind: 'step' };
      const rel = bloodLabelEn(b.up, b.down, g);
      return { label: b.up === 1 && b.down >= 2 ? `${rel} by marriage` : `${rel}-in-law`, kind: 'inLaw' };
    }
    if (isEmpty(b)) {
      // The target is married to X, a blood relative of the source.
      if (a.down === 0) return { label: stepLabel(bloodLabelEn(a.up, 0, g)), kind: 'step' };
      const rel = bloodLabelEn(a.up, a.down, g);
      return { label: a.up >= 2 && a.down === 1 ? `${rel} by marriage` : `${rel}-in-law`, kind: 'inLaw' };
    }
    if (a.down === 0 || b.up === 0) {
      return { label: stepLabel(bloodLabelEn(a.up + b.up, a.down + b.down, g)), kind: 'step' };
    }
    if (a.up === 0 && a.down === 1 && b.up === 1 && b.down === 0) {
      return { label: pick(g, 'Co-father-in-law', 'Co-mother-in-law', 'Co-parent-in-law'), kind: 'inLaw' };
    }
  }

  if (segments.length === 3 && isEmpty(counts[0]) && isEmpty(counts[2])) {
    const mid = counts[1]; // source's spouse → mid → target's spouse
    if (mid.up === 1 && mid.down === 1) return { label: `${pick(g, 'Brother', 'Sister', 'Sibling')}-in-law`, kind: 'inLaw' };
    if (mid.up === 0 && mid.down === 1) return { label: `${pick(g, 'Father', 'Mother', 'Parent')}-in-law`, kind: 'inLaw' };
  }

  return { label: BY_MARRIAGE_EN, kind: 'other' };
}

// ─── Exported Marathi kinship types ───

export type HopMeta = {
  fromId: string;
  toId: string;
  dir: 'up' | 'down' | 'spouse';
  fromGender: Gender;
  toGender: Gender;
};

export interface MarathiKinshipConfig {
  useAtobaForAatyaHusband: boolean;     // आतोबा for आत्या's husband
  useMaavsaForMaavshiHusband: boolean;  // मावसा for मावशी's husband
}

export const DEFAULT_MARATHI_CONFIG: MarathiKinshipConfig = {
  useAtobaForAatyaHusband: true,
  useMaavsaForMaavshiHusband: true,
};

// ─── Marathi labels ───
//
// Marathi terms depend on the target's side of the family, so they are worked out from the
// reversed hops (target → source); the word itself still describes the source.

const RELATIVE_MR = 'नातेवाईक';
const BY_MARRIAGE_MR = 'लग्नामुळे नातेवाईक';
const FEMININE_ELDERS = new Set(['आत्या', 'मावशी']);

/** Source's term as an uncle/aunt, given the gender of the parent they are a sibling of. */
function uncleMr(siblingOfGender: Gender, g: Gender): string | null {
  if (g === 'unknown') return null;
  if (siblingOfGender === 'male') return pick(g, 'काका', 'आत्या', '');
  if (siblingOfGender === 'female') return pick(g, 'मामा', 'मावशी', '');
  return null;
}

/** Source's term as a nephew/niece of `elder`, through the elder's sibling. */
function nephewMr(elder: Gender, sibling: Gender, g: Gender): string {
  if (sibling === 'male' && elder === 'male') return pick(g, 'पुतण्या', 'पुतणी', 'पुतण्या/पुतणी');
  if (sibling === 'female' || elder === 'female') return pick(g, 'भाचा', 'भाची', 'भाचा/भाची');
  return pick(g, 'पुतण्या/भाचा', 'पुतणी/भाची', RELATIVE_MR);
}

function cousinPrefix(targetParent: Gender, auntOrUncle: Gender): string {
  if (targetParent === 'female') return auntOrUncle === 'female' ? 'मावस' : 'मामे';
  if (targetParent === 'male' && auntOrUncle === 'female') return 'आत्ये';
  return 'चुलत';
}

const genderAt = (hops: HopMeta[], i: number): Gender => hops[i]?.toGender ?? 'unknown';
const spouseWord = (g: Gender) => (g === 'male' ? 'पती' : g === 'female' ? 'पत्नी' : null);

function bloodMr(hr: HopMeta[], g: Gender, tg: Gender): string {
  const { up: U, down: D } = countSteps(hr.map(h => h.dir));

  if (D === 0) {
    if (U === 1) return pick(g, 'वडील', 'आई', 'पालक');
    if (U === 2) return pick(g, 'आजोबा', 'आजी', 'आजोबा/आजी');
    if (U === 3) return pick(g, 'पणजोबा', 'पणजी', 'पणजोबा/पणजी');
    if (U === 4) return pick(g, 'खापरपणजोबा', 'खापरपणजी', 'खापरपणजोबा/खापरपणजी');
    return 'पूर्वज';
  }
  if (U === 0) {
    if (D === 1) return pick(g, 'मुलगा', 'मुलगी', 'मूल');
    if (D === 2) return pick(g, 'नातू', 'नात', 'नातवंड');
    if (D === 3) return pick(g, 'पणतू', 'पणती', 'पणतवंड');
    if (D === 4) return pick(g, 'खापरपणतू', 'खापरपणती', 'खापरपणतवंड');
    return 'वंशज';
  }
  if (U === 1 && D === 1) return pick(g, 'भाऊ', 'बहीण', 'भावंड');
  if (U === 2 && D === 1) return uncleMr(genderAt(hr, 0), g) ?? RELATIVE_MR;
  if (U === 1 && D === 2) return nephewMr(tg, genderAt(hr, 1), g);
  if (U === 2 && D === 2) {
    return `${cousinPrefix(genderAt(hr, 0), genderAt(hr, 2))} ${pick(g, 'भाऊ', 'बहीण', 'भावंड')}`;
  }
  if (U === 3 && D === 1) {
    // Sibling of a grandparent: the uncle/aunt of the target's parent.
    const parent = genderAt(hr, 0);
    const uncle = uncleMr(genderAt(hr, 1), g);
    if (!uncle || parent === 'unknown') return RELATIVE_MR;
    if (parent === 'male' && uncle === 'काका') return 'चुलत आजोबा';
    return `${parent === 'male' ? 'वडिलां' : 'आई'}${FEMININE_ELDERS.has(uncle) ? 'ची' : 'चे'} ${uncle}`;
  }
  if (U === 1 && D === 3) {
    // Child of the target's nephew or niece.
    const OBLIQUE: Record<string, string> = { 'पुतण्या': 'पुतण्या', 'पुतणी': 'पुतणी', 'भाचा': 'भाच्या', 'भाची': 'भाची' };
    const via = OBLIQUE[nephewMr(tg, genderAt(hr, 1), genderAt(hr, 2))];
    if (!via || g === 'unknown') return RELATIVE_MR;
    return `${via}${pick(g, 'चा', 'ची', 'चे')} ${pick(g, 'मुलगा', 'मुलगी', 'मूल')}`;
  }
  if (U >= 2 && D >= 2) return `चुलत ${pick(g, 'भाऊ', 'बहीण', 'भावंड')}`;
  return RELATIVE_MR;
}

function labelMr(hr: HopMeta[], g: Gender, tg: Gender, config: MarathiKinshipConfig): string {
  const dirs = hr.map(h => h.dir);
  if (dirs.length === 0) return 'तीच व्यक्ती';
  const segments = splitAtSpouses(dirs);
  if (!segments.every(isBloodShape)) return RELATIVE_MR;
  if (segments.length === 1) return bloodMr(hr, g, tg);

  const key = dirs.join(',');
  const spouseIdx = dirs.indexOf('spouse');
  const before = hr.slice(0, spouseIdx);   // target → X
  const after = hr.slice(spouseIdx + 1);   // Y (X's spouse) → source
  const X = hr[spouseIdx].fromGender;
  const Y = hr[spouseIdx].toGender;
  const b = countSteps(before.map(h => h.dir));
  const a = countSteps(after.map(h => h.dir));

  if (segments.length === 2) {
    // ── The target's own spouse leads to the source ──
    if (b.up + b.down === 0) {
      if (a.up + a.down === 0) return pick(g, 'पती', 'पत्नी', 'जोडीदार');
      if (a.down === 0 && a.up === 1) return pick(g, 'सासरे', 'सासू', 'सासू/सासरे');
      if (a.down === 0 && a.up === 2) return pick(g, 'आजेसासरे', 'आजेसासू', 'आजेसासू/आजेसासरे');
      if (a.up === 0 && a.down === 1) return pick(g, 'सावत्र मुलगा', 'सावत्र मुलगी', 'सावत्र मूल');
      if (a.up === 0 && a.down === 2) return pick(g, 'सावत्र नातू', 'सावत्र नात', 'सावत्र नातवंड');
      if (a.up === 1 && a.down === 1) {
        if (Y === 'male') return pick(g, 'दीर', 'नणंद', RELATIVE_MR);
        if (Y === 'female') return pick(g, 'मेव्हणा', 'मेव्हणी', RELATIVE_MR);
        return pick(g, 'दीर/मेव्हणा', 'नणंद/मेव्हणी', RELATIVE_MR);
      }
      if (a.up === 1 && a.down === 2) return nephewMr(Y, genderAt(after, 1), g);
      const word = spouseWord(Y);
      if (a.up === 2 && a.down === 1) {
        const uncle = uncleMr(genderAt(after, 0), g);
        if (uncle && word) return `${word}${FEMININE_ELDERS.has(uncle) ? 'ची' : 'चे'} ${uncle}`;
      }
      if (a.up === 2 && a.down === 2 && word && g !== 'unknown') {
        const cousin = `${cousinPrefix(genderAt(after, 0), genderAt(after, 2))} ${pick(g, 'भाऊ', 'बहीण', '')}`;
        return `${word}${pick(g, 'चा', 'ची', '')} ${cousin}`;
      }
      return BY_MARRIAGE_MR;
    }

    // ── The source is married to the target's relative X ──
    if (a.up + a.down === 0) {
      if (b.up === 0 && b.down === 1) return pick(g, 'जावई', 'सून', 'जावई/सून');
      if (b.up === 0 && b.down === 2) return pick(g, 'नातजावई', 'नातसून', RELATIVE_MR);
      if (b.down === 0 && b.up === 1) return pick(g, 'सावत्र वडील', 'सावत्र आई', 'सावत्र पालक');
      if (b.down === 0 && b.up === 2) return pick(g, 'सावत्र आजोबा', 'सावत्र आजी', 'सावत्र आजोबा/आजी');
      if (b.up === 1 && b.down === 1) {
        if (X === 'male') return g === 'female' ? 'वहिनी' : RELATIVE_MR;
        if (X === 'female') return g === 'male' ? 'मेव्हणा' : RELATIVE_MR;
        return RELATIVE_MR;
      }
      if (b.up === 1 && b.down === 2) {
        const SPOUSE_OF: Record<string, string> = { 'पुतण्या': 'पुतणसून', 'पुतणी': 'पुतणजावई', 'भाचा': 'भाचेसून', 'भाची': 'भाचेजावई' };
        return SPOUSE_OF[nephewMr(tg, genderAt(before, 1), X)] ?? BY_MARRIAGE_MR;
      }
      if (b.up === 2 && b.down === 1) {
        const parent = genderAt(before, 0);
        if (parent === 'male') {
          if (X === 'male') return g === 'female' ? 'काकू' : g === 'male' ? 'काकूंचे पती' : 'काकू';
          if (X === 'female') {
            if (g !== 'male') return RELATIVE_MR;
            return config.useAtobaForAatyaHusband ? 'आतोबा' : 'आत्याचे पती';
          }
        }
        if (parent === 'female') {
          if (X === 'male') return g === 'female' ? 'मामी' : g === 'male' ? 'मामींचे पती' : 'मामी';
          if (X === 'female') {
            if (g !== 'male') return RELATIVE_MR;
            return config.useMaavsaForMaavshiHusband ? 'मावसा' : 'मावशीचे पती';
          }
        }
        return RELATIVE_MR;
      }
      if (b.up === 2 && b.down === 2) {
        const prefix = cousinPrefix(genderAt(before, 0), genderAt(before, 2));
        if (X === 'male' && g === 'female') return `${prefix} वहिनी`;
        if (X === 'female' && g === 'male') return `${prefix} मेव्हणा`;
      }
      return BY_MARRIAGE_MR;
    }

    // ── Marriage in the middle ──
    if (b.up === 1 && b.down === 0 && a.up === 0 && a.down === 1) {
      return pick(g, 'सावत्र भाऊ', 'सावत्र बहीण', 'सावत्र भावंड');
    }
    if (b.up === 0 && b.down === 1 && a.up === 1 && a.down === 0) {
      return pick(g, 'व्याही', 'विहीण', 'व्याही/विहीण');
    }
    return BY_MARRIAGE_MR;
  }

  // ── Two marriages: जाऊ / साडू, child's spouse through the target's spouse ──
  if (key === 'spouse,up,down,spouse') {
    const sibling = genderAt(hr, 2);
    if (Y === 'male') {
      if (sibling === 'male') return g === 'female' ? 'जाऊ' : RELATIVE_MR;
      if (sibling === 'female') return g === 'male' ? 'नणंदेचे पती' : RELATIVE_MR;
    }
    if (Y === 'female') {
      if (sibling === 'male') return g === 'female' ? 'मेव्हण्याची बायको' : RELATIVE_MR;
      if (sibling === 'female') return g === 'male' ? 'साडू' : RELATIVE_MR;
    }
  }
  if (key === 'spouse,down,spouse') return pick(g, 'जावई', 'सून', 'जावई/सून');
  return BY_MARRIAGE_MR;
}

// ─── Public result type ───

export interface RelationshipResult {
  path: string[];          // member IDs from source → target
  label: string;           // English: what the source is to the target
  labelMr: string;         // Marathi: what the source is to the target
  directions: StepType[];  // 'up' | 'down' | 'spouse' per step
  hops: number;
}

/** A marriage that ended other than by death (death leaves "late husband/wife", not "ex"). */
function isEndedMarriage(a: string, b: string, relationships: StyledRelationships): boolean {
  const marriage = relationships.spouses.find(
    s => (s.spouse1Id === a && s.spouse2Id === b) || (s.spouse1Id === b && s.spouse2Id === a),
  );
  return marriage?.status === 'former' && marriage.endReason !== 'death';
}

// ─── Main export ───

export function computeRelationship(
  sourceId: string,
  targetId: string,
  members: StyledFamilyMember[],
  relationships: StyledRelationships,
  config: MarathiKinshipConfig = DEFAULT_MARATHI_CONFIG
): RelationshipResult | null {
  const path = findRelationshipPath(sourceId, targetId, members, relationships);
  if (!path) return null;

  if (path.length === 1) {
    return { path, label: 'Same person', labelMr: 'तीच व्यक्ती', directions: [], hops: 0 };
  }

  const memberMap = new Map(members.map(mb => [mb.id, mb]));
  const genderOf = (id: string): Gender => memberMap.get(id)?.gender ?? 'unknown';
  const sourceGender = genderOf(sourceId);
  const directions: StepType[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    directions.push(getStepType(path[i], path[i + 1], relationships, members));
  }

  const hopsReversed: HopMeta[] = directions.map((dir, i) => ({
    fromId: path[i + 1],
    toId: path[i],
    dir: (dir === 'up' ? 'down' : dir === 'down' ? 'up' : 'spouse') as StepType,
    fromGender: genderOf(path[i + 1]),
    toGender: genderOf(path[i]),
  })).reverse();

  const english = labelEn(directions, sourceGender);
  let label = english.label;
  let labelMarathi = labelMr(hopsReversed, sourceGender, genderOf(targetId), config);
  const dirKey = directions.join(',');

  // Half-siblings share exactly one of their two known parents.
  if (dirKey === 'up,down') {
    const { parentsOf } = parentChildMaps(members, relationships);
    const ps = parentsOf.get(sourceId) ?? new Set<string>();
    const pt = parentsOf.get(targetId) ?? new Set<string>();
    const shared = Array.from(ps).filter(p => pt.has(p)).length;
    if (ps.size >= 2 && pt.size >= 2 && shared === 1) {
      label = pick(sourceGender, 'Half-brother', 'Half-sister', 'Half-sibling');
      labelMarathi = pick(sourceGender, 'सावत्र भाऊ', 'सावत्र बहीण', 'सावत्र भावंड');
    }
  }

  // Name the side (paternal/maternal) when the connecting parent's gender is known
  const sideId = dirKey === 'down,down' ? path[1] : dirKey === 'up,down,down' ? path[2] : null;
  if (sideId && /^(Grandfather|Grandmother|Uncle|Aunt)$/.test(label)) {
    const g = genderOf(sideId);
    const side = g === 'male' ? 'Paternal' : g === 'female' ? 'Maternal' : '';
    if (side) label = `${side} ${label.toLowerCase()}`;
  }

  const ended = directions.some((d, i) => d === 'spouse' && isEndedMarriage(path[i], path[i + 1], relationships));
  if (ended && english.kind === 'spouse') {
    label = pick(sourceGender, 'Ex-husband', 'Ex-wife', 'Ex-spouse');
    labelMarathi = pick(sourceGender, 'माजी पती', 'माजी पत्नी', 'माजी जोडीदार');
  } else if (ended && english.kind === 'inLaw') {
    label = `Former ${lowerFirst(label)}`;
    if (labelMarathi !== BY_MARRIAGE_MR && labelMarathi !== RELATIVE_MR) labelMarathi = `माजी ${labelMarathi}`;
  }

  return { path, label, labelMr: labelMarathi, directions, hops: path.length - 1 };
}

// ─── Sentence for display ───

// Marathi relation words that take the respectful plural ("…चे … आहेत").
const HONORIFIC_MR = new Set([
  'वडील', 'आजोबा', 'पणजोबा', 'खापरपणजोबा', 'काका', 'मामा', 'आतोबा', 'मावसा', 'सासरे', 'आजेसासरे',
  'व्याही', 'पती', 'नातेवाईक', 'पालक', 'पूर्वज',
]);

/** "Ravi is Amit's father." / "रवी अमितचे वडील आहेत." */
export function describeRelationship(
  result: RelationshipResult,
  sourceName: string,
  targetName: string,
  lang: 'en' | 'mr',
  sourceGender: Gender,
): string {
  if (result.hops === 0) return lang === 'mr' ? result.labelMr : result.label;
  if (lang === 'en') return `${sourceName} is ${targetName}'s ${lowerFirst(result.label)}.`;

  const core = result.labelMr.replace(/\s*\(.*\)$/, '');
  const lastWord = core.split(' ').pop() ?? '';
  const honorific = lastWord.split('/').some(word => HONORIFIC_MR.has(word));
  const possessive = /(चे|ची|चा) /.test(core) ? 'च्या'
    : honorific ? 'चे'
    : pick(sourceGender, 'चा', 'ची', 'चे');
  return `${sourceName} ${targetName}${possessive} ${result.labelMr} ${honorific ? 'आहेत' : 'आहे'}.`;
}
