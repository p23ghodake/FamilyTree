import React, { useMemo } from 'react';
import { useFamilyTree, AdvancedFilters, isFiltersActive } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { ActivityIcon, HeartIcon, UserIcon } from '../Icons';
import './FilterPanel.css';

const FilterPanel: React.FC<{
  visible: boolean;
  onClose?: () => void;
  panelRef?: React.RefObject<HTMLDivElement>;
}> = ({ visible, onClose, panelRef }) => {
  const { state, dispatch, currentTree } = useFamilyTree();
  const { t } = useLanguage();
  const f = state.advancedFilters;
  const active = isFiltersActive(f) || f.hideFemale;

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
        className={`filter-panel__toggle${f.hideFemale ? ' filter-panel__toggle--on' : ''}`}
        onClick={() => set({ hideFemale: !f.hideFemale })}
        aria-pressed={f.hideFemale}
      >
        <span className="filter-panel__toggle-dot" />
        <UserIcon size={13} />
        {f.hideFemale ? t.filterShowFemale : t.filterHideFemale}
      </button>

      <button
        className={`filter-panel__toggle filter-panel__toggle--marriage${f.marriageEligible ? ' filter-panel__toggle--on filter-panel__toggle--marriage-on' : ''}`}
        onClick={() => set({ marriageEligible: !f.marriageEligible })}
      >
        <span className="filter-panel__toggle-dot" />
        <HeartIcon size={13} />
        <span className="filter-panel__toggle-label">{t.filterMarriageEligible}</span>
        {marriageEligibleCount > 0 && (
          <span className="filter-panel__marriage-count">{marriageEligibleCount}</span>
        )}
      </button>

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
    </div>
  );
};

export default FilterPanel;
