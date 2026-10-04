import { normalizeForSearch, memberMatchesQuery } from './searchFilter';
import { StyledFamilyMember } from '../types/FamilyTypes';

// Minimal member factory
const member = (
  firstName: string,
  lastName: string,
  firstName_mr?: string,
  lastName_mr?: string,
  occupation?: string,
  location?: string
): StyledFamilyMember =>
  ({ id: '1', firstName, lastName, firstName_mr, lastName_mr, occupation, location,
     fullName: `${firstName} ${lastName}` } as unknown as StyledFamilyMember);

// ─── normalizeForSearch ───────────────────────────────────────────────────────

describe('normalizeForSearch', () => {
  it('lowercases Latin', () => {
    expect(normalizeForSearch('Sharma')).toBe('sharma');
  });

  it('strips Latin diacritics', () => {
    expect(normalizeForSearch('Müller')).toBe('muller');
    expect(normalizeForSearch('café')).toBe('cafe');
    expect(normalizeForSearch('naïve')).toBe('naive');
  });

  it('preserves Devanagari base characters (matras outside strip range)', () => {
    expect(normalizeForSearch('शर्मा')).toBe('शर्मा');
    expect(normalizeForSearch('अरुण')).toBe('अरुण');
  });

  it('applies NFC to Devanagari (consistent combining form)', () => {
    // Pre-composed NFC and decomposed NFD of the same Devanagari text should normalise equal
    const nfc = '\u0936\u0930\u094D\u092E\u093E'; // शर्मा NFC
    const nfd = nfc.normalize('NFD');
    expect(normalizeForSearch(nfc)).toBe(normalizeForSearch(nfd));
  });

  it('empty string returns empty string', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});

// ─── memberMatchesQuery ───────────────────────────────────────────────────────

describe('memberMatchesQuery', () => {
  let m: StyledFamilyMember;
  beforeEach(() => {
    m = member('Priya', 'Sharma', 'प्रिया', 'शर्मा', 'Engineer', 'Pune');
  });

  // English
  it('matches EN first name (case-insensitive)', () => {
    expect(memberMatchesQuery(m, 'priya')).toBe(true);
    expect(memberMatchesQuery(m, 'PRIYA')).toBe(true);
  });

  it('matches EN last name substring', () => {
    expect(memberMatchesQuery(m, 'shar')).toBe(true);
  });

  it('matches EN full name combined', () => {
    expect(memberMatchesQuery(m, 'Priya Sharma')).toBe(true);
  });

  it('matches EN with diacritic stripping', () => {
    const mDiacritic = member('Müller', 'König');
    expect(memberMatchesQuery(mDiacritic, 'muller')).toBe(true);
    expect(memberMatchesQuery(mDiacritic, 'konig')).toBe(true);
  });

  // Marathi — individual fields
  it('matches MR first name', () => {
    expect(memberMatchesQuery(m, 'प्रिया')).toBe(true);
  });

  it('matches MR last name', () => {
    expect(memberMatchesQuery(m, 'शर्मा')).toBe(true);
  });

  // FIX 1: Combined Marathi full name
  it('matches MR full name combined (fix: was broken before)', () => {
    expect(memberMatchesQuery(m, 'प्रिया शर्मा')).toBe(true);
  });

  it('does NOT cross-match EN query against MR field (no transliteration)', () => {
    // "sharma" in Latin should NOT match "शर्मा" in Devanagari
    expect(memberMatchesQuery(m, 'sharma')).toBe(true);  // matches EN lastName
    // but a member with only MR name should not match Latin query
    const mrOnly = member('', '', 'राज', 'पाटील');
    expect(memberMatchesQuery(mrOnly, 'raj')).toBe(false);
  });

  // Occupation & location
  it('matches occupation', () => {
    expect(memberMatchesQuery(m, 'engineer')).toBe(true);
    expect(memberMatchesQuery(m, 'ENGINEER')).toBe(true);
  });

  it('matches location', () => {
    expect(memberMatchesQuery(m, 'pune')).toBe(true);
  });

  // Edge cases
  it('empty query always matches', () => {
    expect(memberMatchesQuery(m, '')).toBe(true);
    expect(memberMatchesQuery(m, '   ')).toBe(true);
  });

  it('no match returns false', () => {
    expect(memberMatchesQuery(m, 'zzznomatch')).toBe(false);
  });

  it('handles member with no MR names gracefully', () => {
    const noMr = member('Raj', 'Patil');
    expect(memberMatchesQuery(noMr, 'raj')).toBe(true);
    expect(memberMatchesQuery(noMr, 'शर्मा')).toBe(false);
  });

  it('MR partial substring match', () => {
    expect(memberMatchesQuery(m, 'प्रि')).toBe(true);
    expect(memberMatchesQuery(m, 'र्मा')).toBe(true);
  });

  it('member with null firstName_mr does not throw', () => {
    const nullMrFirst = member('Raj', 'Patil', null as any, 'पाटील');
    expect(() => memberMatchesQuery(nullMrFirst, 'raj')).not.toThrow();
    expect(memberMatchesQuery(nullMrFirst, 'raj')).toBe(true);
  });

  it('very long query (500+ chars) does not throw and returns false when no match', () => {
    const longQuery = 'a'.repeat(500);
    expect(() => memberMatchesQuery(m, longQuery)).not.toThrow();
    expect(memberMatchesQuery(m, longQuery)).toBe(false);
  });

  it('all-whitespace query matches all members', () => {
    expect(memberMatchesQuery(m, '     ')).toBe(true);
  });
});
