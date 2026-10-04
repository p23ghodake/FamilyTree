import { AgeCategory, MemberImageConfig } from '../types/FamilyTypes';
import { getAvatarIcon } from './avatarIcons';
import { sanitizeImageUrl } from './dataValidation';

export function getImageConfig(
  imageUrl: string | undefined,
  gender: string,
  ageCategory: AgeCategory,
  borderColor: string,
  isPrimary: boolean | undefined
): MemberImageConfig {
  const safeUrl = sanitizeImageUrl(imageUrl);
  const hasImage = safeUrl !== null;
  const fallbackUrl = getAvatarIcon(gender, ageCategory);

  return {
    finalImageUrl: hasImage ? safeUrl! : fallbackUrl,
    imageSourceType: hasImage ? 'provided' : 'defaultAvatar',
    imageShape: 'circle',
    imageBorderColorHex: borderColor,
    imageBorderWidthPx: isPrimary ? 4 : 3,
    imageHasShadow: !!isPrimary,
  };
}
