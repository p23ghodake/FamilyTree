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

  it('draws bark grain on the trunk and forked, tapering roots', () => {
    const art = buildPosterArt(input());
    expect(art.wood.filter(p => p.grain).length).toBeGreaterThan(3);
    expect(art.wood.length).toBeGreaterThanOrEqual(7 * 2 + 1);
    expect(JSON.stringify(art)).not.toMatch(/NaN|undefined/);
  });

  it('uses more than the original leaf shapes and varies leaf tone', () => {
    const art = buildPosterArt(input());
    const shapes = new Set(art.leaves.map(l => l.shape));
    expect(shapes.size).toBeGreaterThan(2);
    expect(new Set(art.leaves.map(l => l.color)).size).toBeGreaterThan(8);
  });

  it('keeps leaves off name tags and spreads sibling limbs', () => {
    const inp = input();
    const art = buildPosterArt(inp);
    const tags = layout.nodes.filter(n => n.kind !== 'fork').map(n => ({ ...inp.posOf(n), h: inp.cardH(n) / 2 }));
    [...art.leaves, ...art.backLeaves].forEach(l =>
      expect(tags.some(t => Math.abs(l.x - t.x) < 42 && Math.abs(l.y - t.y) < t.h)).toBe(false));
    expect(JSON.stringify(art)).not.toMatch(/NaN/);
  });

  it('grows berries, golden leaves and leaf clusters with varied sizes', () => {
    const art = buildPosterArt(input());
    expect(art.berries.length).toBeGreaterThan(0);
    art.berries.forEach(b => expect(b.r).toBeGreaterThan(0));
    expect(new Set(art.leaves.map(l => l.size.toFixed(1))).size).toBeGreaterThan(20);
    expect(new Set(art.leaves.map(l => l.shape)).size).toBeGreaterThan(3);
    expect(JSON.stringify(art)).not.toMatch(/NaN/);
  });

  it('adds deterministic dappled light only in summer', () => {
    const summer = buildPosterArt(input({ theme: 'summer' }));
    expect(summer.dappled.length).toBeGreaterThan(0);
    expect(summer.dappled).toEqual(buildPosterArt(input({ theme: 'summer' })).dappled);
    expect(buildPosterArt(input({ theme: 'autumn' })).dappled).toHaveLength(0);
  });
});

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.7)).toBe('#102030');
  });
});
