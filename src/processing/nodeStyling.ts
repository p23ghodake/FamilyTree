import { AgeCategory } from '../types/FamilyTypes';

// ─── Tree accent palette ───
interface TreeAccent {
  hex: string;
  description: string;
  notes: string;
}

const TREE_ACCENTS: TreeAccent[] = [
  {
    hex: '#10B981',
    description: 'Emerald green',
    notes: 'Age-based node colors are lightly tinted toward green for a natural, earthy feel',
  },
  {
    hex: '#3B82F6',
    description: 'Royal blue',
    notes: 'Age-based node colors carry a subtle blue tint for a calm, regal appearance',
  },
  {
    hex: '#8B5CF6',
    description: 'Deep violet',
    notes: 'Age-based node colors are given a faint violet undertone for distinction',
  },
  {
    hex: '#F59E0B',
    description: 'Warm amber',
    notes: 'Age-based node colors lean slightly warm, giving a golden heritage look',
  },
  {
    hex: '#EF4444',
    description: 'Crimson red',
    notes: 'Age-based node colors are softened with a warm red tint for vitality',
  },
  {
    hex: '#EC4899',
    description: 'Vibrant pink',
    notes: 'Age-based node colors receive a rose tint for a lively, modern feel',
  },
];

export function getTreeAccent(treeIndex: number): TreeAccent {
  return TREE_ACCENTS[treeIndex % TREE_ACCENTS.length];
}

// ─── Age-based colors with accent tinting ───
interface AgeColorSet {
  base: string;
  bg: string;
  border: string;
  description: string;
}

const AGE_COLORS: Record<AgeCategory, AgeColorSet> = {
  infant:  { base: '#F472B6', bg: '#FCE7F3', border: '#F472B6', description: 'soft pink for infants' },
  toddler: { base: '#34D399', bg: '#D1FAE5', border: '#34D399', description: 'fresh green for toddlers' },
  youth:   { base: '#A855F7', bg: '#F3E8FF', border: '#A855F7', description: 'vibrant purple for youth' },
  adult:   { base: '#3B82F6', bg: '#DBEAFE', border: '#3B82F6', description: 'strong blue for adults' },
  senior:  { base: '#F59E0B', bg: '#FEF3C7', border: '#F59E0B', description: 'warm gold for seniors' },
  unknown: { base: '#6B7280', bg: '#F3F4F6', border: '#6B7280', description: 'neutral gray for unknown age' },
};

// Blend a hex color toward an accent by a small amount (10%)
function tintHex(hex: string, accentHex: string, amount: number = 0.1): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(accentHex);
  const blend = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(blend(r1, r2))}${toHex(blend(g1, g2))}${toHex(blend(b1, b2))}`;
}

export function getNodeColors(ageCategory: AgeCategory, treeAccentHex: string): {
  baseColorHex: string;
  baseColorDescription: string;
  nodeBorderColorHex: string;
} {
  const c = AGE_COLORS[ageCategory];
  return {
    baseColorHex: tintHex(c.base, treeAccentHex),
    baseColorDescription: c.description,
    nodeBorderColorHex: tintHex(c.border, treeAccentHex),
  };
}
