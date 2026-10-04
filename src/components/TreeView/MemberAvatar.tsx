import React from 'react';
import { StyledFamilyMember, AvatarStyle } from '../../types/FamilyTypes';
import { getAvatarFallback } from '../../processing/avatarFallback';
import {
  getInitials,
  getAgeCategoryBgColor,
  getAvatarEmoji,
  getFaAvatarBg,
  getFaIconClass,
  getFaIconColor,
} from '../../processing/avatarHelpers';
import './MemberAvatar.css';

/**
 * Renders a member's avatar using the active avatarStyle — identical logic to
 * PersonNode's inner circle content, extracted so the RelationshipPanel (and
 * any future panel) stays in sync with the tree view automatically.
 *
 * The parent is responsible for sizing the wrapper (width/height/border-radius).
 * This component fills 100% of its parent and centres its content.
 */
export const MemberAvatar: React.FC<{
  member: StyledFamilyMember;
  avatarStyle: AvatarStyle;
  /** Displayed name used for initials and img alt text. Defaults to fullName. */
  displayName?: string;
}> = ({ member, avatarStyle, displayName }) => {
  const name = displayName ?? member.fullName;

  if (member.imageConfig.imageSourceType === 'provided') {
    return (
      <img
        src={member.imageConfig.finalImageUrl}
        alt={name}
        onError={e => {
          const img = e.target as HTMLImageElement;
          if (img.dataset.fallbackApplied) return;
          img.dataset.fallbackApplied = 'true';
          img.src = getAvatarFallback(member.gender, member.ageCategory);
        }}
      />
    );
  }

  if (avatarStyle.startsWith('silhouette')) {
    return (
      <div
        className="member-avatar__fa"
        style={{ background: getFaAvatarBg(member.ageCategory, member.gender, avatarStyle) }}
      >
        <i
          className={`fa-solid ${getFaIconClass(member.gender, member.ageCategory)}`}
          style={{ color: getFaIconColor(member.gender, avatarStyle) }}
        />
      </div>
    );
  }

  if (avatarStyle === 'initials') {
    return (
      <div
        className="member-avatar__initials"
        style={{
          background: `${member.baseColorHex}28`,
          color: member.nodeBorderColorHex,
        }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div
      className="member-avatar__emoji"
      style={{ background: getAgeCategoryBgColor(member.ageCategory) }}
    >
      {getAvatarEmoji(member.gender, member.ageCategory)}
    </div>
  );
};
