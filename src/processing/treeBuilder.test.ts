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
