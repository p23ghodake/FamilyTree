import { buildTreeFromMembers, computeLineage } from './treeBuilder';
import { StyledFamilyMember, StyledRelationships, SpouseRelationship } from '../types/FamilyTypes';

// ─── Minimal fixture helpers ───

const m = (id: string, parentIds: string[] = [], childrenIds: string[] = []): StyledFamilyMember =>
  ({ id, parentIds, childrenIds } as unknown as StyledFamilyMember);

const emptyRels = (): StyledRelationships => ({ spouses: [], parentChild: [] });

const pc = (pairs: [string, string][]): StyledRelationships => ({
  spouses: [],
  parentChild: pairs.map(([parentId, childId]) => ({ parentId, childId } as any)),
});

const withSpouse = (
  pcPairs: [string, string][],
  spPairs: [string, string][],
  status: 'current' | 'former' = 'current'
): StyledRelationships => ({
  parentChild: pcPairs.map(([parentId, childId]) => ({ parentId, childId } as any)),
  spouses: spPairs.map(([s1, s2]) => ({ spouse1Id: s1, spouse2Id: s2, status } as SpouseRelationship)),
});

// ─── buildTreeFromMembers ───

describe('buildTreeFromMembers', () => {
  it('returns empty array for empty members list', () => {
    expect(buildTreeFromMembers([], emptyRels())).toEqual([]);
  });

  it('returns a single root node for a lone member with no relationships', () => {
    const result = buildTreeFromMembers([m('a')], emptyRels());
    expect(result).toHaveLength(1);
    expect(result[0].member.id).toBe('a');
    expect(result[0].children).toHaveLength(0);
    expect(result[0].currentSpouses).toHaveLength(0);
    expect(result[0].formerSpouses).toHaveLength(0);
  });

  it('parent+child: parent is root, child is nested', () => {
    const members = [m('parent'), m('child', ['parent'])];
    const rels = pc([['parent', 'child']]);
    const result = buildTreeFromMembers(members, rels);

    expect(result).toHaveLength(1);
    expect(result[0].member.id).toBe('parent');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].member.id).toBe('child');
  });

  it('parent+child+spouse: root has current spouse attached and child nested', () => {
    const members = [m('parent'), m('spouse'), m('child', ['parent'])];
    const rels = withSpouse([['parent', 'child']], [['parent', 'spouse']]);
    const result = buildTreeFromMembers(members, rels);

    expect(result).toHaveLength(1);
    const root = result[0];
    expect(root.member.id).toBe('parent');
    expect(root.currentSpouses).toHaveLength(1);
    expect(root.currentSpouses[0].member.id).toBe('spouse');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].member.id).toBe('child');
  });

  it('former spouse is placed in formerSpouses, not currentSpouses', () => {
    const members = [m('a'), m('b')];
    const rels = withSpouse([], [['a', 'b']], 'former');
    const result = buildTreeFromMembers(members, rels);

    const root = result[0];
    expect(root.currentSpouses).toHaveLength(0);
    expect(root.formerSpouses).toHaveLength(1);
    expect(root.formerSpouses[0].member.id).toBe('b');
  });

  it('cycle detection: member whose parentId is itself is excluded from rootIds and does not crash', () => {
    const self = m('self', ['self']);
    const rels = pc([['self', 'self']]);
    expect(() => buildTreeFromMembers([self], rels)).not.toThrow();
    // 'self' is marked as a child of itself → no root → empty result
    const result = buildTreeFromMembers([self], rels);
    expect(result).toHaveLength(0);
  });

  it('two unrelated root members produce two root nodes', () => {
    const result = buildTreeFromMembers([m('x'), m('y')], emptyRels());
    expect(result).toHaveLength(2);
    const ids = result.map(n => n.member.id).sort();
    expect(ids).toEqual(['x', 'y']);
  });

  describe('sibling order', () => {
    const kid = (id: string, gender: 'male' | 'female' | 'unknown', birthYear: number | null, birthDate?: string) =>
      ({ id, gender, birthYear, birthDate, parentIds: ['p'], childrenIds: [] } as unknown as StyledFamilyMember);
    const order = (kids: StyledFamilyMember[], rels?: StyledRelationships, extra: StyledFamilyMember[] = []) =>
      buildTreeFromMembers([m('p'), ...extra, ...kids], rels ?? pc(kids.map(k => ['p', k.id] as [string, string])))[0]
        .children.map(n => n.member.id);

    it('places sons eldest-first, then daughters eldest-first', () => {
      expect(order([
        kid('d1990', 'female', 1990), kid('s1985', 'male', 1985),
        kid('d1980', 'female', 1980), kid('s1975', 'male', 1975),
      ])).toEqual(['s1975', 's1985', 'd1980', 'd1990']);
    });

    it('puts undated siblings after dated ones in their group, keeping entered order', () => {
      expect(order([
        kid('sNoneA', 'male', null), kid('s1970', 'male', 1970), kid('sNoneB', 'male', null),
        kid('dNone', 'female', null), kid('d1960', 'female', 1960),
      ])).toEqual(['s1970', 'sNoneA', 'sNoneB', 'd1960', 'dNone']);
    });

    it('uses full birth dates to order same-year siblings and reads the year from a date', () => {
      expect(order([
        kid('lateTwin', 'male', 1990, '1990-11-02'), kid('earlyTwin', 'male', 1990, '1990-03-15'),
        kid('dateOnly', 'male', null, '1985-06-01'),
      ])).toEqual(['dateOnly', 'earlyTwin', 'lateTwin']);
    });

    it('places children of unknown gender after daughters', () => {
      expect(order([kid('u', 'unknown', 1950), kid('d', 'female', 1990), kid('s', 'male', 1995)]))
        .toEqual(['s', 'd', 'u']);
    });

    it('keeps spouses beside their partner and orders the partners by age', () => {
      const younger = kid('younger', 'male', 1990);
      const elder = kid('elder', 'male', 1980);
      const wife = { id: 'wife', gender: 'female', birthYear: 1950, parentIds: [], childrenIds: [] } as unknown as StyledFamilyMember;
      const rels: StyledRelationships = {
        parentChild: [{ parentId: 'p', childId: 'younger' }, { parentId: 'p', childId: 'elder' }] as any,
        spouses: [{ spouse1Id: 'younger', spouse2Id: 'wife', status: 'current' } as SpouseRelationship],
      };
      const tree = buildTreeFromMembers([m('p'), wife, younger, elder], rels)[0];
      expect(tree.children.map(n => n.member.id)).toEqual(['elder', 'younger']);
      expect(tree.children[1].currentSpouses.map(s => s.member.id)).toEqual(['wife']);
    });
  });
});

// ─── computeLineage ───

describe('computeLineage', () => {
  it('always includes the starting member', () => {
    const result = computeLineage('a', [m('a')], emptyRels());
    expect(result.has('a')).toBe(true);
  });

  it('isolated member with no relationships returns a set containing only itself', () => {
    const result = computeLineage('lone', [m('lone'), m('other')], emptyRels());
    expect(result.size).toBe(1);
    expect(result.has('lone')).toBe(true);
  });

  it('known ancestor chain: includes all ancestors and descendants', () => {
    // grandparent → parent → me → child
    const members = [m('gp'), m('parent', ['gp']), m('me', ['parent']), m('child', ['me'])];
    const rels = pc([['gp', 'parent'], ['parent', 'me'], ['me', 'child']]);
    const result = computeLineage('me', members, rels);

    expect(result.has('me')).toBe(true);
    expect(result.has('parent')).toBe(true);
    expect(result.has('gp')).toBe(true);
    expect(result.has('child')).toBe(true);
  });

  it('includes own spouses', () => {
    const members = [m('a'), m('b')];
    const rels: StyledRelationships = {
      spouses: [{ spouse1Id: 'a', spouse2Id: 'b', status: 'current' } as SpouseRelationship],
      parentChild: [],
    };
    const result = computeLineage('a', members, rels);
    expect(result.has('b')).toBe(true);
  });

  it('member not in any relationship produces a single-element set', () => {
    const members = [m('a'), m('b'), m('c')];
    const rels = pc([['a', 'b']]);
    const result = computeLineage('c', members, rels);
    expect(result.size).toBe(1);
    expect(result.has('c')).toBe(true);
  });
});
