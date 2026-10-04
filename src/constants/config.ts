/**
 * Central configuration — all magic numbers and tunable constants live here.
 * Import from this file instead of hardcoding values across the codebase.
 */

export const CONFIG = {
  storage: {
    FAMILY_DATA_KEY: 'family-tree-data',
    THEME_KEY: 'ft-theme',
    AVATAR_STYLE_KEY: 'ft-avatar-style',
    TOUR_SEEN_KEY: 'ft-tour-seen',
  },

  generation: {
    /** Fallback gap (years) used when no parent-child graph is available */
    GAP_YEARS: 30,
  },

  age: {
    /** Upper bounds (inclusive) for each age category */
    INFANT_MAX: 1,
    TODDLER_MAX: 5,
    YOUTH_MAX: 17,
    ADULT_MAX: 59,
  },

  ui: {
    /** Maximum undo/redo history states kept in memory */
    MAX_UNDO_HISTORY: 10,
    /** Debounce delay (ms) before search filter recalculates */
    SEARCH_DEBOUNCE_MS: 300,
    /** Minimum age for marriage eligibility (male) */
    MARRIAGE_MIN_AGE_MALE: 21,
    /** Minimum age for marriage eligibility (female) */
    MARRIAGE_MIN_AGE_FEMALE: 18,
    /** Below this auto-fit zoom the tree is illegible, so we cap to it and centre on the root member instead */
    READABLE_MIN_ZOOM: 0.45,
  },

  share: {
    /** Max compressed URL length before QR code is suppressed */
    QR_MAX_LENGTH: 2500,
  },

  colors: {
    /** Tint blend amount for node background colors */
    TINT_AMOUNT: 0.1,
    /** Hex color for active/current spouse lines */
    SPOUSE_CURRENT_COLOR: '#E53935',
    /** Hex color for former/ended spouse lines */
    SPOUSE_FORMER_COLOR: '#94a3b8',
    /** Default parent-child connector line color */
    PARENT_CHILD_LINE_COLOR: '#cbd5e1',
  },
} as const;
