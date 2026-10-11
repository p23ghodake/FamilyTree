import { StyledFamilyTree } from '../types/FamilyTypes';

const MIN_CHILD_AGE = { male: 21, female: 18 } as const;

// Accepts "YYYY-MM-DD" or "YYYY-MM" (treated as the last day of the month, the youngest possible age)
function parseBirthDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const day = match[3] ? Number(match[3]) : new Date(year, month, 0).getDate();
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date : null;
}

export function ageOnDate(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function getCurrentSpouseId(tree: StyledFamilyTree, memberId: string): string | null {
  const rel = tree.relationships.spouses.find(
    r => r.status === 'current' && (r.spouse1Id === memberId || r.spouse2Id === memberId)
  );
  if (!rel) return null;
  return rel.spouse1Id === memberId ? rel.spouse2Id : rel.spouse1Id;
}

/** True when any child with a known birth date is a boy under 21 or a girl under 18. */
export function hasUnderageChildren(tree: StyledFamilyTree, memberId: string, now: Date = new Date()): boolean {
  const childIds = new Set(tree.relationships.parentChild.filter(r => r.parentId === memberId).map(r => r.childId));
  return tree.members.some(m => {
    if (!childIds.has(m.id) || m.gender === 'unknown') return false;
    const age = ageOnDate(m.birthDate, now);
    return age !== null && age < MIN_CHILD_AGE[m.gender];
  });
}
