import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { FocusIcon, Maximize2Icon } from '../Icons';
import { buildTreeFromMembers, computeLineage } from '../../processing/treeBuilder';
import { TreeBranch } from './TreeBranch';
import { CONFIG } from '../../constants/config';
import './TreeView.css';

const TreeView: React.FC = () => {
  const { currentTree, state, dispatch, matchedMemberIds, filteredMembers, advancedMatchedIds, relResult, debouncedSearchQuery } = useFamilyTree();
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const treeChartRef = useRef<HTMLDivElement | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [navTransition, setNavTransition] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1); // sync ref so wheel handler always reads latest zoom
  zoomRef.current = zoom;
  const panRef = useRef(pan); // sync ref so touch handlers always read latest pan
  panRef.current = pan;

  // Lineage focus mode
  const [lineageModeActive, setLineageModeActive] = useState(false);
  const [lineageIds, setLineageIds] = useState<Set<string>>(new Set());

  const toggleLineageMode = useCallback(() => {
    setLineageModeActive(prev => {
      if (prev) setLineageIds(new Set());
      return !prev;
    });
  }, []);

  // Relationship mode: set of IDs in the found path (excluding source/target)
  const relPathSet = useMemo(() => {
    if (!relResult) return new Set<string>();
    const s = new Set(relResult.path);
    if (state.relSource) s.delete(state.relSource);
    if (state.relTarget) s.delete(state.relTarget);
    return s;
  }, [relResult, state.relSource, state.relTarget]);

  // Subset of relPathSet: intermediate nodes reachable from source via blood-only edges
  // (every hop before reaching that node is 'up' or 'down', no 'spouse' yet)
  const bloodPathIds = useMemo(() => {
    if (!relResult) return new Set<string>();
    const firstSpouseIdx = relResult.directions.indexOf('spouse');
    const bloodEnd = firstSpouseIdx === -1 ? relResult.path.length - 1 : firstSpouseIdx + 1;
    const s = new Set<string>();
    for (let i = 1; i < bloodEnd; i++) {
      if (i < relResult.path.length - 1) s.add(relResult.path[i]);
    }
    return s;
  }, [relResult]);

  const handleSelect = useCallback(
    (id: string) => {
      if (state.relMode) {
        dispatch({ type: 'SET_REL_NODE', payload: id });
      } else {
        dispatch({ type: 'SELECT_MEMBER', payload: id });
        if (lineageModeActive && currentTree) {
          setLineageIds(computeLineage(id, currentTree.members, currentTree.relationships));
        }
      }
    },
    [dispatch, state.relMode, lineageModeActive, currentTree]
  );

  const treeNodes = useMemo(() => {
    if (!currentTree) return [];
    return buildTreeFromMembers(currentTree.members, currentTree.relationships);
  }, [currentTree]);

  // When lineage mode is active and a member has been clicked, use lineage set;
  // otherwise fall back to the advanced-filter matched IDs from context.
  const effectiveFilterIds = useMemo(() => {
    if (lineageModeActive && lineageIds.size > 0) return lineageIds;
    return advancedMatchedIds;
  }, [lineageModeActive, lineageIds, advancedMatchedIds]);

  const effectiveDimMode = lineageModeActive && lineageIds.size > 0 ? 'dim' : state.advancedFilters.dimMode;

  // Use the debounced query (same source as filteredMembers) so firstMatchId
  // only updates after the filter has actually been applied — prevents the
  // race-condition double-scroll that happened when isSearching went true
  // 300 ms before filteredMembers caught up.
  const isSearching = debouncedSearchQuery.length > 0;
  const firstMatchId = isSearching && filteredMembers.length > 0 ? filteredMembers[0].id : null;

  /**
   * Shared smooth-navigation helper.
   * Phase 1 (0 ms)   – enable CSS transition so the upcoming pan change animates smoothly.
   * Phase 2 (50 ms)  – read the node's current visual position with getBoundingClientRect
   *                    (accounts for CSS scale + current scroll), then compute and apply a
   *                    pan delta that centres the node in the viewport.
   *                    Using pan instead of scrollTo avoids the left-overflow clamp problem:
   *                    justify-content:center spills overflow equally left & right, but
   *                    scrollLeft cannot go below 0 so far-left nodes are unreachable via
   *                    scroll. Pan (CSS translate) has no such bound.
   * Phase 3 (1200 ms)– disable the CSS transition so manual drag stays instant.
   *
   * Returns a cleanup that cancels pending timers (used as useEffect return value).
   *
   * NOTE: contentRef, setPan, setNavTransition, zoomRef are all stable between renders,
   * so empty deps is intentional – recreated only on remount.
   */
  const scrollToMember = useCallback((memberId: string) => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!contentRef.current) return () => {};
    const container = contentRef.current;

    setNavTransition(true);

    let tBeacon: ReturnType<typeof setTimeout> | null = null;

    const t1 = setTimeout(() => {
      const el = container.querySelector(
        `[data-member-id="${memberId}"]`
      ) as HTMLElement | null;
      if (!el) return;

      // getBoundingClientRect gives the VISUAL position in viewport coords,
      // already accounting for current zoom, pan, and scroll.
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();

      // Pixels the element centre must move to reach the container centre.
      const dx = (cRect.left + cRect.width  / 2) - (eRect.left + eRect.width  / 2);
      const dy = (cRect.top  + cRect.height / 2) - (eRect.top  + eRect.height / 2);

      // Convert visual shift to pan units: visual_shift = pan_delta × zoom
      const z = zoomRef.current;
      setPan(prev => ({ x: prev.x + dx / z, y: prev.y + dy / z }));

      // Beacon: golden ripple-scale animation on avatar so user can spot the node immediately
      el.classList.remove('pnode--scroll-target'); // reset if already playing
      void el.offsetWidth;                         // force reflow so animation replays
      el.classList.add('pnode--scroll-target');
      tBeacon = setTimeout(() => el.classList.remove('pnode--scroll-target'), 1800);
    }, 50);

    const t2 = setTimeout(() => setNavTransition(false), 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (tBeacon !== null) clearTimeout(tBeacon);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Centre the first search match whenever the query changes
  useEffect(() => {
    if (!firstMatchId) return;
    return scrollToMember(firstMatchId);
  }, [firstMatchId, scrollToMember]);

  // Centre the selected member (search-dropdown pick, member-list click, etc.)
  useEffect(() => {
    if (!state.selectedMemberId) return;
    return scrollToMember(state.selectedMemberId);
  }, [state.selectedMemberId, scrollToMember]);

  // ESC exits relationship tracer mode
  useEffect(() => {
    if (!state.relMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'TOGGLE_REL_MODE' });
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.relMode, dispatch]);

  // Auto-fit when tree loads or active tree changes
  const currentTreeId = currentTree?.familyTreeId;
  useEffect(() => {
    if (!currentTreeId) return;
    // Wait two frames so the tree DOM is fully painted before measuring.
    // Both RAF handles are captured in the outer scope so both can be cancelled
    // if the component unmounts between the first and second frame.
    let raf2: number | null = null;
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        initialFit();
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [currentTreeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach non-passive wheel listener so e.preventDefault() is guaranteed to work
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const prevZoom = zoomRef.current;
      const factor = 1 - e.deltaY * 0.001;
      const newZoom = Math.min(3, Math.max(0.15, prevZoom * factor));
      zoomRef.current = newZoom;
      setZoom(newZoom);
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const originX = container.clientWidth / 2;
      setPan(prevPan => ({
        x: prevPan.x + (cursorX - originX) * (1 / newZoom - 1 / prevZoom),
        y: prevPan.y + cursorY             * (1 / newZoom - 1 / prevZoom),
      }));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch: one-finger pan, two-finger pinch-to-zoom (zoom toward the pinch midpoint)
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let panStartPoint = { x: 0, y: 0 };
    let panStartOrigin = { x: 0, y: 0 };
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const distance = (a: Touch, b: Touch) =>
      Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const beginPan = (touch: Touch) => {
      mode = 'pan';
      setNavTransition(false);
      panStartPoint = { x: touch.clientX, y: touch.clientY };
      panStartOrigin = { ...panRef.current };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        beginPan(e.touches[0]);
      } else if (e.touches.length === 2) {
        mode = 'pinch';
        pinchStartDist = distance(e.touches[0], e.touches[1]);
        pinchStartZoom = zoomRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const z = zoomRef.current;
        const touch = e.touches[0];
        setPan({
          x: panStartOrigin.x + (touch.clientX - panStartPoint.x) / z,
          y: panStartOrigin.y + (touch.clientY - panStartPoint.y) / z,
        });
      } else if (mode === 'pinch' && e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const prevZoom = zoomRef.current;
        const newDist = distance(e.touches[0], e.touches[1]);
        const newZoom = Math.min(3, Math.max(0.15, pinchStartZoom * (newDist / pinchStartDist)));
        const rect = container.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const originX = container.clientWidth / 2;
        zoomRef.current = newZoom;
        setZoom(newZoom);
        setPan(prevPan => ({
          x: prevPan.x + (midX - originX) * (1 / newZoom - 1 / prevZoom),
          y: prevPan.y + midY             * (1 / newZoom - 1 / prevZoom),
        }));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) mode = 'none';
      else if (e.touches.length === 1) beginPan(e.touches[0]); // pinch → single-finger pan
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Print: scale tree to fit page ────────────────────────────
  useEffect(() => {
    let savedTransform = '';
    let savedTransformOrigin = '';

    const handleBeforePrint = () => {
      const el = treeChartRef.current;
      if (!el) return;
      savedTransform = el.style.transform;
      savedTransformOrigin = el.style.transformOrigin;

      // offsetWidth/Height give natural DOM size regardless of CSS transform
      const naturalW = el.offsetWidth;
      const naturalH = el.offsetHeight;

      // A3 landscape usable area at 96 dpi: ~380 mm × ~265 mm = 1436 × 1002 px
      const PAGE_W = 1436;
      const PAGE_H = 1002;

      if (naturalW > 0) {
        // Scale-to-fit width; allow vertical overflow across pages
        const scaleW = PAGE_W / naturalW;
        const scaleH = PAGE_H / naturalH;
        const scale = Math.min(1, scaleW, scaleH * 0.95); // slight vertical headroom
        el.style.transform = `scale(${scale})`;
        el.style.transformOrigin = 'top left';
      }
    };

    const handleAfterPrint = () => {
      const el = treeChartRef.current;
      if (!el) return;
      el.style.transform = savedTransform;
      el.style.transformOrigin = savedTransformOrigin;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setNavTransition(false); // cancel navigation animation on manual pan
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x) / zoom,
      y: panOrigin.current.y + (e.clientY - panStart.current.y) / zoom,
    });
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const zoomIn = useCallback(() => setZoom(prev => Math.min(3, prev + 0.15)), []);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(0.15, prev - 0.15)), []);
  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  /**
   * Fit entire tree into the visible container.
   * Uses offsetWidth/offsetHeight (layout dimensions — unaffected by CSS transform)
   * to get the natural tree size, then calculates the zoom that makes it fit.
   */
  const fitToScreen = useCallback(() => {
    if (!contentRef.current || !treeChartRef.current) return;
    const container = contentRef.current;
    const treeEl   = treeChartRef.current;

    // Natural (pre-transform) size of the tree content
    const naturalW = treeEl.offsetWidth;
    const naturalH = treeEl.offsetHeight;
    if (!naturalW || !naturalH) return;

    // Usable viewport (subtract padding: 60px horizontal, 100px vertical)
    const availW = container.clientWidth  - 60;
    const availH = container.clientHeight - 100;

    const fitZoom = Math.min(availW / naturalW, availH / naturalH) * 0.92;
    const clamped = Math.max(0.15, Math.min(3, fitZoom));

    // Animate to the fitted zoom centred at origin
    setNavTransition(true);
    setZoom(clamped);
    setPan({ x: 0, y: 0 });
    container.scrollTo({ left: 0, top: 0, behavior: 'smooth' });

    const t = setTimeout(() => setNavTransition(false), 600);
    return () => clearTimeout(t);
  }, []);

  /**
   * Initial fit used on load / tree switch. Unlike fitToScreen (which always fits
   * the whole tree, however small), this keeps the tree legible: if the whole-tree
   * fit would fall below READABLE_MIN_ZOOM, it caps the zoom and centres on the
   * primary member instead of showing an unreadable bird's-eye view.
   */
  const initialFit = useCallback(() => {
    if (!contentRef.current || !treeChartRef.current) return;
    const container = contentRef.current;
    const treeEl   = treeChartRef.current;

    const naturalW = treeEl.offsetWidth;
    const naturalH = treeEl.offsetHeight;
    if (!naturalW || !naturalH) return;

    const availW = container.clientWidth  - 60;
    const availH = container.clientHeight - 100;
    const fitZoom = Math.min(availW / naturalW, availH / naturalH) * 0.92;
    const clamped = Math.max(0.15, Math.min(3, fitZoom));

    if (clamped >= CONFIG.ui.READABLE_MIN_ZOOM) {
      setNavTransition(true);
      setZoom(clamped);
      setPan({ x: 0, y: 0 });
      const t = setTimeout(() => setNavTransition(false), 600);
      return () => clearTimeout(t);
    }

    const primary = currentTree?.members.find(m => m.isPrimaryInTree) ?? currentTree?.members[0];
    zoomRef.current = CONFIG.ui.READABLE_MIN_ZOOM;
    setZoom(CONFIG.ui.READABLE_MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    if (primary) return scrollToMember(primary.id);
  }, [currentTree, scrollToMember]);

  const handleMenuAction = useCallback((
    action: 'edit' | 'addChild' | 'addSpouse' | 'delete',
    memberId: string
  ) => {
    if (action === 'delete') {
      if (!currentTree) return;
      // Confirmation is handled inline in PersonNode — dispatch directly
      dispatch({ type: 'DELETE_MEMBER', payload: { treeId: currentTree.familyTreeId, memberId } });
    } else {
      const modeMap = { edit: 'edit', addChild: 'addChild', addSpouse: 'addSpouse' } as const;
      dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: modeMap[action], targetId: memberId } });
    }
  }, [dispatch, currentTree]);

  if (!currentTree) {
    return <div className="tree-view__empty">{t.selectTreePrompt}</div>;
  }

  return (
    <div className="tree-view">
      <div
        ref={contentRef}
        className={`tree-view__content${state.relMode ? ' tree-view__content--rel-mode' : ''}${state.relMode && state.relSource ? ' tree-view__content--rel-step-2' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: state.relMode ? 'default' : isPanning.current ? 'grabbing' : 'grab' }}
      >
        <div
          ref={treeChartRef}
          className="tree-chart"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'top center',
            transition: navTransition
              ? 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              : undefined,
          }}
        >
          <ul role="tree" aria-label={t.ariaFamilyTree}>
            {treeNodes.map(node => (
              <TreeBranch
                key={node.member.id}
                node={node}
                selectedId={state.selectedMemberId}
                isSearching={isSearching}
                searchMatchedIds={matchedMemberIds}
                onSelect={handleSelect}
                onMenuAction={handleMenuAction}
                filterMatchedIds={effectiveFilterIds}
                filterDimMode={effectiveDimMode}
                relSource={state.relSource}
                relTarget={state.relTarget}
                relPathSet={relPathSet}
                bloodPathIds={bloodPathIds}
                marriageFilterActive={state.advancedFilters.marriageEligible}
                avatarStyle={state.avatarStyle}
                relStep={state.relMode ? (state.relSource ? 2 : 1) : null}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Relationship mode overlay banner */}
      {state.relMode && (
        <div className="tree-view__rel-banner">
          {t.tracerActiveBanner}
        </div>
      )}

      {/* Lineage focus banner */}
      {lineageModeActive && (
        <div className="tree-view__lineage-banner">
          <FocusIcon size={13} style={{ verticalAlign: 'middle', marginRight: 6, flexShrink: 0 }} />
          {lineageIds.size > 0
            ? t.lineageBannerActive
            : t.lineageBannerInactive}
          <button className="tree-view__lineage-banner-close" onClick={toggleLineageMode} title={t.lineageExit}>✕</button>
        </div>
      )}

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-controls__btn" onClick={zoomIn} title={t.tooltipZoomIn} aria-label={t.tooltipZoomIn}>＋</button>
        <span className="zoom-controls__level">{Math.round(zoom * 100)}%</span>
        <button className="zoom-controls__btn" onClick={zoomOut} title={t.tooltipZoomOut} aria-label={t.tooltipZoomOut}>−</button>
        <button className="zoom-controls__btn zoom-controls__reset" onClick={resetView} title={t.tooltipZoomReset} aria-label={t.tooltipZoomReset}>⟲</button>
        <div className="zoom-controls__divider" />
        <button
          className={`zoom-controls__btn zoom-controls__fit${lineageModeActive ? ' zoom-controls__fit--active' : ''}`}
          onClick={toggleLineageMode}
          title={t.tooltipLineageFocus}
          aria-label={t.tooltipLineageFocus}
        >
          <FocusIcon size={14} />
        </button>
        <div className="zoom-controls__divider" />
        <button className="zoom-controls__btn zoom-controls__fit" onClick={fitToScreen} title={t.tooltipFitToScreen} aria-label={t.tooltipFitToScreen}>
          <Maximize2Icon size={14} />
        </button>
      </div>

      {/* Bottom color bar */}
      <div className="tree-view__colorbar">
        <span style={{ background: '#3B82F6' }} />
        <span style={{ background: '#60A5FA' }} />
        <span style={{ background: '#A855F7' }} />
        <span style={{ background: '#F59E0B' }} />
        <span style={{ background: '#10B981' }} />
        <span style={{ background: '#EF4444' }} />
        <span style={{ background: '#EC4899' }} />
      </div>
    </div>
  );
};

export default TreeView;
