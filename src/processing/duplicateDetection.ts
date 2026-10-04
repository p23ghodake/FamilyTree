// ─── Duplicate Member Detection ───
//
// Scores every existing member against a candidate (firstName, lastName,
// birthYear) and returns those above a confidence threshold.
//
// Scoring (max 100 + 20 birth-year bonus):
//   First-name similarity  × 40
//   Last-name  similarity  × 40
//   Birth-year exact match : +20
//   Birth-year within ±2   : +10
//
// Thresholds:
//   HIGH   ≥ 80  — very likely the same person
//   MEDIUM ≥ 60  — possibly the same person

import { StyledFamilyMember } from '../types/FamilyTypes';

export interface DuplicateMatch {
  member: StyledFamilyMember;
  score: number;
  level: 'high' | 'medium';
}

// Returns 0–1: how similar two name tokens are.
export function nameSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // Prefix match — shorter string is a complete prefix of the longer one
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length >= 3 && longer.startsWith(shorter)) return 0.8;

  // Shared leading characters (at least 3)
  let shared = 0;
  const minLen = Math.min(na.length, nb.length);
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) shared++;
    else break;
  }
  if (shared >= 3) {
    return 0.5 + (shared / Math.max(na.length, nb.length)) * 0.2;
  }

  return 0;
}

export function scoreMember(
  firstName: string,
  lastName: string,
  birthYear: number | null,
  member: StyledFamilyMember,
): number {
  const firstSim = nameSimilarity(firstName, member.firstName);
  const lastSim  = nameSimilarity(lastName,  member.lastName);

  // Require at least some similarity in both parts to avoid false positives
  // (e.g. don't match purely on last name alone)
  if (firstSim === 0 || lastSim === 0) return 0;

  let score = firstSim * 40 + lastSim * 40;

  if (birthYear !== null && member.birthYear !== null) {
    const diff = Math.abs(birthYear - member.birthYear);
    if (diff === 0) score += 20;
    else if (diff <= 2) score += 10;
  }

  return Math.round(score);
}

export function findDuplicates(
  firstName: string,
  lastName: string,
  birthYear: number | null,
  members: StyledFamilyMember[],
  excludeId?: string,
): DuplicateMatch[] {
  const fn = firstName.trim();
  const ln = lastName.trim();
  if (!fn && !ln) return [];

  const results: DuplicateMatch[] = [];

  for (const member of members) {
    if (excludeId && member.id === excludeId) continue;

    const score = scoreMember(fn, ln, birthYear, member);
    if (score >= 80) {
      results.push({ member, score, level: 'high' });
    } else if (score >= 60) {
      results.push({ member, score, level: 'medium' });
    }
  }

  // Sort high confidence first, then by score descending
  return results.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'high' ? -1 : 1;
    return b.score - a.score;
  });
}
