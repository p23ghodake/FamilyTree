import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { getAvatarFallback } from '../../processing/avatarFallback';
import { memberMatchesQuery } from '../../processing/searchFilter';
import { BabyIcon, CheckIcon, HeartIcon, SearchIcon, UserIcon, UsersIcon } from '../Icons';

export type RelationshipType = 'none' | 'childOf' | 'spouseOf' | 'parentOf';

interface RelationshipSectionProps {
  allMembers: StyledFamilyMember[];
  relationType: RelationshipType;
  relatedMemberId: string;
  error?: string;
  onRelationTypeChange: (type: RelationshipType) => void;
  onRelatedMemberChange: (id: string) => void;
}

export function memberFullName(m: StyledFamilyMember, lang: string): string {
  return lang === 'mr' && m.firstName_mr ? `${m.firstName_mr} ${m.lastName_mr ?? m.lastName}` : m.fullName;
}

export const RelationshipSection: React.FC<RelationshipSectionProps> = ({
  allMembers,
  relationType,
  relatedMemberId,
  error,
  onRelationTypeChange,
  onRelatedMemberChange,
}) => {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState('');

  const people = useMemo(() => {
    const matches = allMembers.filter(m => memberMatchesQuery(m, query));
    const selected = allMembers.find(m => m.id === relatedMemberId);
    return selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  }, [allMembers, query, relatedMemberId]);

  const tiles = [
    { value: 'childOf',  label: t.relTileChild,  icon: <BabyIcon size={22} /> },
    { value: 'spouseOf', label: t.relTileSpouse, icon: <HeartIcon size={22} /> },
    { value: 'parentOf', label: t.relTileParent, icon: <UsersIcon size={22} /> },
    { value: 'none',     label: t.relTileNone,   icon: <UserIcon size={22} /> },
  ] as const;

  const pickLabel = relationType === 'childOf' ? t.relChildOf
    : relationType === 'spouseOf' ? t.relSpouseOf
    : t.relParentOf;

  const chosen = relationType === 'spouseOf' ? allMembers.find(m => m.id === relatedMemberId) : undefined;
  const chosenMinAge = chosen?.gender === 'female' ? 18 : 21;
  const chosenUnderage = chosen && chosen.age !== null && chosen.age < chosenMinAge;

  return (
    <div className="mf-rel">
      <div className="mf-tiles" role="group" aria-label={t.sectionRelationship}>
        {tiles.map(tile => (
          <button
            key={tile.value}
            type="button"
            className="mf-tile"
            aria-pressed={relationType === tile.value}
            data-autofocus={relationType === tile.value || undefined}
            onClick={() => { setQuery(''); onRelationTypeChange(tile.value); }}
          >
            {tile.icon}
            {tile.label}
          </button>
        ))}
      </div>

      {relationType !== 'none' && (
        <>
          <label htmlFor="mf-rel-search" className="mf-label">{pickLabel}…</label>
          <div className="mf-search">
            <SearchIcon size={15} />
            <input
              id="mf-rel-search"
              type="search"
              className="mf-search__input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t.relSearchLabel}
              autoComplete="off"
            />
          </div>
          <div className="mf-people" role="group" aria-label={pickLabel}>
            {people.map(m => {
              const selected = m.id === relatedMemberId;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="mf-person"
                  aria-pressed={selected}
                  onClick={() => onRelatedMemberChange(m.id)}
                >
                  <img
                    className="mf-person__avatar"
                    src={m.imageConfig.finalImageUrl}
                    alt=""
                    onError={e => { (e.target as HTMLImageElement).src = getAvatarFallback(m.gender, m.ageCategory); }}
                  />
                  <span className="mf-person__name">{memberFullName(m, lang)}</span>
                  <span className="mf-person__meta">
                    {[m.birthYear ? `${t.bornAbbrev} ${m.birthYear}` : '', m.generationIndex !== null ? t.genFormat(m.generationIndex) : '']
                      .filter(Boolean).join(' · ')}
                  </span>
                  {selected && <CheckIcon size={16} className="mf-person__check" />}
                </button>
              );
            })}
            {people.length === 0 && <p className="mf-people__empty">{t.relNoMatches}</p>}
          </div>
          {chosenUnderage && !error && (
            <span className="mf-err">{t.belowMarriageAge(chosen.fullName, chosen.age!, chosenMinAge)}</span>
          )}
        </>
      )}
      {error && <span className="mf-err" role="alert">{error}</span>}
    </div>
  );
};
