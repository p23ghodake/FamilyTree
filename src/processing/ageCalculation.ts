import { AgeCategory } from '../types/FamilyTypes';
import { CONFIG } from '../constants/config';

export function computeAge(birthYear: number | null, deathYear: number | null): number | null {
  if (birthYear === null || birthYear === undefined) return null;
  const currentYear = new Date().getFullYear();
  return deathYear ? deathYear - birthYear : currentYear - birthYear;
}

export function getAgeCategory(age: number | null): AgeCategory {
  if (age === null) return 'unknown';
  if (age <= CONFIG.age.INFANT_MAX)  return 'infant';
  if (age <= CONFIG.age.TODDLER_MAX) return 'toddler';
  if (age <= CONFIG.age.YOUTH_MAX)   return 'youth';
  if (age <= CONFIG.age.ADULT_MAX)   return 'adult';
  return 'senior';
}
