import { StyledFamilyMember, StyledRelationships, SpouseRelationship } from '../types/FamilyTypes';

export interface TreeNode {
  member: StyledFamilyMember;
  /** All current spouses — rendered right with ♥ connectors (supports polygamous/concurrent) */
  currentSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }>;
  formerSpouses: Array<{ member: StyledFamilyMember; rel: SpouseRelationship }>;
  children: TreeNode[];
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

    return { member, currentSpouses, formerSpouses, children };
  }

  return rootIds
    .map(rid => build(rid))
    .filter((n): n is TreeNode => n !== null);
}

export function computeLineage(
  memberId: string,
  members: StyledFamilyMember[],
  relationships: StyledRelationships
): Set<string> {
  const result = new Set<string>();
  result.add(memberId);

  // Build parent and child maps from both relationship records and member fields
  const parentMap = new Map<string, string[]>();
  const childMap  = new Map<string, string[]>();

  const addEdge = (parentId: string, childId: string) => {
    if (!parentMap.has(childId)) parentMap.set(childId, []);
    if (!parentMap.get(childId)!.includes(parentId)) parentMap.get(childId)!.push(parentId);
    if (!childMap.has(parentId)) childMap.set(parentId, []);
    if (!childMap.get(parentId)!.includes(childId)) childMap.get(parentId)!.push(childId);
  };

  relationships.parentChild.forEach(({ parentId, childId }) => addEdge(parentId, childId));
  members.forEach(m => {
    m.parentIds?.forEach(pid => addEdge(pid, m.id));
    m.childrenIds?.forEach(cid => addEdge(m.id, cid));
  });

  const walkUp = (id: string) => {
    (parentMap.get(id) ?? []).forEach(pid => {
      if (!result.has(pid)) { result.add(pid); walkUp(pid); }
    });
  };
  const walkDown = (id: string) => {
    (childMap.get(id) ?? []).forEach(cid => {
      if (!result.has(cid)) { result.add(cid); walkDown(cid); }
    });
  };

  walkUp(memberId);
  walkDown(memberId);

  // Include the member's own spouses
  relationships.spouses.forEach(r => {
    if (r.spouse1Id === memberId) result.add(r.spouse2Id);
    if (r.spouse2Id === memberId) result.add(r.spouse1Id);
  });

  return result;
}
