import { nameSimilarity, scoreMember, findDuplicates } from './duplicateDetection';
import { StyledFamilyMember } from '../types/FamilyTypes';

// ─── Minimal member factory for tests ───
function makeMember(
  id: string,
  firstName: string,
  lastName: string,
  birthYear: number | null = null,
): StyledFamilyMember {
  return {
    id,
    firstName,
    lastName,
    gender: 'unknown',
    birthYear,
    deathYear: null,
    fullName: `${firstName} ${lastName}`.trim(),
    age: null,
    ageCategory: 'adult',
    generationIndex: null,
    baseColorHex: '#aaa',
    baseColorDescription: '',
    nodeBorderColorHex: '#aaa',
    imageConfig: {
      finalImageUrl: '',
      imageSourceType: 'defaultAvatar',
      imageShape: 'circle',
      imageBorderColorHex: '#aaa',
      imageBorderWidthPx: 2,
      imageHasShadow: false,
    },
  } as StyledFamilyMember;
}

// ─── nameSimilarity ───

describe('nameSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(nameSimilarity('Ram', 'ram')).toBe(1);
  });

  it('returns 0 for empty strings', () => {
    expect(nameSimilarity('', 'Ram')).toBe(0);
    expect(nameSimilarity('Ram', '')).toBe(0);
  });

  it('returns 0.8 when shorter is a prefix of longer (≥3 chars)', () => {
    expect(nameSimilarity('Rahu', 'Rahul')).toBe(0.8);
    expect(nameSimilarity('Rahul', 'Rahu')).toBe(0.8);
  });

  it('returns ≥0.5 for ≥3 shared leading characters', () => {
    const score = nameSimilarity('Rajesh', 'Rajiv');
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.8);
  });

  it('returns 0 for completely different names', () => {
    expect(nameSimilarity('Alice', 'Bob')).toBe(0);
  });

  it('returns 0 for short prefix match (<3 chars)', () => {
    expect(nameSimilarity('Ab', 'Abc')).toBe(0);
  });
});

// ─── scoreMember ───

describe('scoreMember', () => {
  it('scores 80 for exact first + last name match, no birth year', () => {
    const m = makeMember('1', 'Ram', 'Sharma');
    expect(scoreMember('Ram', 'Sharma', null, m)).toBe(80);
  });

  it('scores 100 for exact first + last name + exact birth year', () => {
    const m = makeMember('1', 'Ram', 'Sharma', 1970);
    expect(scoreMember('Ram', 'Sharma', 1970, m)).toBe(100);
  });

  it('adds +10 for birth year within ±2', () => {
    const m = makeMember('1', 'Ram', 'Sharma', 1970);
    expect(scoreMember('Ram', 'Sharma', 1972, m)).toBe(90);
  });

  it('gives no birth year bonus beyond ±2', () => {
    const m = makeMember('1', 'Ram', 'Sharma', 1970);
    const score = scoreMember('Ram', 'Sharma', 1975, m);
    expect(score).toBe(80); // no birth year bonus
  });

  it('returns 0 when first name has no similarity', () => {
    const m = makeMember('1', 'Ram', 'Sharma');
    expect(scoreMember('Alice', 'Sharma', null, m)).toBe(0);
  });

  it('returns 0 when last name has no similarity', () => {
    const m = makeMember('1', 'Ram', 'Sharma');
    expect(scoreMember('Ram', 'Patel', null, m)).toBe(0);
  });
});

// ─── findDuplicates ───

describe('findDuplicates', () => {
  const members = [
    makeMember('a', 'Ram',   'Sharma', 1970),
    makeMember('b', 'Rama',  'Sharma', 1971),  // fuzzy first name match
    makeMember('c', 'Sita',  'Sharma', 1975),  // different first name
    makeMember('d', 'Alice', 'Jones',  1970),  // completely different
    makeMember('e', 'Ram',   'Patel',  1970),  // same first, different last
  ];

  it('returns empty array when both name fields are empty', () => {
    expect(findDuplicates('', '', null, members)).toHaveLength(0);
  });

  it('detects exact match as HIGH confidence', () => {
    const results = findDuplicates('Ram', 'Sharma', 1970, members);
    expect(results.some(r => r.member.id === 'a' && r.level === 'high')).toBe(true);
  });

  it('detects fuzzy first name as MEDIUM or HIGH confidence', () => {
    const results = findDuplicates('Ram', 'Sharma', null, members);
    const b = results.find(r => r.member.id === 'b');
    expect(b).toBeDefined();
    expect(['high', 'medium']).toContain(b!.level);
  });

  it('excludes member with given excludeId', () => {
    const results = findDuplicates('Ram', 'Sharma', 1970, members, 'a');
    expect(results.find(r => r.member.id === 'a')).toBeUndefined();
  });

  it('does not flag completely different names', () => {
    const results = findDuplicates('Ram', 'Sharma', null, members);
    expect(results.find(r => r.member.id === 'd')).toBeUndefined();
  });

  it('does not flag same first name with different last name', () => {
    const results = findDuplicates('Ram', 'Sharma', null, members);
    expect(results.find(r => r.member.id === 'e')).toBeUndefined();
  });

  it('sorts HIGH confidence before MEDIUM', () => {
    const results = findDuplicates('Rama', 'Sharma', 1971, members);
    if (results.length >= 2) {
      const firstHigh = results.findIndex(r => r.level === 'high');
      const firstMedium = results.findIndex(r => r.level === 'medium');
      if (firstHigh !== -1 && firstMedium !== -1) {
        expect(firstHigh).toBeLessThan(firstMedium);
      }
    }
  });
});
