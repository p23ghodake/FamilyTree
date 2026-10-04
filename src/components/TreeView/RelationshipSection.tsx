import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { BabyIcon, HeartIcon, UserIcon, UsersIcon } from '../Icons';

interface RelationshipSectionProps {
  allMembers: StyledFamilyMember[];
  relationType: 'none' | 'childOf' | 'spouseOf' | 'parentOf';
  relatedMemberId: string;
  onRelationTypeChange: (type: 'none' | 'childOf' | 'spouseOf' | 'parentOf') => void;
  onRelatedMemberChange: (id: string) => void;
}

export const RelationshipSection: React.FC<RelationshipSectionProps> = ({
  allMembers,
  relationType,
  relatedMemberId,
  onRelationTypeChange,
  onRelatedMemberChange,
}) => {
  const { t } = useLanguage();

  const candidates = relationType !== 'none' ? allMembers : [];

  return (
    <div className="member-form__section member-form__section--rel">
      <div className="member-form__rel-header">
        <h3 className="member-form__section-title">{t.sectionRelationship}</h3>
        <div className="member-form__rel-options">
          {(
            [
              { value: 'none',     label: t.relNone,     icon: <UserIcon  size={12} /> },
              { value: 'childOf',  label: t.relChildOf,  icon: <BabyIcon  size={12} /> },
              { value: 'spouseOf', label: t.relSpouseOf, icon: <HeartIcon size={12} /> },
              { value: 'parentOf', label: t.relParentOf, icon: <UsersIcon size={12} /> },
            ] as const
          ).map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`member-form__rel-chip ${relationType === opt.value ? 'member-form__rel-chip--active' : ''}`}
              onClick={() => onRelationTypeChange(opt.value)}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {relationType !== 'none' && (
        <div className="member-form__rel-select-row">
          <label htmlFor="rel-member-select" className="member-form__rel-select-label">
            {relationType === 'childOf' && t.labelParent}
            {relationType === 'spouseOf' && t.labelSpouse}
            {relationType === 'parentOf' && t.labelChild}
          </label>
          <div className="member-form__rel-select-wrap">
            <select
              id="rel-member-select"
              value={relatedMemberId}
              onChange={e => onRelatedMemberChange(e.target.value)}
              className="member-form__input member-form__select"
            >
              <option value="">{t.chooseMember}</option>
              {candidates.map(m => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                  {m.birthYear ? ` (${t.bornAbbrev} ${m.birthYear})` : ''}
                  {m.gender !== 'unknown' ? ` · ${m.gender === 'male' ? t.optionMale : t.optionFemale}` : ''}
                </option>
              ))}
            </select>
            {relationType === 'spouseOf' && relatedMemberId && (() => {
              const chosen = allMembers.find(m => m.id === relatedMemberId);
              if (!chosen) return null;
              const minAge = chosen.gender === 'female' ? 18 : 21;
              if (chosen.age !== null && chosen.age < minAge) {
                return (
                  <span className="member-form__err">
                    {t.belowMarriageAge(chosen.fullName, chosen.age, minAge)}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
