import { DisplaySettings } from '../types/FamilyTypes';

// Keep in sync with normalizeSettings() in supabase/functions/family-data/index.ts.
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  connectorStyle: 'static',
  connectorShape: 'elbow',
  connectorSpeed: 'normal',
  connectorTiming: 'cascade',
  connectorScope: 'all',
};

const ALLOWED: { [K in keyof DisplaySettings]: readonly DisplaySettings[K][] } = {
  connectorStyle: ['static', 'pulse', 'particles'],
  connectorShape: ['elbow', 'curve'],
  connectorSpeed: ['slow', 'normal', 'fast'],
  connectorTiming: ['cascade', 'together'],
  connectorScope: ['all', 'lineage'],
};

function pick<K extends keyof DisplaySettings>(source: Record<string, unknown>, key: K): DisplaySettings[K] {
  const value = source[key];
  return (ALLOWED[key] as readonly unknown[]).includes(value)
    ? value as DisplaySettings[K]
    : DEFAULT_DISPLAY_SETTINGS[key];
}

/** Full settings object; unknown or invalid values fall back to the defaults. */
export function normalizeDisplaySettings(input: unknown): DisplaySettings {
  const source = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    connectorStyle: pick(source, 'connectorStyle'),
    connectorShape: pick(source, 'connectorShape'),
    connectorSpeed: pick(source, 'connectorSpeed'),
    connectorTiming: pick(source, 'connectorTiming'),
    connectorScope: pick(source, 'connectorScope'),
  };
}

export function sameDisplaySettings(a: unknown, b: unknown): boolean {
  const x = normalizeDisplaySettings(a);
  const y = normalizeDisplaySettings(b);
  return (Object.keys(x) as Array<keyof DisplaySettings>).every(key => x[key] === y[key]);
}
