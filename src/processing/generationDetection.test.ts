import { detectGenerations } from './generationDetection';
import { RawFamilyMember } from '../types/FamilyTypes';

const member = (id: string, birthYear: number | null, parentIds: string[] = []): RawFamilyMember =>
  ({ id, birthYear, parentIds, firstName: '', lastName: '', gender: 'unknown' } as RawFamilyMember);

describe('detectGenerations — graph-based (parentIds present)', () => {
  it('assigns generation 1 to a root (no parents)', () => {
    const members = [member('root', 1950, [])];
    expect(detectGenerations(members).get('root')).toBe(1);
  });

  it('assigns generation 2 to a direct child', () => {
    const members = [member('parent', 1950, []), member('child', 1980, ['parent'])];
    const result = detectGenerations(members);
    expect(result.get('parent')).toBe(1);
    expect(result.get('child')).toBe(2);
  });

  it('assigns generation 3 to a grandchild', () => {
    const members = [
      member('gp', 1920, []),
      member('p',  1950, ['gp']),
      member('c',  1980, ['p']),
    ];
    const result = detectGenerations(members);
    expect(result.get('gp')).toBe(1);
    expect(result.get('p')).toBe(2);
    expect(result.get('c')).toBe(3);
  });

  it('uses MAX parent generation for a child with two parents at different levels', () => {
    // gp(gen1) → p1(gen2), orphan(gen1) → child
    // child's parents: p1(gen2) and orphan(gen1) → child should be gen3
    const members = [
      member('gp',     1920, []),
      member('p1',     1950, ['gp']),
      member('orphan', 1950, []),
      member('child',  1980, ['p1', 'orphan']),
    ];
    const result = detectGenerations(members);
    expect(result.get('child')).toBe(3);
  });

  it('correctly handles siblings (same parents, same generation)', () => {
    const members = [
      member('parent', 1950, []),
      member('sib1',   1975, ['parent']),
      member('sib2',   1980, ['parent']),
    ];
    const result = detectGenerations(members);
    expect(result.get('sib1')).toBe(2);
    expect(result.get('sib2')).toBe(2);
  });

  it('returns null for members in cycles (corrupt data)', () => {
    // Cycle: A parent of B, B parent of A
    const members = [
      member('a', 1950, ['b']),
      member('b', 1980, ['a']),
    ];
    const result = detectGenerations(members);
    // Both caught in cycle — should be null not crash
    expect(result.get('a')).toBeNull();
    expect(result.get('b')).toBeNull();
  });

  it('maps every member even with mixed data', () => {
    const members = [
      member('a', 1920, []),
      member('b', 1950, ['a']),
      member('c', null, ['a']),
    ];
    const result = detectGenerations(members);
    expect(result.size).toBe(3);
    expect(result.get('c')).toBe(2);
  });
});

describe('detectGenerations — birth-year fallback (no parentIds)', () => {
  it('returns null for all members when no birth years', () => {
    const members = [member('a', null), member('b', null)];
    const result = detectGenerations(members);
    expect(result.get('a')).toBeNull();
    expect(result.get('b')).toBeNull();
  });

  it('assigns generation 1 to the earliest member', () => {
    const members = [member('a', 1900), member('b', 1930)];
    expect(detectGenerations(members).get('a')).toBe(1);
  });

  it('assigns generation 2 to a member ~30 years later', () => {
    const members = [member('a', 1900), member('b', 1930)];
    expect(detectGenerations(members).get('b')).toBe(2);
  });

  it('returns a Map with an entry for every member', () => {
    const members = [member('x', 1950), member('y', null), member('z', 1980)];
    expect(detectGenerations(members).size).toBe(3);
  });
});

describe('detectGenerations — edge cases', () => {
  it('empty members array returns an empty Map', () => {
    const result = detectGenerations([]);
    expect(result.size).toBe(0);
  });

  it('single member with no relationships gets generation 1', () => {
    const result = detectGenerations([member('solo', 1980)]);
    expect(result.get('solo')).toBe(1);
  });

  it('member whose parentId points to itself does not infinite-loop and returns null', () => {
    const self = member('self', 1980, ['self']);
    let result: Map<string, number | null>;
    expect(() => { result = detectGenerations([self]); }).not.toThrow();
    expect(result!.get('self')).toBeNull();
  });
});
