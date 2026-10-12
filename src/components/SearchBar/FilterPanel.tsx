import React, { useMemo } from 'react';
import { useFamilyTree, AdvancedFilters, countActiveFilters } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ActivityIcon, HeartIcon, MapPinIcon, UserIcon } from '../Icons';
import './FilterPanel.css';

const FilterPanel: React.FC = () => {
  const { state, dispatch, currentTree } = useFamilyTree();
  const { t } = useLanguage();
  const f = state.advancedFilters;
  const activeCount = countActiveFilters(f);

  const locations = useMemo(() => {
    const locSet = new Set<string>();
    (currentTree?.members ?? []).forEach(m => { if (m.location) locSet.add(m.location); });
    return Array.from(locSet).sort();
  }, [currentTree]);

  const marriageEligibleCount = useMemo(() => {
    const members = currentTree?.members ?? [];
    const spouses = currentTree?.relationships.spouses ?? [];
    return members.filter(m => {
      if (m.deathYear !== null || m.age === null || m.gender === 'unknown') return false;
      if (m.age < (m.gender === 'female' ? 18 : 21)) return false;
      return !spouses.some(r => (r.spouse1Id === m.id || r.spouse2Id === m.id) && r.status === 'current');
    }).length;
  }, [currentTree]);

  const set = (patch: Partial<AdvancedFilters>) =>
    dispatch({ type: 'SET_ADVANCED_FILTER', payload: patch });
  const chipClass = (on: boolean, extra = '') => `filter-panel__chip${on ? ' filter-panel__chip--on' : ''}${extra}`;

  return (
    <div className="filter-panel" role="group" aria-label={t.filtersTitle}>
      <div className="filter-panel__chips">
        <button type="button" className={chipClass(f.livingOnly)} aria-pressed={f.livingOnly} onClick={() => set({ livingOnly: !f.livingOnly })}>
          <ActivityIcon size={12} />{t.filterLivingOnly}
        </button>
        <button type="button" className={chipClass(f.hideFemale)} aria-pressed={f.hideFemale} onClick={() => set({ hideFemale: !f.hideFemale })}>
          <UserIcon size={12} />{t.filterHideFemale}
        </button>
        <button
          type="button"
          className={chipClass(f.marriageEligible, ' filter-panel__chip--marriage')}
          aria-pressed={f.marriageEligible}
          onClick={() => set({ marriageEligible: !f.marriageEligible })}
        >
          <HeartIcon size={12} />{t.filterMarriageEligible}
          {marriageEligibleCount > 0 && <span className="filter-panel__count">{marriageEligibleCount}</span>}
        </button>
        <label className={chipClass(f.location !== '')}>
          <MapPinIcon size={12} />
          <select
            className="filter-panel__select"
            aria-label={t.labelLocation}
            value={f.location}
            onChange={e => set({ location: e.target.value })}
          >
            <option value="">{t.filterAnyLocation}</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </label>
      </div>
      <div className="filter-panel__foot">
        <span>{activeCount > 0 ? t.filtersOnCount(activeCount) : t.filtersTitle}</span>
        {activeCount > 0 && (
          <button type="button" className="filter-panel__clear" onClick={() => dispatch({ type: 'CLEAR_ADVANCED_FILTERS' })}>
            {t.filterClear}
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
