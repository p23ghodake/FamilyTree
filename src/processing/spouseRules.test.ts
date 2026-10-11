import { ageOnDate, getCurrentSpouseId, hasUnderageChildren } from './spouseRules';
import { StyledFamilyTree } from '../types/FamilyTypes';

const now = new Date(2026, 5, 15);
const tree = (kids: { id: string; gender: 'male' | 'female'; birthDate?: string }[], status: 'current' | 'former' = 'current') => ({
  members: kids.map(k => ({ ...k })),
  relationships: {
    spouses: [{ spouse1Id: 'p', spouse2Id: 's', status }],
    parentChild: kids.map(k => ({ parentId: 'p', childId: k.id })),
  },
}) as unknown as StyledFamilyTree;

describe('spouseRules', () => {
  it('calculates age from birth date', () => {
    expect(ageOnDate('2005-06-15', now)).toBe(21);
    expect(ageOnDate('2005-06-16', now)).toBe(20);
    expect(ageOnDate(null, now)).toBeNull();
  });
  it('finds only the current spouse', () => {
    expect(getCurrentSpouseId(tree([]), 'p')).toBe('s');
    expect(getCurrentSpouseId(tree([], 'former'), 'p')).toBeNull();
  });
  it('blocks for a son under 21 or daughter under 18', () => {
    expect(hasUnderageChildren(tree([{ id: 'a', gender: 'male', birthDate: '2007-01-01' }]), 'p', now)).toBe(true);
    expect(hasUnderageChildren(tree([{ id: 'a', gender: 'female', birthDate: '2007-01-01' }]), 'p', now)).toBe(false);
    expect(hasUnderageChildren(tree([{ id: 'a', gender: 'female', birthDate: '2010-01-01' }]), 'p', now)).toBe(true);
  });
  it('ignores children without a birth date', () => {
    expect(hasUnderageChildren(tree([{ id: 'a', gender: 'male' }]), 'p', now)).toBe(false);
  });
});
