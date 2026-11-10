import { AgeCategory, RawFamilyMember } from '../types/FamilyTypes';
import { CONFIG } from '../constants/config';

export function isMemberDeceased(member: Partial<Pick<RawFamilyMember, 'isDeceased' | 'deathYear' | 'deathDate'>>): boolean {
  return member.isDeceased === true || member.deathYear != null || !!member.deathDate;
}

export function computeAge(birthYear: number | null, deathYear: number | null, deceased = false): number | null {
  if (birthYear === null || birthYear === undefined) return null;
  if (deathYear != null) return deathYear - birthYear;
  if (deceased) return null;
  return new Date().getFullYear() - birthYear;
}

export function getAgeCategory(age: number | null): AgeCategory {
  if (age === null) return 'unknown';
  if (age <= CONFIG.age.INFANT_MAX)  return 'infant';
  if (age <= CONFIG.age.TODDLER_MAX) return 'toddler';
  if (age <= CONFIG.age.YOUTH_MAX)   return 'youth';
  if (age <= CONFIG.age.ADULT_MAX)   return 'adult';
  return 'senior';
}
