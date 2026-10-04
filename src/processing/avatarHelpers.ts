import { AgeCategory, AvatarStyle } from '../types/FamilyTypes';

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const AVATAR_EMOJIS: Record<string, Record<AgeCategory, string>> = {
  male:    { infant: '👶', toddler: '🧒', youth: '👦', adult: '👨', senior: '👴', unknown: '👨' },
  female:  { infant: '👶', toddler: '🧒', youth: '👧', adult: '👩', senior: '👵', unknown: '👩' },
  unknown: { infant: '👶', toddler: '🧒', youth: '🧒', adult: '🧑', senior: '🧓', unknown: '🧑' },
};

export function getAvatarEmoji(gender: 'male' | 'female' | 'unknown', ageCategory: AgeCategory): string {
  return (AVATAR_EMOJIS[gender] ?? AVATAR_EMOJIS.unknown)[ageCategory] ?? '🧑';
}

export const AGE_CATEGORY_COLORS: Record<AgeCategory, string> = {
  infant:  '#fce7f3',
  toddler: '#fef9c3',
  youth:   '#d1fae5',
  adult:   '#dbeafe',
  senior:  '#ede9fe',
  unknown: '#f1f5f9',
};

export function getAgeCategoryBgColor(ageCategory: AgeCategory): string {
  return AGE_CATEGORY_COLORS[ageCategory] ?? '#f1f5f9';
}

// ─── Font Awesome icon avatar helpers ───

export const FA_ICON_MAP: Record<string, Record<AgeCategory, string>> = {
  male:    { infant: 'fa-baby', toddler: 'fa-child',       youth: 'fa-child-reaching', adult: 'fa-person',       senior: 'fa-person-cane',  unknown: 'fa-person'       },
  female:  { infant: 'fa-baby', toddler: 'fa-child-dress', youth: 'fa-child-dress',    adult: 'fa-person-dress', senior: 'fa-person-dress', unknown: 'fa-person-dress' },
  unknown: { infant: 'fa-baby', toddler: 'fa-child',       youth: 'fa-child',          adult: 'fa-person',       senior: 'fa-person-cane',  unknown: 'fa-person'       },
};

export const FA_BG: Record<AgeCategory, string> = {
  infant: '#fce7f3', toddler: '#d1fae5', youth: '#f3e8ff',
  adult:  '#dbeafe', senior:  '#fef3c7', unknown: '#f3f4f6',
};
export const FA_BG_BOLD: Record<'male' | 'female' | 'unknown', string> = {
  male: '#1e3a8a', female: '#831843', unknown: '#1e293b',
};
export const FA_COLOR_CLASSIC: Record<'male' | 'female' | 'unknown', string> = {
  male: '#1e40af', female: '#9d174d', unknown: '#374151',
};
export const FA_COLOR_FLAT: Record<'male' | 'female' | 'unknown', string> = {
  male: '#3b82f6', female: '#ec4899', unknown: '#6b7280',
};

export function getFaIconClass(gender: 'male' | 'female' | 'unknown', ageCategory: AgeCategory): string {
  return (FA_ICON_MAP[gender] ?? FA_ICON_MAP.unknown)[ageCategory] ?? 'fa-person';
}
export function getFaAvatarBg(ageCategory: AgeCategory, gender: 'male' | 'female' | 'unknown', style: AvatarStyle): string {
  return style === 'silhouette-bold'
    ? (FA_BG_BOLD[gender] ?? FA_BG_BOLD.unknown)
    : (FA_BG[ageCategory] ?? '#f3f4f6');
}
export function getFaIconColor(gender: 'male' | 'female' | 'unknown', style: AvatarStyle): string {
  if (style === 'silhouette-bold') return '#ffffff';
  if (style === 'silhouette-flat') return FA_COLOR_FLAT[gender] ?? FA_COLOR_FLAT.unknown;
  return FA_COLOR_CLASSIC[gender] ?? FA_COLOR_CLASSIC.unknown;
}
