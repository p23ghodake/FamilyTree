import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback,
} from 'react';
import ReactDOM from 'react-dom';
import { useFamilyTree, isFiltersActive, countActiveFilters } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { SearchIcon, SlidersHorizontalIcon, GripVerticalIcon, XIcon } from '../Icons';
import { getAvatarFallback } from '../../processing/avatarFallback';
import { getDisplayFirstName } from '../../processing/displayName';
import FilterPanel from './FilterPanel';
import './FloatingSearch.css';

const FILTER_POPOVER_HEIGHT = 150;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}

const FloatingSearch: React.FC = () => {
  const { state, dispatch, matchedMemberIds, currentTree, filteredMembers, advancedMatchedIds, debouncedSearchQuery } = useFamilyTree();
  const { t, lang } = useLanguage();

  // hasQuery is immediate; isSearching is debounced to match filteredMembers and avoid flicker.
  const hasQuery = state.searchQuery.length > 0;
  const isSearching = debouncedSearchQuery.length > 0;
  const totalMembers = currentTree?.members.length ?? 0;
  const matchCount = matchedMemberIds.size;
  const filtersActive = isFiltersActive(state.advancedFilters);
  const filterCount = countActiveFilters(state.advancedFilters);

  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const focusInputOnOpen = useRef(false);
  const focusOpenButtonOnClose = useRef(false);
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
    setPos({ x: 16, y: 16 });
    setReady(true);
  }, []);

  // Keep the panel inside the tree area when it grows or the window shrinks.
  useEffect(() => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container || !ready) return;
    setPos(prev => ({
      x: Math.max(0, Math.min(prev.x, container.clientWidth - panel.offsetWidth)),
      y: Math.max(0, Math.min(prev.y, container.clientHeight - panel.offsetHeight)),
    }));
  }, [expanded, listOpen, ready]);

  const open = useCallback(() => {
    focusInputOnOpen.current = true;
    setExpanded(true);
  }, []);

  const collapse = useCallback((restoreFocus: boolean) => {
    focusOpenButtonOnClose.current = restoreFocus;
    setExpanded(false);
    setListOpen(false);
    setShowFilters(false);
    setActiveIdx(-1);
  }, []);

  useEffect(() => {
    if (expanded && focusInputOnOpen.current) {
      focusInputOnOpen.current = false;
      inputRef.current?.focus();
    }
    if (!expanded && focusOpenButtonOnClose.current) {
      focusOpenButtonOnClose.current = false;
      openButtonRef.current?.focus();
    }
  }, [expanded]);

  // The tracer needs the search box, so open it (without stealing focus) when tracing starts.
  useEffect(() => {
    if (state.relMode) setExpanded(true);
  }, [state.relMode]);

  // "/" opens search from anywhere except text fields and dialogs.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target) || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (expanded) inputRef.current?.focus();
      else open();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded, open]);

  // Clicking elsewhere closes the dropdowns, and the whole search when it is empty.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || filterPanelRef.current?.contains(target)) return;
      setListOpen(false);
      setShowFilters(false);
      if (!state.searchQuery && !state.relMode) collapse(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state.searchQuery, state.relMode, collapse]);

  useEffect(() => {
    setActiveIdx(-1);
  }, [state.searchQuery]);

  useEffect(() => {
    listRef.current?.querySelector('.floating-search__item--active')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx]);

  const handleDragStart = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    isDragging.current = true;
    const cr = container.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - cr.left - pos.x, y: e.clientY - cr.top - pos.y };

    const onMove = (ev: PointerEvent) => {
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const selectItem = useCallback((id: string) => {
    if (state.relMode) dispatch({ type: 'SET_REL_NODE', payload: id });
    dispatch({ type: 'SELECT_MEMBER', payload: id });
    if (hasQuery) dispatch({ type: 'SET_SEARCH', payload: '' });
    setListOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    if (!state.relMode) collapse(false);
  }, [dispatch, hasQuery, state.relMode, collapse]);

  const handleClose = () => {
    if (hasQuery) {
      dispatch({ type: 'SET_SEARCH', payload: '' });
      inputRef.current?.focus();
      return;
    }
    collapse(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (listOpen) setListOpen(false);
      else if (showFilters) setShowFilters(false);
      else collapse(true);
      return;
    }
    if (!listOpen || listItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(Math.min(activeIdx + 1, listItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectItem(listItems[activeIdx].id);
    }
  };

  const tracerHint = state.relMode
    ? (state.relSource && !state.relTarget ? t.tracerStep2 : t.tracerStep1)
    : null;

  const filtersLabel = filterCount > 0 ? `${t.searchFiltersActive} (${t.filtersOnCount(filterCount)})` : t.searchAdvancedFilters;

  return (
    <div
      ref={panelRef}
      className={`floating-search${expanded ? ' floating-search--expanded' : ''}`}
      style={ready ? { left: pos.x, top: pos.y } : { left: 0, top: 0, opacity: 0, pointerEvents: 'none' }}
    >
      {!expanded ? (
        <button
          ref={openButtonRef}
          type="button"
          className="floating-search__open"
          onClick={open}
          title={t.searchExpandTooltip}
          aria-label={t.searchExpandTooltip}
          aria-expanded={false}
        >
          <SearchIcon size={17} />
          {(hasQuery || filterCount > 0) && <span className="floating-search__open-dot" />}
        </button>
      ) : (
        <>
          <div className="floating-search__bar" ref={barRef}>
            <span className="floating-search__grip" onPointerDown={handleDragStart} aria-hidden="true">
              <GripVerticalIcon size={14} />
            </span>
            <SearchIcon size={14} className="floating-search__icon" />
            <input
              ref={inputRef}
              type="text"
              className="floating-search__input"
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              value={state.searchQuery}
              onChange={e => {
                dispatch({ type: 'SET_SEARCH', payload: e.target.value });
                setListOpen(true);
              }}
              onFocus={() => { setListOpen(true); setShowFilters(false); }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {isSearching && <span className="floating-search__count">{matchCount}/{totalMembers}</span>}
            <button
              ref={filterButtonRef}
              type="button"
              className={`floating-search__btn floating-search__filter-btn${showFilters ? ' floating-search__btn--active' : ''}${filterCount > 0 ? ' floating-search__filter-btn--on' : ''}`}
              onClick={() => { setShowFilters(v => !v); setListOpen(false); }}
              title={filtersLabel}
              aria-label={filtersLabel}
              aria-expanded={showFilters}
            >
              <SlidersHorizontalIcon size={14} />
              {filterCount > 0 && <span className="floating-search__filter-count">{filterCount}</span>}
            </button>
            <button
              type="button"
              className="floating-search__btn"
              onClick={handleClose}
              title={hasQuery ? t.searchClear : t.searchCollapseTooltip}
              aria-label={hasQuery ? t.searchClear : t.searchCollapseTooltip}
            >
              <XIcon size={14} />
            </button>
          </div>

          {tracerHint && <div className="floating-search__tracer-hint" role="status">{tracerHint}</div>}

          {listOpen && listItems.length > 0 && (
            <div className="floating-search__list" ref={listRef}>
              <div className="floating-search__list-header">
                {isSearching ? t.searchResultsHeader(matchCount, state.searchQuery) : t.searchAllMembersHeader(listItems.length)}
              </div>
              {listItems.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={`floating-search__item${i === activeIdx ? ' floating-search__item--active' : ''}${state.selectedMemberId === m.id ? ' floating-search__item--selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); selectItem(m.id); }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <img
                    className="floating-search__avatar"
                    src={m.imageConfig.finalImageUrl}
                    alt=""
                    onError={e => { (e.target as HTMLImageElement).src = getAvatarFallback(m.gender, m.ageCategory); }}
                  />
                  <span className="floating-search__name">{getDisplayFirstName(m, lang)}</span>
                  <span className="floating-search__years">{[m.birthYear, m.deathYear].filter(y => y != null).join('–')}</span>
                </button>
              ))}
            </div>
          )}

          {listOpen && listItems.length === 0 && (hasQuery || filtersActive) && (
            <div className="floating-search__empty">{t.searchNoResults(state.searchQuery || t.filtersTitle)}</div>
          )}

          {state.data && state.data.familyTreesStyled.length > 1 && (
            <select
              className="floating-search__tree-select"
              aria-label={t.ariaFamilyTree}
              value={state.selectedTreeId ?? ''}
              onChange={e => dispatch({ type: 'SELECT_TREE', payload: e.target.value })}
            >
              {state.data.familyTreesStyled.map(tree => (
                <option key={tree.familyTreeId} value={tree.familyTreeId}>{lang === 'mr' && tree.familyTreeDisplayName_mr ? tree.familyTreeDisplayName_mr : tree.familyTreeDisplayName}</option>
              ))}
            </select>
          )}
        </>
      )}

      {expanded && showFilters && barRef.current && (() => {
        const rect = barRef.current!.getBoundingClientRect();
        const showAbove = window.innerHeight - rect.bottom < FILTER_POPOVER_HEIGHT + 8 && rect.top > FILTER_POPOVER_HEIGHT + 8;
        return ReactDOM.createPortal(
          <div
            ref={filterPanelRef}
            className="floating-search__filter-portal"
            onKeyDown={e => {
              if (e.key !== 'Escape') return;
              e.preventDefault();
              setShowFilters(false);
              filterButtonRef.current?.focus();
            }}
            style={{
              position: 'fixed',
              left: rect.left,
              ...(showAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
              width: Math.max(rect.width, 240),
              zIndex: 2000,
            }}
          >
            <FilterPanel />
          </div>,
          document.body,
        );
      })()}
    </div>
  );
};

export default FloatingSearch;
