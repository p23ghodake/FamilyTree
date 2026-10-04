export type ThemeName = 'light' | 'dark' | 'sepia' | 'forest' | 'ocean' | 'sunset';

export interface ThemeDefinition {
  id: ThemeName;
  label: string;
  emoji: string;
  /** CSS swatch colours shown in the picker [bg, accent] */
  swatchBg: string;
  swatchAccent: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'light',
    label: 'Light',
    emoji: '☀️',
    swatchBg: '#ffffff',
    swatchAccent: '#3b82f6',
  },
  {
    id: 'dark',
    label: 'Dark',
    emoji: '🌙',
    swatchBg: '#1e293b',
    swatchAccent: '#60a5fa',
  },
  {
    id: 'sepia',
    label: 'Sepia',
    emoji: '📜',
    swatchBg: '#fffdf7',
    swatchAccent: '#b07030',
  },
  {
    id: 'forest',
    label: 'Forest',
    emoji: '🌿',
    swatchBg: '#f5fbf5',
    swatchAccent: '#2e7d32',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    emoji: '🌊',
    swatchBg: '#f0f8ff',
    swatchAccent: '#0277bd',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    emoji: '🌅',
    swatchBg: '#fffcf8',
    swatchAccent: '#e65100',
  },
];

export const DEFAULT_THEME: ThemeName = 'light';
export const THEME_STORAGE_KEY = 'ft-theme';

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable
  }
}

export function loadSavedTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    if (saved && THEMES.some(t => t.id === saved)) return saved;
  } catch {
    // ignore
  }
  // Auto-detect OS dark mode preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return DEFAULT_THEME;
}
