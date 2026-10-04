import { validateRawFamilyData, sanitizeImageUrl } from './dataValidation';

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
});
