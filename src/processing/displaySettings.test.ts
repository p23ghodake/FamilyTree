import { DEFAULT_DISPLAY_SETTINGS, normalizeDisplaySettings, sameDisplaySettings } from './displaySettings';
import { validateRawFamilyData } from './dataValidation';

const tree = { familyTreeId: 't', familyTreeDisplayName: 'T', members: [{ id: 'a', firstName: 'A', lastName: 'B', gender: 'male' }] };

it('fills in defaults and drops unknown values', () => {
  expect(normalizeDisplaySettings(undefined)).toEqual(DEFAULT_DISPLAY_SETTINGS);
  expect(normalizeDisplaySettings({ connectorStyle: 'pulse', connectorSpeed: 'warp', extra: 1 })).toEqual({
    ...DEFAULT_DISPLAY_SETTINGS, connectorStyle: 'pulse',
  });
});

it('treats missing settings as the defaults when comparing', () => {
  expect(sameDisplaySettings(undefined, DEFAULT_DISPLAY_SETTINGS)).toBe(true);
  expect(sameDisplaySettings(undefined, { connectorStyle: 'particles' })).toBe(false);
});

it('keeps settings through validation only when the file has them', () => {
  expect(validateRawFamilyData({ familyTrees: [tree] }).data).not.toHaveProperty('settings');
  expect(validateRawFamilyData({ familyTrees: [tree], settings: { connectorStyle: 'particles' } }).data?.settings)
    .toEqual({ ...DEFAULT_DISPLAY_SETTINGS, connectorStyle: 'particles' });
});
