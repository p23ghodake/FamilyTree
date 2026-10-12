import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../lib/AuthContext';
import { getInitials } from '../../processing/avatarHelpers';
import LoginModal from './LoginModal';
import ShareModal from './ShareModal';
import HeaderMenu from './HeaderMenu';
import StatsPanel from '../SearchBar/StatsPanel';
import TimelineModal from '../Timeline/TimelineModal';
import { useDialog } from '../useDialog';
import {
  BarChart2Icon, GitBranchIcon, MenuIcon, PlusIcon, Redo2Icon, SettingsIcon,
  ShareIcon, TimelineIcon, TreeIcon, Undo2Icon, UserPlusIcon,
} from '../Icons';
import './TopBar.css';

function isVisible(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.getClientRects().length > 0;
}

const TopBar: React.FC<{ onStartTour?: () => void }> = ({ onStartTour }) => {
  const {
    state, dispatch, currentTree,
    exportData, resetData, undo, redo, canUndo, canRedo,
    canEdit, cloudReady, isSaving,
  } = useFamilyTree();
  const { session, loading: authLoading, signOut, isAdmin } = useAuth();
  const { t, lang } = useLanguage();

  const [showLogin, setShowLogin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const statsBtnRef = useRef<HTMLButtonElement>(null);
  const statsDropdownRef = useRef<HTMLDivElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const generationCount = useMemo(() => {
    if (!currentTree) return 0;
    const indices = currentTree.members.map(m => m.generationIndex).filter((g): g is number => g !== null);
    return indices.length > 0 ? Math.max(...indices) : 0;
  }, [currentTree]);
  const totalMembers = currentTree?.members.length ?? 0;
  const treeName = currentTree
    ? (lang === 'mr' && currentTree.familyTreeDisplayName_mr ? currentTree.familyTreeDisplayName_mr : currentTree.familyTreeDisplayName)
    : '';

  const metadata = session?.user.user_metadata as Record<string, unknown> | undefined;
  const accountName = session
    ? [metadata?.full_name, metadata?.user_name, session.user.email].find((v): v is string => typeof v === 'string' && v.length > 0) ?? null
    : null;

  // Whichever menu trigger is visible (desktop gear or mobile ☰) receives focus when a dialog opened from a menu closes.
  const focusMenuTrigger = useCallback(
    () => (isVisible(sheetButtonRef.current) ? sheetButtonRef.current : menuButtonRef.current),
    [],
  );

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useDialog(sheetRef, closeSheet, sheetOpen, focusMenuTrigger);

  const handleUndo = useCallback(() => {
    if (!canUndo || !canEdit || isSaving) return;
    undo();
  }, [canUndo, canEdit, isSaving, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo || !canEdit || isSaving) return;
    redo();
  }, [canRedo, canEdit, isSaving, redo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (!e.ctrlKey && !e.metaKey)) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey && canUndo && canEdit && !isSaving) { e.preventDefault(); handleUndo(); }
      if ((key === 'y' || (key === 'z' && e.shiftKey)) && canRedo && canEdit && !isSaving) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, canUndo, canRedo, canEdit, isSaving]);

  useEffect(() => {
    if (!showStats) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!statsBtnRef.current?.contains(target) && !statsDropdownRef.current?.contains(target)) setShowStats(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStats]);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleExportImage = useCallback(async () => {
    if (!isAdmin) return;
    const treeEl = document.querySelector('.tree-chart') as HTMLElement;
    const contentEl = document.querySelector('.tree-view__content') as HTMLElement;
    if (!treeEl || !contentEl) return;

    setIsExporting(true);
    const origTransform = treeEl.style.transform;
    const origTransformOrigin = treeEl.style.transformOrigin;
    const origOverflow = contentEl.style.overflow;
    const origHeight = contentEl.style.height;
    const origMaxHeight = contentEl.style.maxHeight;
    try {
      treeEl.style.transform = 'none';
      treeEl.style.transformOrigin = 'top left';
      contentEl.style.overflow = 'visible';
      contentEl.style.height = 'auto';
      contentEl.style.maxHeight = 'none';

      await new Promise(r => requestAnimationFrame(r));
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(treeEl, { backgroundColor: '#ffffff', pixelRatio: 2 });

      const link = document.createElement('a');
      link.download = `family-tree-${currentTree?.familyTreeDisplayName ?? 'export'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      toast.error(t.alertExportFailed);
    } finally {
      treeEl.style.transform = origTransform;
      treeEl.style.transformOrigin = origTransformOrigin;
      contentEl.style.overflow = origOverflow;
      contentEl.style.height = origHeight;
      contentEl.style.maxHeight = origMaxHeight;
      setIsExporting(false);
    }
  }, [currentTree, t, isAdmin]);

  const handleReset = useCallback(() => {
    if (!isAdmin || !canEdit || !cloudReady || isSaving) return;
    if (window.confirm(t.confirmReset)) resetData();
  }, [resetData, t, isAdmin, canEdit, cloudReady, isSaving]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Authentication failed:', error);
      toast.error(error instanceof Error ? error.message : t.authFailed);
    }
  }, [signOut, t]);

  const showTree = () => {
    if (state.relMode) dispatch({ type: 'TOGGLE_REL_MODE' });
    setShowStats(false);
  };
  const toggleTrace = () => {
    setShowStats(false);
    dispatch({ type: 'TOGGLE_REL_MODE' });
  };
  const openAddMember = () => dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'add' } });
  const fromSheet = (action: () => void) => () => { setSheetOpen(false); action(); };

  const treeActive = !state.relMode && !showStats && !showTimeline;
  const menuProps = {
    isAdmin,
    signedIn: !!session,
    accountName,
    isExporting,
    canReset: canEdit && cloudReady && !isSaving,
    onStartTour,
    onExportJson: exportData,
    onExportImage: handleExportImage,
    onPrint: () => window.print(),
    onReset: handleReset,
    onSignIn: () => setShowLogin(true),
    onSignOut: handleSignOut,
  };

  return (
    <header className="top-bar">
      <div className="top-bar__brand" style={{ '--tree-accent': currentTree?.treeAccentColorHex } as React.CSSProperties}>
        <span className="top-bar__mark" aria-hidden="true">🌳</span>
        <div className="top-bar__titles">
          <span className="top-bar__name" title={treeName}>{treeName}</span>
          <span className="top-bar__meta">{t.metaFormat(generationCount, totalMembers)}</span>
        </div>
      </div>

      {/* Desktop: views */}
      <nav className="top-bar__views" aria-label={t.headerViews}>
        <button type="button" className="top-bar__view" aria-pressed={treeActive} onClick={showTree}>
          <TreeIcon size={15} /><span className="top-bar__label">{t.viewTree}</span>
        </button>
        <button type="button" className="top-bar__view" aria-pressed={state.relMode} onClick={toggleTrace} title={t.tooltipTracer} data-tour="trace">
          <GitBranchIcon size={15} /><span className="top-bar__label">{t.viewTrace}</span>
        </button>
        <button type="button" className="top-bar__view" aria-pressed={showTimeline} onClick={() => setShowTimeline(true)}>
          <TimelineIcon size={15} /><span className="top-bar__label">{t.menuTimeline}</span>
        </button>
        <button ref={statsBtnRef} type="button" className="top-bar__view" aria-pressed={showStats} onClick={() => setShowStats(v => !v)} title={t.tooltipStats}>
          <BarChart2Icon size={15} /><span className="top-bar__label">{t.viewStats}</span>
        </button>
      </nav>

      {/* Desktop: actions */}
      <div className="top-bar__actions">
        {canEdit && (
          <>
            <button type="button" className="top-bar__primary" onClick={openAddMember} disabled={isSaving} title={t.tooltipAddMember} data-tour="add-member">
              <PlusIcon size={15} /><span className="top-bar__label">{t.headerAddMember}</span>
            </button>
            <span className="top-bar__group">
              <button type="button" className="top-bar__icon" onClick={handleUndo} disabled={!canUndo || isSaving} title={canUndo ? t.tooltipUndo : t.tooltipUndoDisabled} aria-label={canUndo ? t.tooltipUndo : t.tooltipUndoDisabled}>
                <Undo2Icon size={16} />
              </button>
              <button type="button" className="top-bar__icon" onClick={handleRedo} disabled={!canRedo || isSaving} title={canRedo ? t.tooltipRedo : t.tooltipRedoDisabled} aria-label={canRedo ? t.tooltipRedo : t.tooltipRedoDisabled}>
                <Redo2Icon size={16} />
              </button>
            </span>
          </>
        )}
        <button type="button" className="top-bar__icon" onClick={() => setShowShareModal(true)} title={t.headerShareTree} aria-label={t.headerShareTree}>
          <ShareIcon size={16} />
        </button>
        <div className="top-bar__menu-wrap" ref={menuWrapRef}>
          {session ? (
            <button
              ref={menuButtonRef}
              type="button"
              className="top-bar__avatar"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-label={t.accountMenu(accountName ?? '')}
              title={accountName ?? t.settingsTitle}
            >
              {getInitials(accountName ?? '?')}
            </button>
          ) : (
            <>
              <button
                ref={menuButtonRef}
                type="button"
                className="top-bar__icon"
                onClick={() => setMenuOpen(v => !v)}
                aria-expanded={menuOpen}
                aria-label={t.settingsTitle}
                title={t.settingsTitle}
              >
                <SettingsIcon size={16} />
              </button>
              <button type="button" className="top-bar__signin" onClick={() => setShowLogin(true)} disabled={authLoading} title={t.authSignInTooltip}>
                {authLoading ? t.authChecking : t.authSignIn}
              </button>
            </>
          )}
          {menuOpen && (
            <div className="hdr-menu" role="dialog" aria-label={t.settingsTitle}>
              <HeaderMenu {...menuProps} onDone={() => setMenuOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Phone: compact actions */}
      <div className="top-bar__mobile">
        <button type="button" className="top-bar__icon" aria-pressed={state.relMode} onClick={toggleTrace} aria-label={t.tooltipTracer} title={t.tooltipTracer} data-tour="trace">
          <GitBranchIcon size={18} />
        </button>
        <button ref={sheetButtonRef} type="button" className="top-bar__icon" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen} aria-label={t.headerMenu} title={t.headerMenu}>
          <MenuIcon size={18} />
        </button>
      </div>

      {sheetOpen && (
        <div className="hdr-sheet__scrim" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div ref={sheetRef} className="hdr-sheet" role="dialog" aria-modal="true" aria-label={t.headerMenu}>
            <div className="hdr-sheet__grab" aria-hidden="true" />
            <div className="hdr-sheet__tiles">
              <button type="button" className="hdr-sheet__tile" onClick={fromSheet(() => setShowTimeline(true))}>
                <TimelineIcon size={20} />{t.menuTimeline}
              </button>
              <button type="button" className="hdr-sheet__tile" onClick={fromSheet(() => setShowStats(true))}>
                <BarChart2Icon size={20} />{t.viewStats}
              </button>
              <button type="button" className="hdr-sheet__tile" onClick={fromSheet(() => setShowShareModal(true))}>
                <ShareIcon size={20} />{t.menuShare}
              </button>
              {canEdit && (
                <>
                  <button type="button" className="hdr-sheet__tile" disabled={isSaving} onClick={fromSheet(openAddMember)}>
                    <UserPlusIcon size={20} />{t.headerAddMember}
                  </button>
                  <button type="button" className="hdr-sheet__tile" disabled={!canUndo || isSaving} onClick={fromSheet(handleUndo)}>
                    <Undo2Icon size={20} />{t.headerUndo}
                  </button>
                  <button type="button" className="hdr-sheet__tile" disabled={!canRedo || isSaving} onClick={fromSheet(handleRedo)}>
                    <Redo2Icon size={20} />{t.headerRedo}
                  </button>
                </>
              )}
            </div>
            <HeaderMenu {...menuProps} onDone={closeSheet} />
          </div>
        </div>
      )}

      {showStats && (
        <div ref={statsDropdownRef} className="top-bar__stats-dropdown">
          <StatsPanel visible={showStats} />
        </div>
      )}
      {showLogin && !session && <LoginModal onClose={() => setShowLogin(false)} />}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} returnFocus={focusMenuTrigger} />}
      {showTimeline && <TimelineModal onClose={() => setShowTimeline(false)} returnFocus={focusMenuTrigger} />}
    </header>
  );
};

export default TopBar;
