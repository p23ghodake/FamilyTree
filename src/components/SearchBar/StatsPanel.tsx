import React, { useMemo } from 'react';
import { useFamilyTree, isFiltersActive } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  UsersIcon, LayersIcon, CalendarIcon, ClockIcon,
  MapPinIcon, BriefcaseIcon, TrophyIcon, MaleIcon, FemaleIcon, UserIcon,
} from '../Icons';
import './StatsPanel.css';

const StatsPanel: React.FC<{ visible: boolean }> = ({ visible }) => {
  const { currentTree, filteredMembers, advancedMatchedIds, debouncedSearchQuery, state } = useFamilyTree();
  const { t } = useLanguage();

  const isTextSearch = debouncedSearchQuery.length > 0;
  const isAdvFilters = isFiltersActive(state.advancedFilters);
  const isFiltered = isTextSearch || isAdvFilters;

  const stats = useMemo(() => {
    if (!currentTree) return null;
    const members = isTextSearch && isAdvFilters
      ? filteredMembers.filter(m => advancedMatchedIds.has(m.id))
      : isTextSearch
        ? filteredMembers
        : isAdvFilters
          ? currentTree.members.filter(m => advancedMatchedIds.has(m.id))
          : currentTree.members;
    const total = members.length;

    const male = members.filter(m => m.gender === 'male').length;
    const female = members.filter(m => m.gender === 'female').length;
    const unknownGender = total - male - female;

    const genMap = new Map<number, number>();
    members.forEach(m => {
      if (m.generationIndex !== null) {
        genMap.set(m.generationIndex, (genMap.get(m.generationIndex) ?? 0) + 1);
      }
    });
    const generations = Array.from(genMap.entries()).sort((a, b) => a[0] - b[0]);
    const maxGen = generations.length > 0 ? Math.max(...generations.map(([gen]) => gen)) : 0;
    const maxGenCount = Math.max(...generations.map(([, count]) => count), 1);

    const birthYears = members.filter(m => m.birthYear !== null).map(m => m.birthYear!);
    const minYear = birthYears.length > 0 ? Math.min(...birthYears) : 0;
    const maxYear = birthYears.length > 0 ? Math.max(...birthYears) : 0;

    const deceased = members.filter(m => m.age !== null && m.deathYear !== null);
    const avgLifespan = deceased.length > 0
      ? Math.round(deceased.reduce((sum, m) => sum + m.age!, 0) / deceased.length)
      : null;

    const locMap = new Map<string, number>();
    members.forEach(m => { if (m.location) locMap.set(m.location, (locMap.get(m.location) ?? 0) + 1); });
    const topLocations = Array.from(locMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const occMap = new Map<string, number>();
    members.forEach(m => { if (m.occupation) occMap.set(m.occupation, (occMap.get(m.occupation) ?? 0) + 1); });
    const topOccupations = Array.from(occMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const withAge = members.filter(m => m.age !== null);
    const oldest = withAge.length > 0 ? withAge.reduce((a, b) => (a.age! > b.age! ? a : b)) : null;
    const youngest = withAge.length > 0 ? withAge.reduce((a, b) => (a.age! < b.age! ? a : b)) : null;

    return {
      total,
      maxGen,
      generations,
      maxGenCount,
      male,
      female,
      unknownGender,
      minYear,
      maxYear,
      avgLifespan,
      topLocations,
      topOccupations,
      oldest,
      youngest,
    };
  }, [currentTree, filteredMembers, advancedMatchedIds, isTextSearch, isAdvFilters]);

  if (!visible || !stats) return null;

  const genderTotal = stats.male + stats.female + stats.unknownGender;
  const malePct = genderTotal > 0 ? (stats.male / genderTotal) * 100 : 0;
  const femalePct = genderTotal > 0 ? (stats.female / genderTotal) * 100 : 0;

  return (
    <div className="stats-panel">
      {isFiltered && (
        <div className="stats-panel__filter-notice">
          <span>🔍</span>
          <span>{t.statsFilteredNotice(stats.total, currentTree?.members.length ?? stats.total)}</span>
        </div>
      )}
      <div className="stats-panel__cards">
        <div className="stats-panel__card">
          <span className="stats-panel__card-icon stats-panel__card-icon--blue">
            <UsersIcon size={15} />
          </span>
          <span className="stats-panel__card-value">{stats.total}</span>
          <span className="stats-panel__card-label">{t.statMembers}</span>
        </div>
        <div className="stats-panel__card">
          <span className="stats-panel__card-icon stats-panel__card-icon--violet">
            <LayersIcon size={15} />
          </span>
          <span className="stats-panel__card-value">{stats.maxGen}</span>
          <span className="stats-panel__card-label">{t.statGenerations}</span>
        </div>
        <div className="stats-panel__card">
          <span className="stats-panel__card-icon stats-panel__card-icon--amber">
            <CalendarIcon size={15} />
          </span>
          <span className="stats-panel__card-value">{stats.maxYear - stats.minYear}+</span>
          <span className="stats-panel__card-label">{t.statYearSpan}</span>
        </div>
        <div className="stats-panel__card">
          <span className="stats-panel__card-icon stats-panel__card-icon--teal">
            <ClockIcon size={15} />
          </span>
          <span className="stats-panel__card-value">{stats.avgLifespan ?? '—'}</span>
          <span className="stats-panel__card-label">{t.statAvgLifespan}</span>
        </div>
      </div>

      <div className="stats-panel__grid">
        <div className="stats-panel__section">
          <h3 className="stats-panel__section-title">
            <LayersIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
            {t.sectionMembersPerGen}
          </h3>
          <div className="stats-panel__bars">
            {stats.generations.map(([gen, count]) => (
              <div key={gen} className="stats-panel__bar-row">
                <span className="stats-panel__bar-label">{t.genLabel(gen)}</span>
                <div className="stats-panel__bar-track">
                  <div className="stats-panel__bar-fill" style={{ width: `${(count / stats.maxGenCount) * 100}%` }} />
                </div>
                <span className="stats-panel__bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-panel__section">
          <h3 className="stats-panel__section-title">
            <UsersIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
            {t.sectionGenderDist}
          </h3>
          <div className="stats-panel__gender-bar">
            <div className="stats-panel__gender-fill stats-panel__gender-fill--male" style={{ width: `${malePct}%` }} />
            <div className="stats-panel__gender-fill stats-panel__gender-fill--female" style={{ width: `${femalePct}%` }} />
          </div>
          <div className="stats-panel__gender-legend">
            <span className="stats-panel__gender-entry stats-panel__gender-entry--male">
              <MaleIcon size={13} />
              {t.genderMale(stats.male)}
            </span>
            <span className="stats-panel__gender-entry stats-panel__gender-entry--female">
              <FemaleIcon size={13} />
              {t.genderFemale(stats.female)}
            </span>
            {stats.unknownGender > 0 && (
              <span className="stats-panel__gender-entry">
                <UserIcon size={13} />
                {t.genderUnknown(stats.unknownGender)}
              </span>
            )}
          </div>
        </div>

        {stats.topLocations.length > 0 && (
          <div className="stats-panel__section">
            <h3 className="stats-panel__section-title">
              <MapPinIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
              {t.sectionTopLocations}
            </h3>
            <div className="stats-panel__list">
              {stats.topLocations.map(([loc, count]) => (
                <div key={loc} className="stats-panel__list-item">
                  <span>{loc}</span>
                  <span className="stats-panel__list-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.topOccupations.length > 0 && (
          <div className="stats-panel__section">
            <h3 className="stats-panel__section-title">
              <BriefcaseIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
              {t.sectionTopOccupations}
            </h3>
            <div className="stats-panel__list">
              {stats.topOccupations.map(([occ, count]) => (
                <div key={occ} className="stats-panel__list-item">
                  <span>{occ}</span>
                  <span className="stats-panel__list-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stats-panel__section">
          <h3 className="stats-panel__section-title">
            <TrophyIcon size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
            {t.sectionRecords}
          </h3>
          <div className="stats-panel__list">
            {stats.oldest && (
              <div className="stats-panel__list-item">
                <span>{t.recordOldest(stats.oldest.fullName)}</span>
                <span className="stats-panel__list-count">{stats.oldest.age} {t.statYrs}</span>
              </div>
            )}
            {stats.youngest && (
              <div className="stats-panel__list-item">
                <span>{t.recordYoungest(stats.youngest.fullName)}</span>
                <span className="stats-panel__list-count">{stats.youngest.age} {t.statYrs}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
