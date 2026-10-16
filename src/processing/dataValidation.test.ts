import { validateRawFamilyData, sanitizeImageUrl, containsDigit, isFutureYear, isFutureDate, findFutureDate } from './dataValidation';
import { processAllFamilyData } from './dataProcessor';

const validTree = {
  familyTreeId: 't1',
  familyTreeDisplayName: 'Test Family',
  members: [
    { id: 'a', firstName: 'Anil', lastName: 'Sharma', gender: 'male', birthYear: 1950, deathYear: null },
    { id: 'b', firstName: 'Bela', lastName: 'Sharma', gender: 'female', birthYear: 1955, deathYear: null },
    { id: 'c', firstName: 'Chetan', lastName: 'Sharma', gender: 'male', birthYear: 1980, deathYear: null },
  ],
  relationships: {
    spouses: [{ spouse1Id: 'a', spouse2Id: 'b' }],
    parentChild: [{ parentId: 'a', childId: 'c' }],
  },
};

const validData = () => ({ familyTrees: [JSON.parse(JSON.stringify(validTree))] });

describe('sanitizeImageUrl', () => {
  it('returns null for empty/nullish input', () => {
    expect(sanitizeImageUrl(null)).toBeNull();
    expect(sanitizeImageUrl(undefined)).toBeNull();
    expect(sanitizeImageUrl('   ')).toBeNull();
  });

  it('allows http and https URLs', () => {
    expect(sanitizeImageUrl('http://example.com/p.png')).toBe('http://example.com/p.png');
    expect(sanitizeImageUrl('https://example.com/p.png')).toBe('https://example.com/p.png');
  });

  it('allows data:image URLs', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeImageUrl(url)).toBe(url);
  });

  it('rejects javascript: and other unsafe schemes', () => {
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeImageUrl('data:text/html,<script>1</script>')).toBeNull();
    expect(sanitizeImageUrl('ftp://example.com/p.png')).toBeNull();
  });

  it('rejects non-URL strings', () => {
    expect(sanitizeImageUrl('not a url')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeImageUrl('  https://example.com/p.png  ')).toBe('https://example.com/p.png');
  });
});

describe('validateRawFamilyData — structural rejection', () => {
  it('rejects non-object input', () => {
    expect(validateRawFamilyData(null).ok).toBe(false);
    expect(validateRawFamilyData('string').ok).toBe(false);
    expect(validateRawFamilyData([]).ok).toBe(false);
  });

  it('rejects data without a familyTrees array', () => {
    const result = validateRawFamilyData({ foo: 'bar' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/familyTrees/);
  });

  it('rejects an empty familyTrees array', () => {
    const result = validateRawFamilyData({ familyTrees: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects a tree missing familyTreeId', () => {
    const data = validData();
    delete (data.familyTrees[0] as any).familyTreeId;
    expect(validateRawFamilyData(data).ok).toBe(false);
  });

  it('rejects a tree missing a members array', () => {
    const data = validData();
    delete (data.familyTrees[0] as any).members;
    expect(validateRawFamilyData(data).ok).toBe(false);
  });

  it('rejects a member missing an id', () => {
    const data = validData();
    delete (data.familyTrees[0].members[0] as any).id;
    expect(validateRawFamilyData(data).ok).toBe(false);
  });

  it('rejects a member missing a name', () => {
    const data = validData();
    delete (data.familyTrees[0].members[0] as any).firstName;
    expect(validateRawFamilyData(data).ok).toBe(false);
  });

  it('rejects duplicate member ids', () => {
    const data = validData();
    data.familyTrees[0].members[1].id = 'a';
    const result = validateRawFamilyData(data);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });
});

describe('validateRawFamilyData — success & repair', () => {
  it('accepts well-formed data', () => {
    const result = validateRawFamilyData(validData());
    expect(result.ok).toBe(true);
    expect(result.data?.familyTrees).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('drops spouse edges referencing unknown members and warns', () => {
    const data = validData();
    data.familyTrees[0].relationships.spouses.push({ spouse1Id: 'a', spouse2Id: 'ghost' });
    const result = validateRawFamilyData(data);
    expect(result.ok).toBe(true);
    expect(result.data?.familyTrees[0].relationships!.spouses).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('drops parent-child edges referencing unknown members', () => {
    const data = validData();
    data.familyTrees[0].relationships.parentChild.push({ parentId: 'ghost', childId: 'c' });
    const result = validateRawFamilyData(data);
    expect(result.data?.familyTrees[0].relationships!.parentChild).toHaveLength(1);
  });

  it('drops self-referencing parent-child edges', () => {
    const data = validData();
    data.familyTrees[0].relationships.parentChild.push({ parentId: 'a', childId: 'a' });
    const result = validateRawFamilyData(data);
    expect(result.data?.familyTrees[0].relationships!.parentChild).toHaveLength(1);
    expect(result.warnings.some(w => /self-referencing/.test(w))).toBe(true);
  });

  it('defaults invalid gender to unknown and warns', () => {
    const data = validData();
    (data.familyTrees[0].members[0] as any).gender = 'other';
    const result = validateRawFamilyData(data);
    expect(result.data?.familyTrees[0].members[0].gender).toBe('unknown');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('strips unsafe image URLs and warns', () => {
    const data = validData();
    (data.familyTrees[0].members[0] as any).imageUrl = 'javascript:alert(1)';
    const result = validateRawFamilyData(data);
    expect(result.data?.familyTrees[0].members[0].imageUrl).toBeNull();
    expect(result.warnings.some(w => /image URL/i.test(w))).toBe(true);
  });

  it('preserves safe image URLs', () => {
    const data = validData();
    (data.familyTrees[0].members[0] as any).imageUrl = 'https://example.com/p.png';
    const result = validateRawFamilyData(data);
    expect(result.data?.familyTrees[0].members[0].imageUrl).toBe('https://example.com/p.png');
  });

  it('tolerates a missing relationships object', () => {
    const data = validData();
    delete (data.familyTrees[0] as any).relationships;
    const result = validateRawFamilyData(data);
    expect(result.ok).toBe(true);
    expect(result.data?.familyTrees[0].relationships!.spouses).toHaveLength(0);
  });

  it('normalizes legacy embedded relationships before rebuilding member fields', () => {
    const data = validData();
    delete data.familyTrees[0].relationships;
    Object.assign(data.familyTrees[0].members[0], { spouseId: 'b', childrenIds: ['c', 'ghost'] });
    Object.assign(data.familyTrees[0].members[1], { spouseId: 'a' });
    Object.assign(data.familyTrees[0].members[2], { parentIds: ['a'] });
    const result = validateRawFamilyData(data);
    expect(result.ok).toBe(true);
    expect(result.data?.familyTrees[0].relationships?.spouses).toHaveLength(1);
    expect(result.data?.familyTrees[0].relationships?.parentChild).toEqual([{ parentId: 'a', childId: 'c' }]);
    const processed = processAllFamilyData(result.data!);
    expect(processed.familyTreesStyled[0].members[2].parentIds).toEqual(['a']);
    expect(processed.familyTreesStyled[0].members[0].childrenIds).toEqual(['c']);
  });

  it('ignores stale embedded fields when canonical relationships are provided', () => {
    const data = validData();
    Object.assign(data.familyTrees[0].members[2], { parentIds: ['ghost'] });
    const result = validateRawFamilyData(data);
    const processed = processAllFamilyData(result.data!);
    expect(processed.familyTreesStyled[0].members[2].parentIds).toEqual(['a']);
  });
});

describe('containsDigit', () => {
  it('detects ASCII and Devanagari digits', () => {
    expect(containsDigit('Ravi2')).toBe(true);
    expect(containsDigit('राम२')).toBe(true);
  });

  it('allows names without digits', () => {
    expect(containsDigit("Anne-Marie O'Neil")).toBe(false);
    expect(containsDigit('राम')).toBe(false);
    expect(containsDigit('')).toBe(false);
    expect(containsDigit(null)).toBe(false);
  });
});

describe('future date checks', () => {
  const now = new Date(2026, 9, 16); // 16 Oct 2026, local time

  it('compares years', () => {
    expect(isFutureYear(2026, now)).toBe(false);
    expect(isFutureYear(2027, now)).toBe(true);
    expect(isFutureYear(null, now)).toBe(false);
  });

  it('compares partial and full ISO dates at their own precision', () => {
    expect(isFutureDate('2026-10-16', now)).toBe(false);
    expect(isFutureDate('2026-10-17', now)).toBe(true);
    expect(isFutureDate('2026-10', now)).toBe(false);
    expect(isFutureDate('2026-11', now)).toBe(true);
    expect(isFutureDate('2027', now)).toBe(true);
    expect(isFutureDate('1990-01-01', now)).toBe(false);
    expect(isFutureDate(null, now)).toBe(false);
  });

  it('finds future birth, death and marriage dates in data', () => {
    expect(findFutureDate(validData() as never, now)).toBeNull();

    const birth = validData();
    birth.familyTrees[0].members[2].birthYear = 2030;
    expect(findFutureDate(birth as never, now)).toMatch(/Chetan Sharma.*birth/);

    const death = validData();
    (death.familyTrees[0].members[0] as Record<string, unknown>).deathDate = '2026-12-01';
    expect(findFutureDate(death as never, now)).toMatch(/Anil Sharma.*death/);

    const marriage = validData();
    (marriage.familyTrees[0].relationships.spouses[0] as Record<string, unknown>).marriageYear = 2027;
    expect(findFutureDate(marriage as never, now)).toMatch(/marriage date/);
  });
});
