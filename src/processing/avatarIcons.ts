/**
 * Industry-standard SVG avatar icons for each gender × age-category combination.
 *
 * Design system (Material Design / Font Awesome silhouette style):
 *   – Background : soft age-category colour (matches node colour scheme)
 *   – Silhouette : solid, deep gender colour – no skin tones, no eyes, no hair detail
 *   – Shape      : clean geometric paths that vary by age (swaddle → child → adult → elder)
 *
 * Age → silhouette shape:
 *   infant  – oversized head + rectangular swaddle bundle
 *   toddler – large head + short body arc (reaching arms for male, short dress for female)
 *   youth   – medium head + medium body arc / medium dress
 *   adult   – standard head + full body arc / full dress (fa-person / fa-person-dress style)
 *   senior  – head + body + walking cane (male) / head + bun + long dress (female)
 *   unknown – neutral adult silhouette
 *
 * Gender → silhouette colour:
 *   male    – deep blue  (#1e40af)
 *   female  – deep rose  (#9d174d)
 *   unknown – slate gray (#374151)
 */

import { AgeCategory } from '../types/FamilyTypes';

// ── Age-based background colours (matches nodeStyling palette) ────────────────

const BG: Record<AgeCategory, string> = {
  infant:  '#fce7f3',
  toddler: '#d1fae5',
  youth:   '#f3e8ff',
  adult:   '#dbeafe',
  senior:  '#fef3c7',
  unknown: '#f3f4f6',
};

// ── Gender-based silhouette colours ──────────────────────────────────────────

const IC_MALE    = '#1e40af'; // blue-800
const IC_FEMALE  = '#9d174d'; // rose-800
const IC_UNKNOWN = '#374151'; // gray-700

// ── SVG builder ───────────────────────────────────────────────────────────────

function svgUri(bg: string, inner: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="50" fill="${bg}"/>` +
    inner +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── Silhouette shape functions ────────────────────────────────────────────────

// Infant: very large head + rounded swaddle bundle
function shapeInfantNeutral(c: string): string {
  return (
    `<circle cx="50" cy="36" r="21" fill="${c}"/>` +
    `<rect x="26" y="57" width="48" height="30" rx="14" fill="${c}"/>`
  );
}

// Infant female: swaddle + classic bow on top of head
function shapeInfantFemale(c: string): string {
  return (
    shapeInfantNeutral(c) +
    // Left bow wing
    `<path d="M32 15 L48 21 L32 27 Z" fill="${c}"/>` +
    // Right bow wing
    `<path d="M68 15 L52 21 L68 27 Z" fill="${c}"/>` +
    // Bow knot
    `<circle cx="50" cy="21" r="5" fill="${c}"/>`
  );
}

// Toddler male: large head + short body arc (fa-child proportions)
function shapeToddlerMale(c: string): string {
  return (
    `<circle cx="50" cy="30" r="18" fill="${c}"/>` +
    `<path d="M20 90 Q20 63 32 56 Q41 49 50 49 Q59 49 68 56 Q80 63 80 90 Z" fill="${c}"/>`
  );
}

// Toddler female: large head + short flared dress
function shapeToddlerFemale(c: string): string {
  return (
    `<circle cx="50" cy="30" r="18" fill="${c}"/>` +
    `<path d="M34 48 Q50 55 66 48 L80 90 L20 90 Z" fill="${c}"/>`
  );
}

// Youth male: medium head + medium body arc
function shapeYouthMale(c: string): string {
  return (
    `<circle cx="50" cy="27" r="16" fill="${c}"/>` +
    `<path d="M17 90 Q17 62 29 55 Q39 48 50 48 Q61 48 71 55 Q83 62 83 90 Z" fill="${c}"/>`
  );
}

// Youth female: medium head + medium dress
function shapeYouthFemale(c: string): string {
  return (
    `<circle cx="50" cy="27" r="16" fill="${c}"/>` +
    `<path d="M34 43 Q50 50 66 43 L82 90 L18 90 Z" fill="${c}"/>`
  );
}

// Adult male: fa-person – standard head + full shoulder-to-floor arc
function shapeAdultMale(c: string): string {
  return (
    `<circle cx="50" cy="25" r="15" fill="${c}"/>` +
    `<path d="M14 90 Q14 60 26 53 Q37 46 50 46 Q63 46 74 53 Q86 60 86 90 Z" fill="${c}"/>`
  );
}

// Adult female: fa-person-dress – standard head + flared dress
function shapeAdultFemale(c: string): string {
  return (
    `<circle cx="50" cy="25" r="15" fill="${c}"/>` +
    `<path d="M33 40 Q50 47 67 40 L84 90 L16 90 Z" fill="${c}"/>`
  );
}

// Senior male: fa-person-cane – slight forward lean + walking cane
function shapeSeniorMale(c: string): string {
  return (
    `<circle cx="50" cy="25" r="14" fill="${c}"/>` +
    // Body (slightly offset right to make room for cane)
    `<path d="M14 90 Q15 62 27 55 Q37 48 50 48 Q61 48 69 53 Q76 58 78 67 L78 90 Z" fill="${c}"/>` +
    // Cane shaft
    `<path d="M76 64 L88 90" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` +
    // Cane handle (J-curve)
    `<path d="M84 88 Q91 82 90 73" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`
  );
}

// Senior female: head + hair bun + long flared dress
function shapeSeniorFemale(c: string): string {
  return (
    // Hair bun sits above head
    `<circle cx="50" cy="12" r="9" fill="${c}"/>` +
    `<circle cx="50" cy="27" r="14" fill="${c}"/>` +
    `<path d="M34 41 Q50 48 66 41 L82 90 L18 90 Z" fill="${c}"/>`
  );
}

// Unknown: neutral adult, same as male but no gender-specific detail
function shapeUnknown(c: string): string {
  return shapeAdultMale(c);
}

// ── Lazy-initialised icon tables ─────────────────────────────────────────────
// Icons are generated on first access instead of at module load to avoid
// blocking startup with 54 synchronous btoa() calls.

type IconTable = Record<string, Record<AgeCategory, string>>;

let _classic: IconTable | null = null;
let _flat: IconTable | null = null;
let _bold: IconTable | null = null;

function buildClassic(): IconTable {
  return {
    male: {
      infant:  svgUri(BG.infant,  shapeInfantNeutral(IC_MALE)),
      toddler: svgUri(BG.toddler, shapeToddlerMale(IC_MALE)),
      youth:   svgUri(BG.youth,   shapeYouthMale(IC_MALE)),
      adult:   svgUri(BG.adult,   shapeAdultMale(IC_MALE)),
      senior:  svgUri(BG.senior,  shapeSeniorMale(IC_MALE)),
      unknown: svgUri(BG.unknown, shapeAdultMale(IC_MALE)),
    },
    female: {
      infant:  svgUri(BG.infant,  shapeInfantFemale(IC_FEMALE)),
      toddler: svgUri(BG.toddler, shapeToddlerFemale(IC_FEMALE)),
      youth:   svgUri(BG.youth,   shapeYouthFemale(IC_FEMALE)),
      adult:   svgUri(BG.adult,   shapeAdultFemale(IC_FEMALE)),
      senior:  svgUri(BG.senior,  shapeSeniorFemale(IC_FEMALE)),
      unknown: svgUri(BG.unknown, shapeAdultFemale(IC_FEMALE)),
    },
    unknown: {
      infant:  svgUri(BG.infant,  shapeInfantNeutral(IC_UNKNOWN)),
      toddler: svgUri(BG.toddler, shapeToddlerMale(IC_UNKNOWN)),
      youth:   svgUri(BG.youth,   shapeYouthMale(IC_UNKNOWN)),
      adult:   svgUri(BG.adult,   shapeUnknown(IC_UNKNOWN)),
      senior:  svgUri(BG.senior,  shapeSeniorMale(IC_UNKNOWN)),
      unknown: svgUri(BG.unknown, shapeUnknown(IC_UNKNOWN)),
    },
  };
}

function buildFlat(): IconTable {
  const BG_FLAT = '#ffffff';
  const IC_FLAT_MALE    = '#60a5fa';
  const IC_FLAT_FEMALE  = '#f472b6';
  const IC_FLAT_UNKNOWN = '#94a3b8';
  return {
    male: {
      infant:  svgUri(BG_FLAT, shapeInfantNeutral(IC_FLAT_MALE)),
      toddler: svgUri(BG_FLAT, shapeToddlerMale(IC_FLAT_MALE)),
      youth:   svgUri(BG_FLAT, shapeYouthMale(IC_FLAT_MALE)),
      adult:   svgUri(BG_FLAT, shapeAdultMale(IC_FLAT_MALE)),
      senior:  svgUri(BG_FLAT, shapeSeniorMale(IC_FLAT_MALE)),
      unknown: svgUri(BG_FLAT, shapeAdultMale(IC_FLAT_MALE)),
    },
    female: {
      infant:  svgUri(BG_FLAT, shapeInfantFemale(IC_FLAT_FEMALE)),
      toddler: svgUri(BG_FLAT, shapeToddlerFemale(IC_FLAT_FEMALE)),
      youth:   svgUri(BG_FLAT, shapeYouthFemale(IC_FLAT_FEMALE)),
      adult:   svgUri(BG_FLAT, shapeAdultFemale(IC_FLAT_FEMALE)),
      senior:  svgUri(BG_FLAT, shapeSeniorFemale(IC_FLAT_FEMALE)),
      unknown: svgUri(BG_FLAT, shapeAdultFemale(IC_FLAT_FEMALE)),
    },
    unknown: {
      infant:  svgUri(BG_FLAT, shapeInfantNeutral(IC_FLAT_UNKNOWN)),
      toddler: svgUri(BG_FLAT, shapeToddlerMale(IC_FLAT_UNKNOWN)),
      youth:   svgUri(BG_FLAT, shapeYouthMale(IC_FLAT_UNKNOWN)),
      adult:   svgUri(BG_FLAT, shapeUnknown(IC_FLAT_UNKNOWN)),
      senior:  svgUri(BG_FLAT, shapeSeniorMale(IC_FLAT_UNKNOWN)),
      unknown: svgUri(BG_FLAT, shapeUnknown(IC_FLAT_UNKNOWN)),
    },
  };
}

function buildBold(): IconTable {
  const BG_BOLD_MALE    = '#1e3a5f';
  const BG_BOLD_FEMALE  = '#4c0519';
  const BG_BOLD_UNKNOWN = '#1e293b';
  const IC_BOLD         = '#f1f5f9';
  return {
    male: {
      infant:  svgUri(BG_BOLD_MALE, shapeInfantNeutral(IC_BOLD)),
      toddler: svgUri(BG_BOLD_MALE, shapeToddlerMale(IC_BOLD)),
      youth:   svgUri(BG_BOLD_MALE, shapeYouthMale(IC_BOLD)),
      adult:   svgUri(BG_BOLD_MALE, shapeAdultMale(IC_BOLD)),
      senior:  svgUri(BG_BOLD_MALE, shapeSeniorMale(IC_BOLD)),
      unknown: svgUri(BG_BOLD_MALE, shapeAdultMale(IC_BOLD)),
    },
    female: {
      infant:  svgUri(BG_BOLD_FEMALE, shapeInfantFemale(IC_BOLD)),
      toddler: svgUri(BG_BOLD_FEMALE, shapeToddlerFemale(IC_BOLD)),
      youth:   svgUri(BG_BOLD_FEMALE, shapeYouthFemale(IC_BOLD)),
      adult:   svgUri(BG_BOLD_FEMALE, shapeAdultFemale(IC_BOLD)),
      senior:  svgUri(BG_BOLD_FEMALE, shapeSeniorFemale(IC_BOLD)),
      unknown: svgUri(BG_BOLD_FEMALE, shapeAdultFemale(IC_BOLD)),
    },
    unknown: {
      infant:  svgUri(BG_BOLD_UNKNOWN, shapeInfantNeutral(IC_BOLD)),
      toddler: svgUri(BG_BOLD_UNKNOWN, shapeToddlerMale(IC_BOLD)),
      youth:   svgUri(BG_BOLD_UNKNOWN, shapeYouthMale(IC_BOLD)),
      adult:   svgUri(BG_BOLD_UNKNOWN, shapeUnknown(IC_BOLD)),
      senior:  svgUri(BG_BOLD_UNKNOWN, shapeSeniorMale(IC_BOLD)),
      unknown: svgUri(BG_BOLD_UNKNOWN, shapeUnknown(IC_BOLD)),
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Default fallback icon (unknown adult, computed once). */
export const AVATAR_FALLBACK_DEFAULT: string = svgUri(BG.unknown, shapeUnknown(IC_UNKNOWN));

export function getAvatarIcon(gender: 'male' | 'female' | 'unknown' | string, ageCategory: AgeCategory): string {
  const table = _classic ?? (_classic = buildClassic());
  const g = gender === 'male' || gender === 'female' ? gender : 'unknown';
  return table[g]?.[ageCategory] ?? AVATAR_FALLBACK_DEFAULT;
}

export function getAvatarIconByStyle(gender: 'male' | 'female' | 'unknown' | string, ageCategory: AgeCategory, style: 'silhouette' | 'silhouette-flat' | 'silhouette-bold' | string): string {
  const g = gender === 'male' || gender === 'female' ? gender : 'unknown';
  if (style === 'silhouette-flat') {
    const table = _flat ?? (_flat = buildFlat());
    return table[g]?.[ageCategory] ?? getAvatarIcon(g, ageCategory);
  }
  if (style === 'silhouette-bold') {
    const table = _bold ?? (_bold = buildBold());
    return table[g]?.[ageCategory] ?? getAvatarIcon(g, ageCategory);
  }
  return getAvatarIcon(g, ageCategory);
}
