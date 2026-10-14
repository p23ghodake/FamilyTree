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
    expect(layout.nodes.filter(n => n.kind === 'person').map(n => n.id)).toEqual(['gp', 'dad', 'me', 'sis']);
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

describe('buildPosterLayout couples and branches', () => {
  const members = [
    m('gp'), m('gm', 'female'), m('son1', 'male', 1950), m('dau', 'female', 1952), m('son2', 'male', 1955),
    m('dil', 'female'), m('sil'), m('ex', 'female'), m('late', 'female'), m('gk1', 'male'), m('gk2', 'female'),
  ];
  const rels = pc([
    ['gp', 'son1'], ['gm', 'son1'], ['gp', 'dau'], ['gm', 'son2'],
    ['dil', 'gk1'], ['son1', 'gk2'],
  ]);
  const marriages = [
    { spouse1Id: 'gp', spouse2Id: 'gm' },
    { spouse1Id: 'son1', spouse2Id: 'dil' },
    { spouse1Id: 'dau', spouse2Id: 'sil' },
    { spouse1Id: 'son2', spouse2Id: 'ex', endYear: 1990, endReason: 'divorce' as const },
    { spouse1Id: 'son2', spouse2Id: 'late', endYear: 2000, endReason: 'death' as const },
  ];
  const layout = buildPosterLayout('gp', 4, members, rels, marriages);
  const at = (id: string) => layout.nodes.find(n => n.id === id)!;

  it('puts the spouse on the same card instead of a separate node', () => {
    expect(at('gp').spouseId).toBe('gm');
    expect(at('dau').spouseId).toBe('sil');
    expect(layout.nodes.some(n => n.id === 'gm' || n.id === 'dil' || n.id === 'sil')).toBe(false);
  });

  it('shows a late spouse but never an ex', () => {
    expect(at('son2').spouseId).toBe('late');
    expect(layout.nodes.some(n => n.id === 'ex')).toBe(false);
  });

  it('collects children recorded under either parent', () => {
    expect(at('son2').stemId).toBe('gp~m');
    expect(at('gk1').stemId).toBe('son1~m');
    expect(at('gk2').stemId).toBe('son1~f');
  });

  it('splits sons and daughters onto separate forks, sons first', () => {
    expect(at('gp~m')).toMatchObject({ kind: 'fork', stemId: 'gp', depth: 0.5 });
    expect(at('gp~f')).toMatchObject({ kind: 'fork', stemId: 'gp', depth: 0.5 });
    expect(at('son1').stemId).toBe('gp~m');
    expect(at('dau').stemId).toBe('gp~f');
    expect(at('son1').x).toBeLessThan(at('son2').x);
    expect(at('son2').x).toBeLessThan(at('dau').x);
    expect(at('gp').x).toBe((at('gp~m').x + at('gp~f').x) / 2);
  });

  it('grows a single-gender family straight from the couple', () => {
    const sonsOnly = buildPosterLayout('gp', 2, members, pc([['gp', 'son1'], ['gp', 'son2']]), marriages);
    expect(sonsOnly.nodes.some(n => n.kind === 'fork')).toBe(false);
    expect(sonsOnly.nodes.find(n => n.id === 'son2')!.stemId).toBe('gp');
  });
});

describe('findPosterRoot', () => {
  it('starts where the longest line first branches', () => {
    const rels = pc([['old', 'mid'], ['mid', 'a'], ['mid', 'b'], ['a', 'young'], ['other', 'x']]);
    const ids = ['other', 'old', 'mid', 'a', 'b', 'young', 'x'].map(id => ({ id }));
    expect(findPosterRoot(ids, rels)).toBe('mid');
  });
});
