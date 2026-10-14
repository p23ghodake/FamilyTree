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
  // Side-branch relatives are named by generation gap, like the Marathi चुलत आजोबा / चुलत नातू.
  const gap = down - up;
  if (gap >= 2) return capitalize(greats(gap - 2) + pick(g, 'grandfather', 'grandmother', 'grandparent'));
  if (gap <= -2) return capitalize(greats(-gap - 2) + pick(g, 'grandson', 'granddaughter', 'grandchild'));
  if (gap === 1) return pick(g, 'Uncle', 'Aunt', 'Uncle/aunt');
  if (gap === -1) return pick(g, 'Nephew', 'Niece', 'Nephew/niece');
  return 'Cousin';
}

const cousinSibling = (label: string, g: Gender) =>
  label === 'Cousin' && g !== 'unknown' ? `Cousin ${pick(g, 'brother', 'sister', '')}` : label;

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
      const rel = cousinSibling(bloodLabelEn(b.up, b.down, g), g);
      return { label: b.down > b.up ? rel : `${rel}-in-law`, kind: 'inLaw' };
    }
    if (isEmpty(b)) {
      // The target is married to X, a blood relative of the source.
      if (a.down === 0) return { label: stepLabel(bloodLabelEn(a.up, 0, g)), kind: 'step' };
      const rel = cousinSibling(bloodLabelEn(a.up, a.down, g), g);
      return { label: a.up > a.down ? rel : `${rel}-in-law`, kind: 'inLaw' };
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
    if (mid.up >= 1 && mid.down >= 1) return { label: `${cousinSibling(bloodLabelEn(mid.up, mid.down, g), g)}-in-law`, kind: 'inLaw' };
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
  toBorn?: string | null;  // birth date or year, for age-dependent terms (भाऊजी / दीर)
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

// Keyed by generations the source is above (+) or below (-) the target, across a cousin line.
const DISTANT_MR: Record<number, [string, string]> = {
  2: ['चुलत आजोबा', 'चुलत आजी'],
  3: ['चुलत पणजोबा', 'चुलत पणजी'],
  4: ['चुलत खापरपणजोबा', 'चुलत खापरपणजी'],
  [-2]: ['चुलत नातू', 'चुलत नात'],
  [-3]: ['चुलत पणतू', 'चुलत पणती'],
  [-4]: ['चुलत खापरपणतू', 'चुलत खापरपणती'],
};

function distantMr(gap: number, g: Gender): string {
  const terms = DISTANT_MR[gap];
  if (!terms) return RELATIVE_MR;
  return pick(g, terms[0], terms[1], `${terms[0]}/${terms[1].split(' ')[1]}`);
}

// The spouse's ancestors, one to four generations up.
const IN_LAW_ELDER: [string, string][] = [
  ['सासरे', 'सासू'], ['आजेसासरे', 'आजेसासू'], ['पणजेसासरे', 'पणजेसासू'], ['खापरपणजेसासरे', 'खापरपणजेसासू'],
];
// Spouses of descendants, one to four generations down.
const IN_LAW_YOUNGER: [string, string][] = [
  ['जावई', 'सून'], ['नातजावई', 'नातसून'], ['पणतजावई', 'पणतसून'], ['खापरपणतजावई', 'खापरपणतसून'],
];
const NEPHEW_SPOUSE_MR: Record<string, string> = {
  'पुतण्या': 'पुतणसून', 'पुतणी': 'पुतणजावई', 'भाचा': 'भाचेसून', 'भाची': 'भाचेजावई',
};
// Spouse of an uncle/aunt, with that spouse's gender.
const UNCLE_SPOUSE_MR: Record<string, [string, Gender]> = {
  'काका': ['काकू', 'female'], 'मामा': ['मामी', 'female'], 'आत्या': ['आतोबा', 'male'], 'मावशी': ['मावसा', 'male'],
};

const genderAt = (hops: HopMeta[], i: number): Gender => hops[i]?.toGender ?? 'unknown';
const spouseWord = (g: Gender) => (g === 'male' ? 'पती' : g === 'female' ? 'पत्नी' : null);

/** True/false when both birth dates are known and differ; null otherwise. */
function bornBefore(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  const ya = Number(a.slice(0, 4)), yb = Number(b.slice(0, 4));
  if (ya !== yb) return ya < yb;
  return a.length >= 7 && b.length >= 7 && a !== b ? a < b : null;
}

/** A husband's brother or male cousin: भाऊजी if older than the husband, else दीर (also when ages are unknown). */
const dirMr = (source: HopMeta, husband: HopMeta) =>
  (bornBefore(source.toBorn, husband.toBorn) ? 'भाऊजी' : 'दीर');

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
  // Cousin's child (पुतण्या/भाचा) and parent's cousin (काका/आत्या/मामा/मावशी) follow the sibling rules.
  if (U >= 2 && D === U + 1) return nephewMr(tg, genderAt(hr, U + D - 2), g);
  if (D >= 2 && U === D + 1) {
    const uncle = uncleMr(genderAt(hr, 0), g);
    return uncle === 'काका' ? 'चुलत काका' : uncle ?? RELATIVE_MR;
  }
  if (U >= 1 && D >= 1 && Math.abs(U - D) >= 2) return distantMr(U - D, g);
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
      const word = spouseWord(Y);
      if (a.down === 0) {
        const t = IN_LAW_ELDER[a.up - 1];
        if (t) return pick(g, t[0], t[1], `${t[1]}/${t[0]}`);
        return word ? `${word}चे पूर्वज` : BY_MARRIAGE_MR;
      }
      if (a.up === 0 && a.down === 1) return pick(g, 'सावत्र मुलगा', 'सावत्र मुलगी', 'सावत्र मूल');
      if (a.up === 0 && a.down === 2) return pick(g, 'सावत्र नातू', 'सावत्र नात', 'सावत्र नातवंड');
      if (a.up === 1 && a.down === 1) {
        if (Y === 'male') return pick(g, dirMr(after[after.length - 1], hr[spouseIdx]), 'नणंद', RELATIVE_MR);
        if (Y === 'female') return pick(g, 'मेव्हणा', 'मेव्हणी', RELATIVE_MR);
        return pick(g, 'दीर/मेव्हणा', 'नणंद/मेव्हणी', RELATIVE_MR);
      }
      // Spouse's nephew/niece, or spouse's cousin's child.
      if (a.up >= 1 && a.down === a.up + 1) return nephewMr(Y, genderAt(after, a.up + a.down - 2), g);
      if (a.up >= 1 && a.down >= a.up + 2) return distantMr(a.up - a.down, g);
      if (a.down >= 1 && a.up >= a.down + 2) {
        const t = IN_LAW_ELDER[a.up - a.down - 1];
        return t ? `चुलत ${pick(g, t[0], t[1], `${t[1]}/${t[0]}`)}` : BY_MARRIAGE_MR;
      }
      if (a.down >= 1 && a.up === a.down + 1) {
        // Spouse's uncle/aunt, or spouse's parent's cousin (काका → चुलत काका).
        const uncle = uncleMr(genderAt(after, 0), g);
        const term = uncle === 'काका' && a.down >= 2 ? 'चुलत काका' : uncle;
        if (term && word) return `${word}${FEMININE_ELDERS.has(term) ? 'ची' : 'चे'} ${term}`;
      }
      if (a.up === a.down && a.up >= 2 && Y !== 'unknown' && g !== 'unknown') {
        // The husband's cousins are plain दीर/भाऊजी/नणंद; the wife's keep the cousin prefix.
        if (Y === 'male') return pick(g, dirMr(after[after.length - 1], hr[spouseIdx]), 'नणंद', '');
        const prefix = a.up === 2 ? cousinPrefix(genderAt(after, 0), genderAt(after, 2)) : 'चुलत';
        return `${prefix} ${pick(g, 'मेव्हणा', 'मेव्हणी', '')}`;
      }
      return BY_MARRIAGE_MR;
    }

    // ── The source is married to the target's relative X ──
    if (a.up + a.down === 0) {
      if (b.up === 0) {
        const t = IN_LAW_YOUNGER[b.down - 1];
        if (t) return pick(g, t[0], t[1], b.down === 1 ? 'जावई/सून' : RELATIVE_MR);
        return pick(g, 'वंशजाचे पती', 'वंशजाची पत्नी', BY_MARRIAGE_MR);
      }
      if (b.down === 0 && b.up === 1) return pick(g, 'सावत्र वडील', 'सावत्र आई', 'सावत्र पालक');
      if (b.down === 0 && b.up === 2) return pick(g, 'सावत्र आजोबा', 'सावत्र आजी', 'सावत्र आजोबा/आजी');
      if (b.up === 1 && b.down === 1) {
        if (X === 'male') return g === 'female' ? 'वहिनी' : RELATIVE_MR;
        if (X === 'female') return g === 'male' ? 'मेव्हणा' : RELATIVE_MR;
        return RELATIVE_MR;
      }
      // Spouse of the target's nephew/niece, or of a cousin's child.
      if (b.up >= 1 && b.down === b.up + 1) {
        return NEPHEW_SPOUSE_MR[nephewMr(tg, genderAt(before, b.up + b.down - 2), X)] ?? BY_MARRIAGE_MR;
      }
      if (b.up >= 1 && b.down >= b.up + 2) {
        const t = IN_LAW_YOUNGER[b.down - b.up - 1];
        return t && g !== 'unknown' ? `चुलत ${pick(g, t[0], t[1], '')}` : BY_MARRIAGE_MR;
      }
      // Spouse of the target's uncle/aunt, or of a parent's cousin.
      if (b.down >= 1 && b.up === b.down + 1) {
        const parent = genderAt(before, 0);
        if (parent === 'male') {
          if (X === 'male') {
            const kaku = b.down >= 2 ? 'चुलत काकू' : 'काकू';
            return g === 'male' ? 'काकूंचे पती' : kaku;
          }
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
      if (b.up === 3 && b.down === 1) {
        // Spouse of a grandparent's sibling mirrors the blood term: वडिलांची आत्या → वडिलांचे आतोबा.
        const m = bloodMr(before, X, tg).match(/^(\S+)(ची|चे) (\S+)$/);
        const spouse = m ? UNCLE_SPOUSE_MR[m[3]] : undefined;
        if (m && spouse && spouse[1] === g) return `${m[1]}${g === 'female' ? 'ची' : 'चे'} ${spouse[0]}`;
      }
      if (b.down >= 1 && b.up >= b.down + 2) return distantMr(b.up - b.down, g);
      if (b.up === b.down && b.up >= 2) {
        const prefix = b.up === 2 ? cousinPrefix(genderAt(before, 0), genderAt(before, 2)) : 'चुलत';
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
    return linkedMr(hr, spouseIdx, g, tg, config);
  }

  // ── Two marriages: जाऊ / नणंदोई / साडू between siblings or same-generation cousins, child's spouse through the target's spouse ──
  const mid = segments.length === 3 && segments[0].length === 0 && segments[2].length === 0 ? countSteps(segments[1]) : null;
  if (mid && mid.up >= 1 && mid.up === mid.down) {
    const sibling = genderAt(hr, hr.length - 2);
    if (Y === 'male') {
      if (sibling === 'male') return g === 'female' ? 'जाऊ' : RELATIVE_MR;
      if (sibling === 'female') return g === 'male' ? 'नणंदोई' : RELATIVE_MR;
    }
    if (Y === 'female') {
      if (sibling === 'male') return g === 'female' ? 'मेव्हण्याची बायको' : RELATIVE_MR;
      if (sibling === 'female') return g === 'male' ? 'साडू' : RELATIVE_MR;
    }
  }
  if (mid && mid.down >= 1 && mid.up === mid.down + 1) {
    // The source is married to the target's spouse's uncle/aunt (पतीची काकू).
    const word = spouseWord(Y);
    const uncle = uncleMr(genderAt(hr, 1), genderAt(hr, hr.length - 2));
    const term = uncle ? UNCLE_SPOUSE_MR[uncle] : undefined;
    const name = term && term[0] === 'काकू' && mid.down >= 2 ? 'चुलत काकू' : term?.[0];
    if (term && word && term[1] === g) return `${word}${g === 'female' ? 'ची' : 'चे'} ${name}`;
  }
  if (mid && mid.up >= 1 && mid.down === mid.up + 1) {
    // The source is married to the target's spouse's nephew/niece (पुतणसून).
    const nephew = nephewMr(Y, genderAt(hr, hr.length - 3), genderAt(hr, hr.length - 2));
    return NEPHEW_SPOUSE_MR[nephew] ?? BY_MARRIAGE_MR;
  }
  if (mid && mid.down >= 1 && mid.up >= mid.down + 2) {
    // Married to the target's spouse's grand-uncle/aunt (चुलत आजेसासू).
    const t = IN_LAW_ELDER[mid.up - mid.down - 1];
    if (t && g !== 'unknown') return `चुलत ${pick(g, t[0], t[1], '')}`;
  }
  if (mid && mid.up >= 1 && mid.down >= mid.up + 2) {
    // Married to the target's spouse's grand-nephew/niece (चुलत नातसून).
    const t = IN_LAW_YOUNGER[mid.down - mid.up - 1];
    if (t && g !== 'unknown') return `चुलत ${pick(g, t[0], t[1], '')}`;
  }
  if (key === 'spouse,down,spouse') return pick(g, 'जावई', 'सून', 'जावई/सून');
  return linkedMr(hr, spouseIdx, g, tg, config);
}

// Oblique (possessive) stem of relation words whose form changes before चा/ची/चे.
const OBLIQUE_MR: Record<string, string> = {
  'भाऊ': 'भावा', 'बहीण': 'बहिणी', 'वडील': 'वडिलां', 'आजोबा': 'आजोबां', 'पणजोबा': 'पणजोबां',
  'खापरपणजोबा': 'खापरपणजोबां', 'काका': 'काकां', 'मामा': 'मामां', 'आतोबा': 'आतोबां', 'मुलगा': 'मुला', 'नातू': 'नातवा',
  'नात': 'नाती', 'सून': 'सुने', 'जावई': 'जावया', 'दीर': 'दिरा', 'नणंद': 'नणंदे', 'मेव्हणा': 'मेव्हण्या', 'भाचा': 'भाच्या',
  'सासरे': 'सासऱ्यां', 'आजेसासरे': 'आजेसासऱ्यां', 'व्याही': 'व्याह्यां', 'भाऊजी': 'भाऊजीं',
};
// Compound words take the oblique form of their last part (नातसून → नातसुने, पणजेसासरे → पणजेसासऱ्यां).
const obliqueMr = (word: string) => {
  if (OBLIQUE_MR[word]) return OBLIQUE_MR[word];
  const part = ['सून', 'जावई', 'सासरे'].find(p => word.endsWith(p));
  return part ? word.slice(0, -part.length) + OBLIQUE_MR[part] : word;
};

/** Across a marriage: the linking spouse's term, then the source's term to them ("चुलत आजीचा भाऊ", "जावयाची काकू"). */
function linkedMr(hr: HopMeta[], spouseIdx: number, g: Gender, tg: Gender, config: MarathiKinshipConfig): string {
  const Y = hr[spouseIdx].toGender;
  const link = labelMr(hr.slice(0, spouseIdx + 1), Y, tg, config);
  const own = labelMr(hr.slice(spouseIdx + 1), g, Y, config);
  const vague = (t: string) => t === RELATIVE_MR || t === BY_MARRIAGE_MR || t.includes('/');
  if (vague(link) || vague(own) || /(चा|ची|चे) /.test(link)) return BY_MARRIAGE_MR;

  const words = link.split(' ');
  const last = words.pop()!;
  const possessive = /(चा|ची|चे) /.test(own) ? 'च्या'
    : HONORIFIC_MR.has(own.split(' ').pop()!) ? 'चे'
    : pick(g, 'चा', 'ची', 'चे');
  return `${[...words, obliqueMr(last)].join(' ')}${possessive} ${own}`;
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
  const bornOf = (id: string) => {
    const mb = memberMap.get(id);
    return mb?.birthDate || (mb?.birthYear ? String(mb.birthYear) : null);
  };
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
    toBorn: bornOf(path[i]),
  })).reverse();

  const english = labelEn(directions, sourceGender);
  // Unnamed marriage chains read through the last spouse: "Sister-in-law's father".
  const englishBetween = (from: number, to: number): string => {
    const dirs = directions.slice(from, to);
    const base = labelEn(dirs, genderOf(path[from])).label;
    const k = from + dirs.lastIndexOf('spouse');
    if (base !== BY_MARRIAGE_EN || k <= from) return base;
    const link = labelEn(directions.slice(k, to), genderOf(path[k])).label;
    const own = englishBetween(from, k);
    return /^Relative/.test(link) || /^Relative/.test(own) ? base : `${link}'s ${lowerFirst(own)}`;
  };
  let label = english.label === BY_MARRIAGE_EN ? englishBetween(0, directions.length) : english.label;
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
  'व्याही', 'पती', 'नातेवाईक', 'पालक', 'पूर्वज', 'भाऊजी', 'पणजेसासरे', 'खापरपणजेसासरे',
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
