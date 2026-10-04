import { StyledFamilyMember, StyledRelationships } from '../types/FamilyTypes';

// ─── Build bidirectional adjacency map ───

function buildAdjacency(
  members: StyledFamilyMember[],
  relationships: StyledRelationships
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  relationships.parentChild.forEach(r => add(r.parentId, r.childId));
  relationships.spouses.forEach(r => add(r.spouse1Id, r.spouse2Id));

  // Also use embedded member data as fallback
  members.forEach(m => {
    (m.parentIds ?? []).forEach(pid => add(m.id, pid));
    if (m.spouseId) add(m.id, m.spouseId);
    (m.childrenIds ?? []).forEach(cid => add(m.id, cid));
  });

  return adj;
}

// ─── BFS shortest path ───

export function findRelationshipPath(
  sourceId: string,
  targetId: string,
  members: StyledFamilyMember[],
  relationships: StyledRelationships
): string[] | null {
  if (sourceId === targetId) return [sourceId];

  const adj = buildAdjacency(members, relationships);
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

// ─── Build hop metadata ───

function buildHopsMeta(
  path: string[],
  directions: StepType[],
  memberMap: Map<string, StyledFamilyMember>
): HopMeta[] {
  return directions.map((dir, i) => ({
    fromId: path[i],
    toId: path[i + 1],
    dir,
    fromGender: memberMap.get(path[i])?.gender ?? 'unknown',
    toGender: memberMap.get(path[i + 1])?.gender ?? 'unknown',
  }));
}

// ─── Ordinal helper ───

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ─── Blood relationship label ───

function bloodRelationship(ups: number, downs: number, male: boolean, female: boolean): string {
  if (ups === 0 && downs === 0) return 'Same person';

  if (downs === 0) {
    if (ups === 1) return male ? 'Father' : female ? 'Mother' : 'Parent';
    if (ups === 2) return male ? 'Grandfather' : female ? 'Grandmother' : 'Grandparent';
    const prefix = Array(ups - 2).fill('Great-').join('');
    return `${prefix}${male ? 'Grandfather' : female ? 'Grandmother' : 'Grandparent'}`;
  }

  if (ups === 0) {
    if (downs === 1) return male ? 'Son' : female ? 'Daughter' : 'Child';
    if (downs === 2) return male ? 'Grandson' : female ? 'Granddaughter' : 'Grandchild';
    const prefix = Array(downs - 2).fill('Great-').join('');
    return `${prefix}${male ? 'Grandson' : female ? 'Granddaughter' : 'Grandchild'}`;
  }

  if (ups === 1 && downs === 1) return male ? 'Brother' : female ? 'Sister' : 'Sibling';
  if (ups === 2 && downs === 1) return male ? 'Uncle' : female ? 'Aunt' : 'Uncle/Aunt';
  if (ups === 1 && downs === 2) return male ? 'Nephew' : female ? 'Niece' : 'Nephew/Niece';
  if (ups === 3 && downs === 1) return male ? 'Great-uncle' : female ? 'Great-aunt' : 'Great-uncle/Aunt';
  if (ups === 1 && downs === 3) return male ? 'Great-nephew' : female ? 'Great-niece' : 'Great-nephew/Niece';

  // Cousin calculation
  const min = Math.min(ups, downs);
  const max = Math.max(ups, downs);
  if (min >= 2) {
    const level = min - 1;
    const removed = max - min;
    const ord = ordinal(level);
    return removed === 0 ? `${ord} cousin` : `${ord} cousin ${removed}x removed`;
  }

  return `Relative (${ups}↑ ${downs}↓)`;
}

// ─── Full label from direction sequence ───
//
// The display reads "Source is Target's [label]", so every gender-specific
// term must reflect SOURCE's gender, not the target's.
//
// bloodRelationship(ups, downs) treats:
//   ups   = generations SOURCE is ABOVE target  → path direction is DOWN
//   downs = generations SOURCE is BELOW target  → path direction is UP
// so the raw path UP/DOWN counts must be swapped when passed to bloodRelationship.

function labelFromDirections(
  directions: StepType[],
  sourceGender: 'male' | 'female' | 'unknown'
): string {
  const m = sourceGender === 'male';
  const f = sourceGender === 'female';

  // ── Direct spouse ──────────────────────────────────────────────────────────
  if (directions.length === 1 && directions[0] === 'spouse') {
    return m ? 'Husband' : f ? 'Wife' : 'Spouse';
  }

  const hasSpouse = directions.includes('spouse');

  // ── Pure blood (no marriage step in path) ─────────────────────────────────
  if (!hasSpouse) {
    const pathUps   = directions.filter(d => d === 'up').length;
    const pathDowns = directions.filter(d => d === 'down').length;
    // Swap: path-downs = source above target, path-ups = source below target
    return bloodRelationship(pathDowns, pathUps, m, f);
  }

  // ── Path contains a marriage step ─────────────────────────────────────────
  //
  // Split at the FIRST spouse step:
  //   before = blood path from source to the "bridge" person
  //   after  = steps from bridge's spouse onward to target
  //
  // A trailing spouse in 'after' means the target is the blood-relative's
  // spouse (e.g. [spouse, up, spouse] = son/daughter-in-law).
  // This is semantically different from [spouse, down, spouse] = parent-in-law,
  // so we track the trailing spouse separately rather than stripping it blindly.
  const spouseIdx = directions.findIndex(d => d === 'spouse');
  const before = directions.slice(0, spouseIdx);
  const after  = directions.slice(spouseIdx + 1);

  const bU = before.filter(d => d === 'up').length;
  const bD = before.filter(d => d === 'down').length;
  const beforeHasSpouse = before.includes('spouse');

  const trailingSpouse = after.length > 0 && after[after.length - 1] === 'spouse';
  const afterCore = trailingSpouse ? after.slice(0, -1) : after;
  const aU = afterCore.filter(d => d === 'up').length;
  const aD = afterCore.filter(d => d === 'down').length;
  const afterCoreHasSpouse = afterCore.includes('spouse');

  // Handle clean patterns (no additional spouse hops mid-path)
  if (!beforeHasSpouse && !afterCoreHasSpouse) {

    // ── Spouse at end: Source → blood → [spouse] → Target ─────────────────
    // 'after' is empty (target is directly the person married to the bridge).
    if (aU === 0 && aD === 0 && !trailingSpouse) {
      // [down, spouse]   → source's child's spouse   → Father/Mother-in-law
      if (bU === 0 && bD === 1) return m ? 'Father-in-law' : f ? 'Mother-in-law' : 'Parent-in-law';
      // [up, spouse]     → source's parent's spouse  → source is step-child
      if (bU === 1 && bD === 0) return m ? 'Step-son'       : f ? 'Step-daughter'  : 'Step-child';
      // [up, down, spouse] → source's sibling's spouse → sibling-in-law
      if (bU === 1 && bD === 1) return m ? 'Brother-in-law' : f ? 'Sister-in-law'   : 'Sibling-in-law';
      // [down, down, spouse] → grandchild's spouse
      if (bU === 0 && bD === 2) return m ? 'Grandfather-in-law' : f ? 'Grandmother-in-law' : 'Grandparent-in-law';
      // Generic fallback
      const base = bloodRelationship(bD, bU, false, false);
      return `${base}'s ${m ? 'Husband' : f ? 'Wife' : 'Spouse'}`;
    }

    // ── Spouse at start: Source → [spouse] → blood → Target ───────────────
    // Source connects via their own spouse; 'afterCore' is the blood path from
    // source's spouse to target (trailing spouse already stripped above).
    if (bU === 0 && bD === 0) {
      // [spouse, up] / [spouse, up, spouse]
      // Source's spouse's parent → source is child-in-law
      if (aU === 1 && aD === 0) return m ? 'Son-in-law'   : f ? 'Daughter-in-law' : 'Child-in-law';
      // [spouse, down, spouse]
      // Source's spouse's child's spouse → source is parent-in-law
      if (trailingSpouse && aU === 0 && aD === 1) return m ? 'Father-in-law' : f ? 'Mother-in-law' : 'Parent-in-law';
      // [spouse, down]
      // Source's spouse's child (no further hop) → source is step-parent
      if (!trailingSpouse && aU === 0 && aD === 1) return m ? 'Step-father' : f ? 'Step-mother' : 'Step-parent';
      // [spouse, up, up] / [spouse, up, up, spouse] → grandchild-in-law
      if (aU === 2 && aD === 0) return m ? 'Grandson-in-law' : f ? 'Granddaughter-in-law' : 'Grandchild-in-law';
      // [spouse, up, down] / [spouse, up, down, spouse]
      // Source's spouse's sibling → sibling-in-law
      if (aU === 1 && aD === 1) return m ? 'Brother-in-law' : f ? 'Sister-in-law' : 'Sibling-in-law';
      // Generic fallback
      const rel = bloodRelationship(aD, aU, m, f);
      return `Spouse's ${rel}`;
    }

    // ── Spouse in middle: blood → [spouse] → blood ─────────────────────────
    // [up, spouse, down] → step-sibling (source's parent's new-spouse's child)
    if (bU === 1 && bD === 0 && aU === 0 && aD === 1 && !trailingSpouse) {
      return m ? 'Step-brother' : f ? 'Step-sister' : 'Step-sibling';
    }
    // [down, spouse, up] → source's child-in-law's parent → no common term, fall through
  }

  // Generic in-law fallback
  const baseRel = bloodRelationship(bD + aD, bU + aU, m, f);
  return `${baseRel}-in-law`;
}

// ─── Marathi ordinal helper ───

function marathiOrdinal(n: number): string {
  const map: Record<number, string> = {
    1: 'पहिले', 2: 'दुसरे', 3: 'तिसरे', 4: 'चौथे', 5: 'पाचवे',
    6: 'सहावे', 7: 'सातवे', 8: 'आठवे', 9: 'नववे', 10: 'दहावे',
  };
  return map[n] ?? `${n}वे`;
}

// ─── Exported Marathi kinship types ───

export type HopMeta = {
  fromId: string;
  toId: string;
  dir: 'up' | 'down' | 'spouse';
  fromGender: 'male' | 'female' | 'unknown';
  toGender: 'male' | 'female' | 'unknown';
};

export interface MarathiKinshipConfig {
  useAtobaForAatyaHusband: boolean;     // आतोबा for आत्या's husband
  useMaavsaForMaavshiHusband: boolean;  // मावसा for मावशी's husband
}

export const DEFAULT_MARATHI_CONFIG: MarathiKinshipConfig = {
  useAtobaForAatyaHusband: true,
  useMaavsaForMaavshiHusband: true,
};

// ─── Marathi label from reversed hop sequence (target→source perspective) ───

function labelFromDirectionsMr(
  hopsReversed: HopMeta[],
  sourceGender: 'male' | 'female' | 'unknown',
  config: MarathiKinshipConfig = DEFAULT_MARATHI_CONFIG
): string {
  const m = sourceGender === 'male';
  const f = sourceGender === 'female';
  const dirs = hopsReversed.map(h => h.dir);
  const key = dirs.join(',');

  if (dirs.length === 0) return 'तीच व्यक्ती';

  // ── Single hop ────────────────────────────────────────────────────────────
  if (dirs.length === 1) {
    if (dirs[0] === 'up')     return m ? 'वडील' : f ? 'आई' : 'पालक';
    if (dirs[0] === 'down')   return m ? 'मुलगा' : f ? 'मुलगी' : 'मूल';
    return m ? 'नवरा' : f ? 'बायको' : 'जोडीदार';
  }

  const hasSpouse = dirs.includes('spouse');

  // ── Pure blood (no marriage step) ─────────────────────────────────────────
  if (!hasSpouse) {
    const ups   = dirs.filter(d => d === 'up').length;
    const downs = dirs.filter(d => d === 'down').length;

    if (downs === 0) {
      if (ups === 2) return m ? 'आजोबा' : f ? 'आजी' : 'आजोबा/आजी';
      if (ups === 3) return m ? 'पणजोबा' : f ? 'पणजी' : 'पणजोबा/पणजी';
      if (ups >= 4) return 'पूर्वज';
    }

    if (ups === 0) {
      if (downs === 2) return m ? 'नातू' : f ? 'नात' : 'नातवंड';
      if (downs === 3) return m ? 'पणतू' : f ? 'पणती' : 'पणतवंड';
      if (downs >= 4) return 'वंशज';
    }

    if (key === 'up,down') return m ? 'भाऊ' : f ? 'बहीण' : 'भावंड';

    if (key === 'up,up,down') {
      const parentGender = hopsReversed[0].toGender;
      if (parentGender === 'male')   return m ? 'काका' : f ? 'आत्या' : 'नातेवाईक';
      if (parentGender === 'female') return m ? 'मामा' : f ? 'मावशी' : 'नातेवाईक';
      return 'नातेवाईक';
    }

    if (key === 'up,down,down') {
      const siblingGender = hopsReversed[1].toGender;
      if (siblingGender === 'male') return m ? 'पुतण्या' : f ? 'पुतणी' : 'पुतण्या/पुतणी';
      return m ? 'भाच्या' : f ? 'भाची' : 'भाच्या/भाची';
    }

    if (key === 'up,up,down,down') {
      const targetParentGender = hopsReversed[0].toGender;
      const sourceParentGender = hopsReversed[2].toGender;
      if (targetParentGender === 'male') {
        if (sourceParentGender === 'male')   return m ? 'चुलत भाऊ' : f ? 'चुलत बहीण' : 'चुलत भावंड';
        if (sourceParentGender === 'female') return m ? 'आत्ये भाऊ' : f ? 'आत्ये बहीण' : 'आत्ये भावंड';
        return m ? 'चुलत भाऊ' : f ? 'चुलत बहीण' : 'चुलत भावंड';
      }
      if (targetParentGender === 'female') {
        if (sourceParentGender === 'male')   return m ? 'मामे भाऊ' : f ? 'मामे बहीण' : 'मामे भावंड';
        if (sourceParentGender === 'female') return m ? 'मावस भाऊ' : f ? 'मावस बहीण' : 'मावस भावंड';
        return m ? 'मामे भाऊ' : f ? 'मामे बहीण' : 'मामे भावंड';
      }
      return m ? 'चुलत भाऊ' : f ? 'चुलत बहीण' : 'चुलत भावंड';
    }

    // Great-uncle / great-aunt (sibling of a grandparent)
    if (ups === 3 && downs === 1) {
      return m ? 'पणकाका' : f ? 'पणआत्या' : 'नातेवाईक';
    }

    // Great-nephew / great-niece (child of a nephew or niece)
    if (ups === 1 && downs === 3) {
      return m ? 'पणपुतण्या' : f ? 'पणपुतणी' : 'नातेवाईक';
    }

    // 2nd+ cousins — and any 1st cousins not caught by the key check above
    if (ups >= 2 && downs >= 2) {
      const minVal  = Math.min(ups, downs);
      const maxVal  = Math.max(ups, downs);
      const level   = minVal - 1;
      const removed = maxVal - minVal;
      const ord     = marathiOrdinal(level);
      const sibling = m ? 'भाऊ' : f ? 'बहीण' : 'भावंड';
      return removed === 0
        ? `${ord} चुलत ${sibling}`
        : `${ord} चुलत ${sibling}, ${removed} पिढी दूर`;
    }

    return 'नातेवाईक';
  }

  // ── Path contains a marriage step ─────────────────────────────────────────
  const spouseIdx         = dirs.indexOf('spouse');
  const before            = hopsReversed.slice(0, spouseIdx);
  const after             = hopsReversed.slice(spouseIdx + 1);
  const bU                = before.filter(h => h.dir === 'up').length;
  const bD                = before.filter(h => h.dir === 'down').length;
  const bHasSpouse        = before.some(h => h.dir === 'spouse');
  const aU                = after.filter(h => h.dir === 'up').length;
  const aD                = after.filter(h => h.dir === 'down').length;
  const aHasSpouse        = after.some(h => h.dir === 'spouse');
  const spouseHop         = hopsReversed[spouseIdx];
  const targetSpouseGender = spouseHop.toGender;

  if (!bHasSpouse && !aHasSpouse) {

    // ── Spouse at start (before is empty) ──────────────────────────────────
    if (bU === 0 && bD === 0) {
      if (aU === 1 && aD === 0) return m ? 'सासरे' : f ? 'सासू' : 'सासू/सासरे';
      if (aD === 1 && aU === 0) return m ? 'सावत्र मुलगा' : f ? 'सावत्र मुलगी' : 'सावत्र मूल';
      if (aU === 1 && aD === 1) {
        if (targetSpouseGender === 'male')   return m ? 'दीर' : f ? 'नणंद' : 'नातेवाईक';
        if (targetSpouseGender === 'female') return m ? 'मेव्हणा' : f ? 'मेव्हणी' : 'नातेवाईक';
        return m ? 'दीर/मेव्हणा' : f ? 'नणंद/मेव्हणी' : 'नातेवाईक';
      }
      if (aU === 2 && aD === 0) return m ? 'सासरेचे वडील' : f ? 'सासूची आई' : 'नातेवाईक';
    }

    // ── Spouse at end (after is empty) ─────────────────────────────────────
    if (aU === 0 && aD === 0) {
      if (bD === 1 && bU === 0) return m ? 'जावई' : f ? 'सून' : 'जावई/सून';
      if (bU === 1 && bD === 0) return m ? 'सावत्र वडील' : f ? 'सावत्र आई' : 'सावत्र पालक';
      if (bU === 1 && bD === 1) {
        const sibGender = before[1]?.toGender;
        if (sibGender === 'male')   return f ? 'वहिनी' : m ? 'वहिनीचे पती' : 'वहिनी';
        if (sibGender === 'female') return m ? 'भावोजी' : f ? 'भावोजींच्या पत्नी' : 'भावोजी';
        return 'नातेवाईक';
      }
      if (bD === 2 && bU === 0) return m ? 'नातजावई' : f ? 'नातसून' : 'नातेवाईक';
      if (bU === 2 && bD === 1) {
        const tParentGender = before[0]?.toGender;
        const uaGender      = before[2]?.toGender;
        if (tParentGender === 'male') {
          if (uaGender === 'male')   return f ? 'काकू' : m ? 'काकूंचे पती' : 'काकू';
          if (uaGender === 'female') return config.useAtobaForAatyaHusband
            ? (m ? 'आतोबा' : 'नातेवाईक')
            : (m ? 'आत्याचे पती' : 'नातेवाईक');
        }
        if (tParentGender === 'female') {
          if (uaGender === 'male')   return f ? 'मामी' : m ? 'मामींचे पती' : 'मामी';
          if (uaGender === 'female') return config.useMaavsaForMaavshiHusband
            ? (m ? 'मावसा' : 'नातेवाईक')
            : (m ? 'मावशीचे पती' : 'नातेवाईक');
        }
        return 'नातेवाईक';
      }
    }

    // ── Spouse in middle ────────────────────────────────────────────────────
    if (bU === 1 && bD === 0 && aU === 0 && aD === 1) {
      return m ? 'सावत्र भाऊ' : f ? 'सावत्र बहीण' : 'सावत्र भावंड';
    }
  }

  // ── Multi-spouse: spouse,up,down,spouse (जाऊ / साडू etc.) ─────────────────
  if (key === 'spouse,up,down,spouse') {
    const sibGender = hopsReversed[2].toGender;
    if (targetSpouseGender === 'male') {
      if (sibGender === 'male')   return f ? 'जाऊ' : 'नातेवाईक';
      if (sibGender === 'female') return m ? 'नणंदेचे पती' : 'नातेवाईक';
    }
    if (targetSpouseGender === 'female') {
      if (sibGender === 'male')   return f ? 'मेव्हण्याची बायको' : 'नातेवाईक';
      if (sibGender === 'female') return m ? 'साडू' : 'नातेवाईक';
    }
  }

  return 'लग्नातील नाते';
}

// ─── Public result type ───

export interface RelationshipResult {
  path: string[];          // member IDs from source → target
  label: string;           // English label
  labelMr: string;         // Marathi label
  directions: StepType[];  // 'up' | 'down' | 'spouse' per step
  hops: number;
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
  const source = memberMap.get(sourceId);
  const directions: StepType[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    directions.push(getStepType(path[i], path[i + 1], relationships, members));
  }

  const hopsMeta = buildHopsMeta(path, directions, memberMap);
  const hopsReversed: HopMeta[] = [...hopsMeta].reverse().map(h => ({
    fromId: h.toId,
    toId: h.fromId,
    dir: h.dir === 'up' ? 'down' : h.dir === 'down' ? 'up' : 'spouse',
    fromGender: h.toGender,
    toGender: h.fromGender,
  }));

  const label   = labelFromDirections(directions, source?.gender ?? 'unknown');
  const labelMr = labelFromDirectionsMr(hopsReversed, source?.gender ?? 'unknown', config);
  return { path, label, labelMr, directions, hops: path.length - 1 };
}
