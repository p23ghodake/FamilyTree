import { AgeCategory } from '../types/FamilyTypes';
import { getAvatarIcon, AVATAR_FALLBACK_DEFAULT } from './avatarIcons';

/**
 * Returns an inline SVG data URI for use as an <img> onError fallback.
 * Accepts an optional ageCategory for a more accurate icon; defaults to 'unknown'.
 */
export function getAvatarFallback(gender?: string, ageCategory?: AgeCategory): string {
  return getAvatarIcon(gender ?? 'unknown', ageCategory ?? 'unknown');
}

export { AVATAR_FALLBACK_DEFAULT };
