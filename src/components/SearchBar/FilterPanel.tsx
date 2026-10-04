import React, { useMemo } from 'react';
import { useFamilyTree, AdvancedFilters, isFiltersActive } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ActivityIcon, HeartIcon } from '../Icons';
import './FilterPanel.css';

const FilterPanel: React.FC<{
  visible: boolean;
  onClose?: () => void;
  panelRef?: React.RefObject<HTMLDivElement>;
}> = ({ visible, onClose, panelRef }) => {
  const { state, dispatch, currentTree } = useFamilyTree();
  const { t } = useLanguage();
  const f = state.advancedFilters;
  const active = isFiltersActive(f);

  const locations = useMemo(() => {
    const locSet = new Set<string>();
    (currentTree?.members ?? []).forEach(m => { if (m.location) locSet.add(m.location); });
    return Array.from(locSet).sort();
  }, [currentTree]);

  const marriageEligibleCount = useMemo(() => {
    const members = currentTree?.members ?? [];
    const spouses = currentTree?.relationships.spouses ?? [];
    let female = 0;
    let male = 0;

    members.forEach(m => {
      if (m.deathYear !== null || m.age === null || m.gender === 'unknown') return;
      const minAge = m.gender === 'female' ? 18 : 21;
      if (m.age < minAge) return;
      const hasCurrentSpouse = spouses.some(
        r => (r.spouse1Id === m.id || r.spouse2Id === m.id) && r.status === 'current'
      );
      if (hasCurrentSpouse) return;
      if (m.gender === 'female') female++;
      else male++;
    });

    return { female, male, total: female + male };
  }, [currentTree]);

  const set = (patch: Partial<AdvancedFilters>) =>
    dispatch({ type: 'SET_ADVANCED_FILTER', payload: patch });

  if (!visible) return null;

  return (
    <div className="filter-panel" ref={panelRef}>
      <div className="filter-panel__header">
        <span className="filter-panel__title">{t.filtersTitle}</span>
        <div className="filter-panel__header-actions">
          {active && (
            <button className="filter-panel__clear" onClick={() => dispatch({ type: 'CLEAR_ADVANCED_FILTERS' })}>
              {t.filterClear}
            </button>
          )}
          {onClose && (
            <button className="filter-panel__close" onClick={onClose} title={t.close}>✕</button>
          )}
        </div>
      </div>

      <button
        className={`filter-panel__toggle${f.livingOnly ? ' filter-panel__toggle--on' : ''}`}
        onClick={() => set({ livingOnly: !f.livingOnly })}
      >
        <span className="filter-panel__toggle-dot" />
        <ActivityIcon size={13} />
        {t.filterLivingOnly}
      </button>

      <button
        className={`filter-panel__toggle filter-panel__toggle--marriage${f.marriageEligible ? ' filter-panel__toggle--on filter-panel__toggle--marriage-on' : ''}`}
        onClick={() => set({ marriageEligible: !f.marriageEligible })}
      >
        <span className="filter-panel__toggle-dot" />
        <HeartIcon size={13} />
        <span className="filter-panel__toggle-label">{t.filterMarriageEligible}</span>
        {marriageEligibleCount.total > 0 && (
          <span className="filter-panel__marriage-count">{marriageEligibleCount.total}</span>
        )}
      </button>

      {f.marriageEligible && marriageEligibleCount.total > 0 && (
        <div className="filter-panel__marriage-breakdown">
          <span className="filter-panel__marriage-stat filter-panel__marriage-stat--female">
            ♀ {marriageEligibleCount.female} {t.labelFemale} <span className="filter-panel__marriage-age">(18+)</span>
          </span>
          <span className="filter-panel__marriage-stat filter-panel__marriage-stat--male">
            ♂ {marriageEligibleCount.male} {t.labelMale} <span className="filter-panel__marriage-age">(21+)</span>
          </span>
        </div>
      )}

      <div className="filter-panel__row">
        <span className="filter-panel__label">{t.labelLocation}</span>
        <select
          className="filter-panel__select"
          value={f.location}
          onChange={e => set({ location: e.target.value })}
        >
          <option value="">{t.relNone}</option>
          {locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__row">
        <span className="filter-panel__label">{t.filterDimLabel}</span>
        <div className="filter-panel__segmented" role="group" aria-label={t.filterDimLabel}>
          <button
            className={`filter-panel__segmented-btn${f.dimMode === 'dim' ? ' filter-panel__segmented-btn--on' : ''}`}
            onClick={() => set({ dimMode: 'dim' })}
            aria-pressed={f.dimMode === 'dim'}
          >
            {t.filterDimOption}
          </button>
          <button
            className={`filter-panel__segmented-btn${f.dimMode === 'hide' ? ' filter-panel__segmented-btn--on' : ''}`}
            onClick={() => set({ dimMode: 'hide' })}
            aria-pressed={f.dimMode === 'hide'}
          >
            {t.filterHideOption}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
