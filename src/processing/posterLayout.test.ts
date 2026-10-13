import { buildPosterLayout, findPosterRoot } from './posterLayout';

const m = (id: string, gender: 'male' | 'female' | 'unknown' = 'male', birthYear: number | null = null) => ({ id, gender, birthYear });
const pc = (pairs: Array<[string, string]>) => pairs.map(([parentId, childId]) => ({ parentId, childId }));

describe('buildPosterLayout', () => {
  const members = [
    m('gp'), m('gm', 'female'), m('dad'), m('mom', 'female'), m('uncle', 'male', 1950), m('me', 'male', 1980), m('sis', 'female', 1985),
    m('kid'),
  ];
  const rels = pc([
    ['gp', 'dad'], ['gm', 'dad'], ['gp', 'uncle'], ['gm', 'uncle'],
    ['dad', 'me'], ['mom', 'me'], ['dad', 'sis'], ['mom', 'sis'], ['me', 'kid'],
  ]);

  it('centres each parent over its children and gives every leaf one slot', () => {
    const layout = buildPosterLayout('gp', 4, members, rels);
    const at = (id: string) => layout.nodes.find(n => n.id === id)!;
    expect(layout.slots).toBe(3); // kid, sis, uncle
    expect(layout.levels).toBe(4);
    expect(layout.focusDepth).toBe(0);
    expect(at('me').x).toBe(at('kid').x);
    expect(at('dad').x).toBe((at('me').x + at('sis').x) / 2);
    expect(at('gp').depth).toBe(0);
    expect(at('kid')).toMatchObject({ depth: 3, stemId: 'me' });
  });

  it('orders descendants eldest first', () => {
    const layout = buildPosterLayout('dad', 2, members, rels);
    expect(layout.nodes.map(n => n.id)).toEqual(['gp', 'dad', 'me', 'sis']);
  });

  it('stops at the requested number of generations', () => {
    const layout = buildPosterLayout('gp', 2, members, rels);
    expect(layout.levels).toBe(2);
    expect(layout.nodes.map(n => n.id).sort()).toEqual(['dad', 'gp', 'uncle']);
  });

  it('survives cycles and unknown roots', () => {
    const cyclic = pc([['a', 'b'], ['b', 'a']]);
    expect(buildPosterLayout('a', 8, [m('a'), m('b')], cyclic).nodes).toHaveLength(2);
    expect(buildPosterLayout('missing', 4, members, rels)).toEqual({ nodes: [], slots: 0, levels: 0, focusDepth: 0 });
  });

  it('stacks the father line on the trunk below the chosen person', () => {
    const layout = buildPosterLayout('dad', 3, members, rels);
    const at = (id: string) => layout.nodes.find(n => n.id === id)!;
    expect(layout.focusDepth).toBe(1);
    expect(layout.nodes[0]).toMatchObject({ id: 'gp', depth: 0, stemId: null });
    expect(at('dad')).toMatchObject({ depth: 1, stemId: 'gp', x: at('gp').x });
    expect(at('kid')).toMatchObject({ depth: 3, stemId: 'me' });
    expect(layout.nodes.some(n => n.id === 'gm' || n.id === 'uncle')).toBe(false);
    expect(layout.levels).toBe(4);
  });
});

describe('findPosterRoot', () => {
  it('starts where the longest line first branches', () => {
    const rels = pc([['old', 'mid'], ['mid', 'a'], ['mid', 'b'], ['a', 'young'], ['other', 'x']]);
    const ids = ['other', 'old', 'mid', 'a', 'b', 'young', 'x'].map(id => ({ id }));
    expect(findPosterRoot(ids, rels)).toBe('mid');
  });
});
