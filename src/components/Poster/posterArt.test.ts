import { buildPosterLayout } from '../../processing/posterLayout';
import { buildPosterArt, mix, PosterArtInput } from './posterArt';

const m = (id: string, gender: 'male' | 'female' = 'male') => ({ id, gender, birthYear: null });
const members = [m('gp'), m('a'), m('b'), m('c', 'female'), m('a1'), m('a2'), m('b1')];
const rels = [['gp', 'a'], ['gp', 'b'], ['gp', 'c'], ['a', 'a1'], ['a', 'a2'], ['b', 'b1']].map(([parentId, childId]) => ({ parentId, childId }));
const layout = buildPosterLayout('gp', 3, members, rels);

const input = (overrides: Partial<PosterArtInput> = {}): PosterArtInput => ({
  nodes: layout.nodes,
  focusDepth: layout.focusDepth,
  posOf: n => ({ x: 100 + n.x * 170, y: 600 - n.depth * 150 }),
  cardH: n => (n.kind === 'fork' ? 0 : 80),
  groundY: 720,
  trunkH: 90,
  scale: 1,
  minX: 100,
  maxX: 100 + layout.slots * 170,
  ...overrides,
});

describe('buildPosterArt', () => {
  it('draws the same tree every time', () => {
    expect(buildPosterArt(input())).toEqual(buildPosterArt(input()));
  });

  it('shades every limb and keeps some leaves behind the wood', () => {
    const art = buildPosterArt(input());
    const limbs = art.wood.filter(p => p.shade);
    expect(limbs.length).toBeGreaterThan(layout.nodes.length);
    limbs.forEach(p => expect(p.light).toBeTruthy());
    expect(art.backLeaves.length).toBeGreaterThan(0);
    expect(art.leaves.length).toBeGreaterThan(art.backLeaves.length);
    expect(art.ground.mound).toMatch(/^M/);
    expect(JSON.stringify(art)).not.toMatch(/NaN/);
  });

  it('rounds off limbs where they split at a bare fork', () => {
    // gp has sons and a daughter, so his children hang from two forks.
    expect(layout.nodes.some(n => n.kind === 'fork')).toBe(true);
    expect(buildPosterArt(input()).wood.some(p => !p.shade && p.body.includes('a'))).toBe(true);
  });

  it('only grows hanging roots and blossoms in their own styles', () => {
    expect(buildPosterArt(input()).aerialRoots).toHaveLength(0);
    expect(buildPosterArt(input({ theme: 'banyan' })).aerialRoots.length).toBeGreaterThan(0);
    const blossoms = (art: ReturnType<typeof buildPosterArt>) => art.leaves.filter(l => l.shape === 'blossom').length;
    expect(blossoms(buildPosterArt(input()))).toBe(0);
    expect(blossoms(buildPosterArt(input({ theme: 'spring' })))).toBeGreaterThan(0);
  });
});

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.7)).toBe('#102030');
  });
});
