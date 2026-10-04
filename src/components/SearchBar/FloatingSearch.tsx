import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import { useFamilyTree, isFiltersActive } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import {
  SearchIcon, SlidersHorizontalIcon,
  ChevronUpIcon, ChevronDownIcon, GripVerticalIcon,
} from '../Icons';
import { getAvatarFallback } from '../../processing/avatarFallback';
import FilterPanel from '../SearchBar/FilterPanel';
import './FloatingSearch.css';

const FloatingSearch: React.FC = () => {
  const { state, dispatch, matchedMemberIds, currentTree, filteredMembers, advancedMatchedIds, debouncedSearchQuery } = useFamilyTree();
  const { t } = useLanguage();

  // hasQuery: immediate — drives clear-button visibility and selectItem clear behaviour
  const hasQuery = state.searchQuery.length > 0;
  // isSearching: debounced — drives match badge, dropdown list, header text
  // (matches filteredMembers which is also debounced, preventing badge flicker)
  const isSearching = debouncedSearchQuery.length > 0;
  const totalMembers = currentTree?.members.length ?? 0;
  const matchCount = matchedMemberIds.size;
  const filtersActive = isFiltersActive(state.advancedFilters);

  const [collapsed, setCollapsed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const listItems: StyledFamilyMember[] = isSearching && filtersActive
    ? filteredMembers.filter(m => advancedMatchedIds.has(m.id))
    : isSearching
      ? filteredMembers
      : filtersActive
        ? (currentTree?.members ?? []).filter(m => advancedMatchedIds.has(m.id))
        : (currentTree?.members ?? []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const pw = panel.offsetWidth || 300;
    const ph = panel.offsetHeight || 56;
    setPos({ x: cw - pw - 20, y: ch - ph - 72 });
    setReady(true);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container || !ready) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    setPos(prev => ({
      x: Math.min(prev.x, cw - panel.offsetWidth),
      y: Math.min(prev.y, ch - panel.offsetHeight),
    }));
  }, [collapsed, listOpen, ready]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input')) return;
    e.preventDefault();
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    isDragging.current = true;
    const cr = container.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - cr.left - pos.x,
      y: e.clientY - cr.top - pos.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const p = panelRef.current;
      const c = p?.parentElement;
      if (!p || !c) return;
      const cr2 = c.getBoundingClientRect();
      const x = Math.min(Math.max(ev.clientX - cr2.left - dragOffset.current.x, 0), c.clientWidth - p.offsetWidth);
      const y = Math.min(Math.max(ev.clientY - cr2.top - dragOffset.current.y, 0), c.clientHeight - p.offsetHeight);
      setPos({ x, y });
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePanel = panelRef.current?.contains(target);
      const insidePortal = filterPanelRef.current?.contains(target);
      if (!insidePanel && !insidePortal) {
        setListOpen(false);
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setActiveIdx(-1);
  }, [state.searchQuery]);

  const selectItem = useCallback((id: string) => {
    dispatch({ type: 'SELECT_MEMBER', payload: id });
    if (hasQuery) dispatch({ type: 'SET_SEARCH', payload: '' });
    setListOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
  }, [dispatch, hasQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen || listItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(activeIdx + 1, listItems.length - 1);
      setActiveIdx(next);
      dispatch({ type: 'SELECT_MEMBER', payload: listItems[next].id });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(activeIdx - 1, 0);
      setActiveIdx(prev);
      dispatch({ type: 'SELECT_MEMBER', payload: listItems[prev].id });
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectItem(listItems[activeIdx].id);
    } else if (e.key === 'Escape') {
      setListOpen(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className={`floating-search${collapsed ? ' floating-search--collapsed' : ''}`}
      style={ready
        ? { left: pos.x, top: pos.y }
        : { left: 0, top: 0, opacity: 0, pointerEvents: 'none' }
      }
    >
      <div className="floating-search__handle" onMouseDown={handleDragStart}>
        <span className="floating-search__grip"><GripVerticalIcon size={14} /></span>
        <SearchIcon size={13} />
        {isSearching && (
          <span className="floating-search__match-badge">{matchCount} / {totalMembers}</span>
        )}
        <button
          className="floating-search__collapse-btn"
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? t.searchExpandTooltip : t.searchCollapseTooltip}
          aria-label={collapsed ? t.searchExpandTooltip : t.searchCollapseTooltip}
        >
          {collapsed ? <ChevronUpIcon size={13} /> : <ChevronDownIcon size={13} />}
        </button>
      </div>

      {!collapsed && (
        <div className="floating-search__body">
          <div className="floating-search__input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="floating-search__input"
              placeholder={t.searchPlaceholder}
              value={state.searchQuery}
              onChange={e => {
                dispatch({ type: 'SET_SEARCH', payload: e.target.value });
                setListOpen(true);
              }}
              onFocus={() => setListOpen(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {state.searchQuery && (
              <button
                className="floating-search__clear"
                onClick={() => { dispatch({ type: 'SET_SEARCH', payload: '' }); setListOpen(true); inputRef.current?.focus(); }}
                title={t.searchClear}
                aria-label={t.searchClear}
              >✕</button>
            )}
            <button
              className={`floating-search__filter-btn${showFilters ? ' floating-search__filter-btn--active' : ''}${filtersActive ? ' floating-search__filter-btn--has-filters' : ''}`}
              onClick={() => { setShowFilters(v => !v); }}
              title={filtersActive ? t.searchFiltersActive : t.searchAdvancedFilters}
              aria-label={filtersActive ? t.searchFiltersActive : t.searchAdvancedFilters}
              type="button"
            >
              <SlidersHorizontalIcon size={13} />
              {filtersActive && <span className="floating-search__filter-dot" />}
            </button>
          </div>

          {listOpen && listItems.length > 0 && (
            <div className="floating-search__list">
              <div className="floating-search__list-header">
                {isSearching
                  ? <span>{t.searchResultsHeader(matchCount, state.searchQuery)}</span>
                  : <span>{t.searchAllMembersHeader(totalMembers)}</span>
                }
              </div>
              {listItems.map((m, i) => (
                <button
                  key={m.id}
                  className={`floating-search__list-item${i === activeIdx ? ' floating-search__list-item--active' : ''}${state.selectedMemberId === m.id ? ' floating-search__list-item--selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); selectItem(m.id); }}
                  onMouseEnter={() => { setActiveIdx(i); dispatch({ type: 'SELECT_MEMBER', payload: m.id }); }}
                >
                  <img
                    className="floating-search__list-avatar"
                    src={m.imageConfig.finalImageUrl}
                    alt={m.fullName}
                    onError={e => { (e.target as HTMLImageElement).src = getAvatarFallback(m.gender, m.ageCategory); }}
                  />
                  <div className="floating-search__list-info">
                    <span className="floating-search__list-name">{m.fullName}</span>
                    <span className="floating-search__list-meta">
                      {m.birthYear ?? t.unknownYear} – {m.deathYear ?? t.present}
                      {m.generationIndex !== null ? ` · ${t.genFormat(m.generationIndex)}` : ''}
                      {m.location ? ` · ${m.location}` : ''}
                    </span>
                  </div>
                  <span className="floating-search__list-dot" style={{ background: m.baseColorHex }} />
                </button>
              ))}
            </div>
          )}

          {listOpen && listItems.length === 0 && hasQuery && (
            <div className="floating-search__empty">{t.searchNoResults(state.searchQuery)}</div>
          )}

          {state.data && state.data.familyTreesStyled.length > 1 && (
            <select
              className="floating-search__tree-select"
              value={state.selectedTreeId ?? ''}
              onChange={e => dispatch({ type: 'SELECT_TREE', payload: e.target.value })}
            >
              {state.data.familyTreesStyled.map(tree => (
                <option key={tree.familyTreeId} value={tree.familyTreeId}>{tree.familyTreeDisplayName}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {showFilters && !collapsed && panelRef.current && (() => {
        const rect = panelRef.current!.getBoundingClientRect();
        const popupHeight = 140;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const showBelow = spaceAbove < popupHeight + 8 && spaceBelow >= popupHeight + 8;
        return ReactDOM.createPortal(
          <div
            ref={filterPanelRef}
            className="floating-search__filter-portal"
            style={{
              position: 'fixed',
              left: rect.left,
              ...(showBelow
                ? { top: rect.bottom + 6 }
                : { bottom: window.innerHeight - rect.top + 6 }),
              width: rect.width,
              zIndex: 2000,
            }}
          >
            <FilterPanel
              visible={showFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default FloatingSearch;
