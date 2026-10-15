import React, { useState } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyTree } from '../../types/FamilyTypes';
import { getAvatarFallback } from '../../processing/avatarFallback';
import { getDisplayFirstName } from '../../processing/displayName';

interface MarriageHistorySectionProps {
  editMemberId: string;
  currentTree: StyledFamilyTree;
}

export const MarriageHistorySection: React.FC<MarriageHistorySectionProps> = ({
  editMemberId,
  currentTree,
}) => {
  const { dispatch } = useFamilyTree();
  const { t, lang } = useLanguage();

  const [endMarriageForm, setEndMarriageForm] = useState<{
    spouse1Id: string; spouse2Id: string; endYear: string;
    startYear: number | null;
    endReason: 'divorce' | 'death' | 'annulment' | 'separation';
  } | null>(null);

  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const marriages = currentTree.relationships.spouses.filter(
    r => r.spouse1Id === editMemberId || r.spouse2Id === editMemberId
  );

  const formatMarriageEndReason = (reason: 'divorce' | 'death' | 'annulment' | 'separation' | null | undefined) => {
    switch (reason) {
      case 'divorce':    return t.optionDivorce;
      case 'death':      return t.optionDeath;
      case 'annulment':  return t.optionAnnulment;
      case 'separation': return t.optionSeparation;
      default:           return '';
    }
  };

  if (marriages.length === 0) return null;

  return (
    <div className="member-form__section">
      <h3 className="member-form__section-title">
        {t.sectionMarriageHistory}
        <span className="member-form__section-hint">{t.marriageCount(marriages.length)}</span>
      </h3>
      {marriages.map(r => {
        const spouseId = r.spouse1Id === editMemberId ? r.spouse2Id : r.spouse1Id;
        const spouseMember = currentTree.members.find(m => m.id === spouseId);
        const isCurrent = r.status === 'current';
        const isEditing = endMarriageForm?.spouse1Id === r.spouse1Id && endMarriageForm?.spouse2Id === r.spouse2Id;

        return (
          <div key={spouseId} className={`member-form__marriage-row${isCurrent ? '' : ' member-form__marriage-row--former'}`}>
            <img
              src={spouseMember?.imageConfig.finalImageUrl ?? getAvatarFallback(spouseMember?.gender, spouseMember?.ageCategory)}
              alt={spouseMember ? getDisplayFirstName(spouseMember, lang) : undefined}
              className="member-form__marriage-avatar"
              onError={e => { (e.target as HTMLImageElement).src = getAvatarFallback(spouseMember?.gender, spouseMember?.ageCategory); }}
            />
            <div className="member-form__marriage-info">
              <span className="member-form__marriage-name">{spouseMember ? getDisplayFirstName(spouseMember, lang) : spouseId}</span>
              <span className="member-form__marriage-years">
                {t.marriedYear(r.marriageYear ?? null)}
                {!isCurrent && r.endYear ? ` → ${r.endYear}${r.endReason ? ` (${formatMarriageEndReason(r.endReason)})` : ''}` : ''}
              </span>
            </div>
            <span className={`member-form__marriage-badge${isCurrent ? ' member-form__marriage-badge--current' : ' member-form__marriage-badge--former'}`}>
              {isCurrent ? t.currentMarriage : t.formerMarriage}
            </span>
            {(() => {
              const saved = r.marriageDate ?? '';
              const draft = dateDrafts[spouseId] ?? saved;
              const afterEnd = !isCurrent && !!r.endYear && !!draft && parseInt(draft.slice(0, 4)) > r.endYear;
              return (
                <div className="member-form__marriage-end-form">
                  <label>
                    {t.labelMarriageDate}{' '}
                    <input
                      type="date"
                      className="member-form__input"
                      value={/^\d{4}-\d{2}-\d{2}$/.test(draft) ? draft : ''}
                      max={!isCurrent && r.endYear ? `${r.endYear}-12-31` : undefined}
                      onChange={e => setDateDrafts(d => ({ ...d, [spouseId]: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="member-form__btn member-form__btn--primary"
                    disabled={draft === saved || afterEnd}
                    onClick={() => {
                      dispatch({
                        type: 'UPDATE_MARRIAGE_DATE',
                        payload: {
                          treeId: currentTree.familyTreeId,
                          spouse1Id: r.spouse1Id,
                          spouse2Id: r.spouse2Id,
                          marriageDate: draft || null,
                        },
                      });
                      setDateDrafts(d => { const { [spouseId]: _omit, ...rest } = d; return rest; });
                    }}
                  >
                    {t.btnConfirm}
                  </button>
                </div>
              );
            })()}
            {isCurrent && !isEditing && (
              <button
                type="button"
                className="member-form__marriage-end-btn"
                onClick={() => setEndMarriageForm({
                  spouse1Id: r.spouse1Id,
                  spouse2Id: r.spouse2Id,
                  endYear: '',
                  startYear: r.marriageYear ?? null,
                  endReason: 'divorce',
                })}
              >
                {t.endMarriage}
              </button>
            )}
            {isCurrent && isEditing && endMarriageForm && (
              <div className="member-form__marriage-end-form">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="member-form__input member-form__marriage-end-year"
                  placeholder={t.placeholderEndYear}
                  value={endMarriageForm.endYear}
                  onChange={e => setEndMarriageForm(f => f ? { ...f, endYear: e.target.value.replace(/\D/g,'').slice(0,4) } : f)}
                />
                <select
                  className="member-form__input member-form__select"
                  value={endMarriageForm.endReason}
                  onChange={e => setEndMarriageForm(f => f ? { ...f, endReason: e.target.value as 'divorce' | 'death' | 'annulment' | 'separation' } : f)}
                >
                  <option value="divorce">{t.optionDivorce}</option>
                  <option value="death">{t.optionDeath}</option>
                  <option value="annulment">{t.optionAnnulment}</option>
                  <option value="separation">{t.optionSeparation}</option>
                </select>
                <button
                  type="button"
                  className="member-form__btn member-form__btn--primary member-form__marriage-end-confirm"
                  disabled={
                    endMarriageForm.endYear.length !== 4 ||
                    (endMarriageForm.startYear !== null &&
                      parseInt(endMarriageForm.endYear) < endMarriageForm.startYear)
                  }
                  onClick={() => {
                    if (!endMarriageForm.endYear) return;
                    dispatch({
                      type: 'END_MARRIAGE',
                      payload: {
                        treeId:    currentTree.familyTreeId,
                        spouse1Id: endMarriageForm.spouse1Id,
                        spouse2Id: endMarriageForm.spouse2Id,
                        endYear:   parseInt(endMarriageForm.endYear),
                        endReason: endMarriageForm.endReason,
                      },
                    });
                    setEndMarriageForm(null);
                  }}
                >
                  {t.btnConfirm}
                </button>
                <button
                  type="button"
                  className="member-form__btn member-form__btn--ghost"
                  onClick={() => setEndMarriageForm(null)}
                >
                  {t.btnCancel}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
