import { StyledFamilyMember, StyledRelationships, SpouseRelationship } from '../types/FamilyTypes';

export interface TreeNode {
  member: StyledFamilyMember;
  /** All current spouses — rendered right with ♥ connectors (supports polygamous/concurrent) */
  currentSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }>;
  formerSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }>;
  children: TreeNode[];
}

const GENDER_RANK: Record<string, number> = { male: 0, female: 1 };

function birthYearOf(member: StyledFamilyMember): number | null {
  if (member.birthYear != null) return member.birthYear;
  const year = Number(member.birthDate?.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

/**
 * Sibling order, left to right: sons, then daughters, then others; each group eldest first.
 * Siblings without a birth year follow the dated ones in their group, in entered order.
 */
export function compareSiblings(a: TreeNode, b: TreeNode): number {
  const rank = (node: TreeNode) => GENDER_RANK[node.member.gender] ?? 2;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  const yearA = birthYearOf(a.member);
  const yearB = birthYearOf(b.member);
  if (yearA === null || yearB === null) return yearA === yearB ? 0 : yearA === null ? 1 : -1;
  if (yearA !== yearB) return yearA - yearB;
  const dateA = a.member.birthDate ?? '';
  const dateB = b.member.birthDate ?? '';
  return dateA && dateB ? dateA.localeCompare(dateB) : 0;
}

export function buildTreeFromMembers(
  allMembers: StyledFamilyMember[],
  relationships: StyledRelationships
): TreeNode[] {
  const memberMap = new Map(allMembers.map(m => [m.id, m]));
  const isChild = new Set<string>();

  // Multi-spouse lookup: memberId → all spouse relationships
  const spousesByMemberId = new Map<string, SpouseRelationship[]>();
  relationships.spouses.forEach(rel => {
    if (!spousesByMemberId.has(rel.spouse1Id)) spousesByMemberId.set(rel.spouse1Id, []);
    if (!spousesByMemberId.has(rel.spouse2Id)) spousesByMemberId.set(rel.spouse2Id, []);
    spousesByMemberId.get(rel.spouse1Id)!.push(rel);
    spousesByMemberId.get(rel.spouse2Id)!.push(rel);
  });

  // Determine who is a child of someone
  relationships.parentChild.forEach(pc => isChild.add(pc.childId));
  allMembers.forEach(m => {
    if (m.parentIds && m.parentIds.length > 0) isChild.add(m.id);
    (m.childrenIds ?? []).forEach(cid => isChild.add(cid));
  });

  // All spouse IDs (current + former) who married-into the family.
  // Read from spousesByMemberId (built from relationships.spouses) so dynamically-added
  // spouses are correctly excluded from rootIds even before member objects are updated.
  const marriedInto = new Set<string>();
  allMembers.forEach(m => {
    if (isChild.has(m.id)) {
      const rels = spousesByMemberId.get(m.id) ?? [];
      rels.forEach(rel => {
        const sid = rel.spouse1Id === m.id ? rel.spouse2Id : rel.spouse1Id;
        if (!isChild.has(sid)) marriedInto.add(sid);
      });
    }
  });

  // Roots = not a child AND not married-into
  const rootIds = allMembers
    .filter(m => !isChild.has(m.id) && !marriedInto.has(m.id))
    .map(m => m.id);

  const processed = new Set<string>();

  // Build children map from parentChild relationships
  const parentToChildren = new Map<string, Set<string>>();
  relationships.parentChild.forEach(({ parentId, childId }) => {
    if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, new Set());
    parentToChildren.get(parentId)!.add(childId);
  });

  function build(memberId: string): TreeNode | null {
    if (processed.has(memberId)) return null;
    const member = memberMap.get(memberId);
    if (!member) return null;
    processed.add(memberId);

    const currentSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }> = [];
    const formerSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }> = [];

    const allRels = spousesByMemberId.get(memberId) ?? [];
    for (const rel of allRels) {
      const spouseId = rel.spouse1Id === memberId ? rel.spouse2Id : rel.spouse1Id;
      const s = memberMap.get(spouseId);
      if (!s || processed.has(s.id)) continue;
      processed.add(s.id);

      if (rel.status === 'current') {
        currentSpouses.push({ member: s, rel });
      } else {
        formerSpouses.push({ member: s, rel });
      }
    }

    // Collect children from member + all spouses
    const childIds = new Set<string>();
    const addChildren = (id: string) => {
      parentToChildren.get(id)?.forEach(c => childIds.add(c));
      memberMap.get(id)?.childrenIds?.forEach(c => childIds.add(c));
    };
    addChildren(memberId);
    currentSpouses.forEach(({ member: cs }) => addChildren(cs.id));
    formerSpouses.forEach(({ member: fs }) => addChildren(fs.id));

    const children = Array.from(childIds)
      .map(cid => build(cid))
      .filter((n): n is TreeNode => n !== null);
    // Sorted after building, so the order never changes which branch claims a shared relative.
    children.sort(compareSiblings);

    return { member, currentSpouses, formerSpouses, children };
  }

  return rootIds
    .map(rid => build(rid))
    .filter((n): n is TreeNode => n !== null);
}
