import { RawFamilyMember } from '../types/FamilyTypes';
import { CONFIG } from '../constants/config';

const GENERATION_GAP = CONFIG.generation.GAP_YEARS;

/**
 * Assign a generation index to every member.
 *
 * Strategy (in order of preference):
 * 1. Graph-based topological sort using embedded `parentIds`.
 *    Generation = max(parent generations) + 1, starting at 1 for roots.
 * 2. Birth-year fallback for members with no parent/child relationships
 *    (disconnected nodes or data with no relationship info).
 */
export function detectGenerations(members: RawFamilyMember[]): Map<string, number | null> {
  const result = new Map<string, number | null>();
  const memberIds = new Set(members.map(m => m.id));

  // Build adjacency from embedded parentIds (populated by enrichMembersFromRelationships)
  const childrenOf = new Map<string, string[]>();
  const parentsOf  = new Map<string, string[]>();

  for (const m of members) {
    for (const pid of (m.parentIds ?? [])) {
      if (!memberIds.has(pid)) continue;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(m.id);
      if (!parentsOf.has(m.id)) parentsOf.set(m.id, []);
      parentsOf.get(m.id)!.push(pid);
    }
  }

  const connected = members.filter(m => (parentsOf.get(m.id)?.length ?? 0) > 0 || (childrenOf.get(m.id)?.length ?? 0) > 0);

  if (connected.length > 0) {
    // Kahn's topological sort — handles multiple parents correctly
    const inDegree = new Map<string, number>();
    for (const m of members) {
      inDegree.set(m.id, (parentsOf.get(m.id) ?? []).filter(p => memberIds.has(p)).length);
    }

    const queue = members.filter(m => (inDegree.get(m.id) ?? 0) === 0).map(m => m.id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      const parents = (parentsOf.get(id) ?? []).filter(p => memberIds.has(p));

      if (parents.length === 0) {
        result.set(id, 1); // root node
      } else {
        const maxParentGen = Math.max(...parents.map(p => result.get(p) ?? 1));
        result.set(id, maxParentGen + 1);
      }

      for (const childId of (childrenOf.get(id) ?? [])) {
        const remaining = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, remaining);
        if (remaining === 0) queue.push(childId);
      }
    }

    // Nodes not reached by topo sort are in cycles — mark null
    for (const m of members) {
      if (!result.has(m.id)) result.set(m.id, null);
    }
  } else {
    // No relationship data at all — fall back entirely to birth-year math
    assignByBirthYear(members, result);
  }

  // Any remaining isolated nodes (not in the connected graph) fall back to birth year
  const isolated = members.filter(m => !result.has(m.id));
  if (isolated.length > 0) assignByBirthYear(isolated, result);

  return result;
}

function assignByBirthYear(members: RawFamilyMember[], result: Map<string, number | null>): void {
  const birthYears = members
    .filter(m => m.birthYear !== null && m.birthYear !== undefined)
    .map(m => m.birthYear as number);

  if (birthYears.length === 0) {
    members.forEach(m => result.set(m.id, null));
    return;
  }

  const minBirthYear = Math.min(...birthYears);
  members.forEach(m => {
    if (m.birthYear === null || m.birthYear === undefined) {
      result.set(m.id, null);
    } else {
      result.set(m.id, Math.floor((m.birthYear - minBirthYear) / GENERATION_GAP) + 1);
    }
  });
}

