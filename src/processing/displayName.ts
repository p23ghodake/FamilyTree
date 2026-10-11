import { RawFamilyMember } from '../types/FamilyTypes';

/** First name only, using the Marathi spelling when available and the language is Marathi. */
export function getDisplayFirstName(
  m: Pick<RawFamilyMember, 'firstName' | 'firstName_mr'>,
  lang: string,
): string {
  return lang === 'mr' && m.firstName_mr ? m.firstName_mr : m.firstName;
}
