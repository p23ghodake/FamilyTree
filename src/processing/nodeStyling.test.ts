import { getTreeAccent, getNodeColors } from './nodeStyling';

// ─── getTreeAccent ───

describe('getTreeAccent', () => {
  it('index 0 returns Emerald green (#10B981)', () => {
    const accent = getTreeAccent(0);
    expect(accent.hex).toBe('#10B981');
    expect(accent.description).toBe('Emerald green');
  });

  it('index 1 returns Royal blue (#3B82F6)', () => {
    const accent = getTreeAccent(1);
    expect(accent.hex).toBe('#3B82F6');
    expect(accent.description).toBe('Royal blue');
  });

  it('wraps around: index 6 equals index 0', () => {
    expect(getTreeAccent(6)).toEqual(getTreeAccent(0));
  });

  it('wraps around: index 7 equals index 1', () => {
    expect(getTreeAccent(7)).toEqual(getTreeAccent(1));
  });

  it('returns an object with hex, description, and notes fields', () => {
    const accent = getTreeAccent(0);
    expect(accent).toHaveProperty('hex');
    expect(accent).toHaveProperty('description');
    expect(accent).toHaveProperty('notes');
  });
});

// ─── getNodeColors ───

describe('getNodeColors', () => {
  it('returns an object with baseColorHex, baseColorDescription, and nodeBorderColorHex', () => {
    const result = getNodeColors('adult', '#000000');
    expect(result).toHaveProperty('baseColorHex');
    expect(result).toHaveProperty('baseColorDescription');
    expect(result).toHaveProperty('nodeBorderColorHex');
  });

  it('hex values are strings starting with #', () => {
    const result = getNodeColors('infant', '#FF0000');
    expect(result.baseColorHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.nodeBorderColorHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('description reflects the age category', () => {
    expect(getNodeColors('infant',  '#000000').baseColorDescription).toMatch(/infant/i);
    expect(getNodeColors('toddler', '#000000').baseColorDescription).toMatch(/toddler/i);
    expect(getNodeColors('youth',   '#000000').baseColorDescription).toMatch(/youth/i);
    expect(getNodeColors('adult',   '#000000').baseColorDescription).toMatch(/adult/i);
    expect(getNodeColors('senior',  '#000000').baseColorDescription).toMatch(/senior/i);
    expect(getNodeColors('unknown', '#000000').baseColorDescription).toMatch(/unknown/i);
  });

  it('tinting toward the same hex produces the same color (no-op tint)', () => {
    // adult base is #3B82F6; tinting toward itself → output equals #3b82f6 (lowercase)
    const result = getNodeColors('adult', '#3B82F6');
    expect(result.baseColorHex).toBe('#3b82f6');
    expect(result.nodeBorderColorHex).toBe('#3b82f6');
  });

  it('tinting with pure black (#000000) darkens the color slightly', () => {
    const resultBlack  = getNodeColors('adult', '#000000');
    const resultNormal = getNodeColors('adult', '#3B82F6');
    // Numeric value of darkened color should be lower than the base
    const toNum = (hex: string) => parseInt(hex.slice(1), 16);
    expect(toNum(resultBlack.baseColorHex)).toBeLessThan(toNum(resultNormal.baseColorHex));
  });

  it('tinting with pure white (#FFFFFF) lightens the color slightly', () => {
    const resultWhite  = getNodeColors('adult', '#FFFFFF');
    const resultNormal = getNodeColors('adult', '#3B82F6');
    const toNum = (hex: string) => parseInt(hex.slice(1), 16);
    expect(toNum(resultWhite.baseColorHex)).toBeGreaterThan(toNum(resultNormal.baseColorHex));
  });

  it('each age category produces a distinct base color', () => {
    const categories = ['infant', 'toddler', 'youth', 'adult', 'senior', 'unknown'] as const;
    const accent = '#000000';
    const hexes = categories.map(c => getNodeColors(c, accent).baseColorHex);
    const unique = new Set(hexes);
    expect(unique.size).toBe(categories.length);
  });
});
