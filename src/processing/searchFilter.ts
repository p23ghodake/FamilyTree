import { StyledFamilyMember } from '../types/FamilyTypes';

/**
 * Normalise a string for comparison:
 *  1. NFC  – consistent Devanagari combining-character forms
 *  2. lower – Latin case fold
 *  3. NFD → strip combining marks – Latin diacritic-insensitive ("Müller" = "Muller")
 *
 * Devanagari base characters are unaffected by step 3 because their Unicode
 * combining marks (matras, etc.) live outside the U+0300–U+036F block that is stripped.
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Returns true if `member` matches `rawQuery`.
 * Searches: EN full name, MR full name (combined), MR first/last individually,
 * occupation, location.
 */
export function memberMatchesQuery(member: StyledFamilyMember, rawQuery: string): boolean {
  if (!rawQuery.trim()) return true;
  const q = normalizeForSearch(rawQuery);
  const mrFull = `${member.firstName_mr ?? ''} ${member.lastName_mr ?? ''}`.trim();
  return (
    normalizeForSearch(`${member.firstName} ${member.lastName}`).includes(q) ||
    (mrFull !== '' && normalizeForSearch(mrFull).includes(q))                ||
    (!!member.firstName_mr && normalizeForSearch(member.firstName_mr).includes(q)) ||
    (!!member.lastName_mr  && normalizeForSearch(member.lastName_mr).includes(q))  ||
    (!!member.occupation   && normalizeForSearch(member.occupation).includes(q))   ||
    (!!member.location     && normalizeForSearch(member.location).includes(q))
  );
}
