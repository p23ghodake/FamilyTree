import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../lib/AuthContext';
import {
  UserPlusIcon, GitBranchIcon, BarChart2Icon, DownloadIcon, RotateCcwIcon,
  ImageIcon, Loader2Icon, Undo2Icon, Redo2Icon, UserIcon, HelpCircleIcon,
} from '../Icons';
import StatsPanel from '../SearchBar/StatsPanel';
import ThemeSwitcher from './ThemeSwitcher';
import ShareModal from './ShareModal';
import TimelineModal from '../Timeline/TimelineModal';
import './TopBar.css';
import './Toolbar.css';

const TopBar: React.FC<{ onStartTour?: () => void }> = ({ onStartTour }) => {
  const {
    state, dispatch, currentTree, cloudReady, cloudError, isSaving,
    exportData, resetData, undo, redo, canUndo, canRedo,
  } = useFamilyTree();
  const { session, loading: authLoading, signInWithGitHub, signOut } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  const [showStats, setShowStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const statsBtnRef = useRef<HTMLButtonElement>(null);
  const statsDropdownRef = useRef<HTMLDivElement>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);

  const generationCount = useMemo(() => {
    if (!currentTree) return 0;
    const indices = currentTree.members
      .map(m => m.generationIndex)
      .filter((g): g is number => g !== null);
    return indices.length > 0 ? Math.max(...indices) : 0;
  }, [currentTree]);

  const totalMembers = currentTree?.members.length ?? 0;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
  }, [canRedo, redo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!statsBtnRef.current?.contains(target) && !statsDropdownRef.current?.contains(target)) {
        setShowStats(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!avatarBtnRef.current?.contains(target) && !avatarDropdownRef.current?.contains(target)) {
        setShowAvatarPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!moreWrapRef.current?.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExportImage = useCallback(async () => {
    const treeEl = document.querySelector('.tree-chart') as HTMLElement;
    const contentEl = document.querySelector('.tree-view__content') as HTMLElement;
    if (!treeEl || !contentEl) return;

    setIsExporting(true);
    try {
      const origTransform = treeEl.style.transform;
      const origTransformOrigin = treeEl.style.transformOrigin;
      const origOverflow = contentEl.style.overflow;
      const origHeight = contentEl.style.height;
      const origMaxHeight = contentEl.style.maxHeight;

      treeEl.style.transform = 'none';
      treeEl.style.transformOrigin = 'top left';
      contentEl.style.overflow = 'visible';
      contentEl.style.height = 'auto';
      contentEl.style.maxHeight = 'none';

      await new Promise(r => requestAnimationFrame(r));
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(treeEl, { backgroundColor: '#ffffff', pixelRatio: 2 });

      treeEl.style.transform = origTransform;
      treeEl.style.transformOrigin = origTransformOrigin;
      contentEl.style.overflow = origOverflow;
      contentEl.style.height = origHeight;
      contentEl.style.maxHeight = origMaxHeight;

      const link = document.createElement('a');
      link.download = `family-tree-${currentTree?.familyTreeDisplayName ?? 'export'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      toast.error(t.alertExportFailed);
    } finally {
      setIsExporting(false);
    }
  }, [currentTree, t]);

  const handleReset = useCallback(() => {
    if (window.confirm(t.confirmReset)) {
      resetData();
    }
  }, [resetData, t]);

  const handleAuthAction = useCallback(async () => {
    try {
      if (session) {
        await signOut();
      } else {
        await signInWithGitHub();
      }
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      toast.error(error instanceof Error ? error.message : 'GitHub authentication failed.');
    }
  }, [session, signInWithGitHub, signOut]);

  return (
    <div className="top-bar">
      {currentTree && (
        <div
          className="top-bar__tree-header"
          style={{ '--tree-accent': currentTree.treeAccentColorHex } as React.CSSProperties}
        >
          <span className="top-bar__tree-icon">🌳</span>
          <div className="top-bar__tree-info">
            <span className="top-bar__tree-name">{currentTree.familyTreeDisplayName}</span>
            <span className="top-bar__tree-meta">{t.metaFormat(generationCount, totalMembers)}</span>
          </div>
        </div>
      )}

      <div className="top-bar__spacer" />

      <div className="top-bar__actions">
        <button
          className="toolbar__btn toolbar__btn--icon"
          onClick={() => dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'add' } })}
          title={t.tooltipAddMember}
          aria-label={t.tooltipAddMember}
          data-tour="add-member"
        >
          <UserPlusIcon size={15} />
        </button>

        <button
          className={`toolbar__btn toolbar__btn--icon toolbar__btn--undo${canUndo ? ' available' : ''}`}
          onClick={handleUndo}
          disabled={!canUndo}
          title={canUndo ? t.tooltipUndo : t.tooltipUndoDisabled}
          aria-label={canUndo ? t.tooltipUndo : t.tooltipUndoDisabled}
          data-tour="undo"
        >
          <Undo2Icon size={15} />
        </button>
        <button
          className={`toolbar__btn toolbar__btn--icon toolbar__btn--redo${canRedo ? ' available' : ''}`}
          onClick={handleRedo}
          disabled={!canRedo}
          title={canRedo ? t.tooltipRedo : t.tooltipRedoDisabled}
          aria-label={canRedo ? t.tooltipRedo : t.tooltipRedoDisabled}
        >
          <Redo2Icon size={15} />
        </button>

        <button
          className={`toolbar__btn toolbar__btn--icon toolbar__btn--trace${state.relMode ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_REL_MODE' })}
          title={t.tooltipTracer}
          aria-label={t.tooltipTracer}
          data-tour="trace"
        >
          <GitBranchIcon size={15} />
        </button>
        <button
          ref={statsBtnRef}
          className={`toolbar__btn toolbar__btn--icon toolbar__btn--stats${showStats ? ' active' : ''}`}
          onClick={() => setShowStats(v => !v)}
          title={t.tooltipStats}
          aria-label={t.tooltipStats}
          data-tour="stats"
        >
          <BarChart2Icon size={15} />
        </button>
        <button
          ref={avatarBtnRef}
          className={`toolbar__btn toolbar__btn--icon${showAvatarPicker ? ' active' : ''}`}
          onClick={() => setShowAvatarPicker(v => !v)}
          title={t.tooltipAvatarStyle}
          aria-label={t.tooltipAvatarStyle}
          data-tour="avatar"
        >
          <UserIcon size={15} />
        </button>

        <div className="top-bar__sep" />

        <div className="top-bar__more" ref={moreWrapRef}>
          <button
            className={`toolbar__btn toolbar__btn--icon${showMore ? ' active' : ''}`}
            onClick={() => setShowMore(v => !v)}
            title={t.tooltipMore}
            aria-label={t.tooltipMore}
            aria-expanded={showMore}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {showMore && (
            <div className="top-bar__more-dropdown" role="menu">
              <button className="top-bar__more-option" role="menuitem" onClick={() => { exportData(); setShowMore(false); }}>
                <DownloadIcon size={15} /><span>{t.menuExportJson}</span>
              </button>
              <button className="top-bar__more-option" role="menuitem" disabled={isExporting} onClick={() => { handleExportImage(); setShowMore(false); }}>
                {isExporting ? <Loader2Icon size={15} /> : <ImageIcon size={15} />}<span>{t.menuExportImage}</span>
              </button>
              <button className="top-bar__more-option" role="menuitem" onClick={() => { setShowShareModal(true); setShowMore(false); }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                  <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                </svg>
                <span>{t.menuShare}</span>
              </button>
              <button className="top-bar__more-option" role="menuitem" onClick={() => { setShowTimeline(true); setShowMore(false); }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="7" r="2" fill="currentColor" stroke="none" />
                  <circle cx="17" cy="12" r="2" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="17" r="2" fill="currentColor" stroke="none" />
                </svg>
                <span>{t.menuTimeline}</span>
              </button>
              <button className="top-bar__more-option" role="menuitem" onClick={() => { window.print(); setShowMore(false); }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                <span>{t.menuPrint}</span>
              </button>
            </div>
          )}
        </div>

        <div className="top-bar__sep" />

        <button
          className="toolbar__btn toolbar__btn--icon toolbar__btn--reset"
          onClick={handleReset}
          title={t.tooltipReset}
          aria-label={t.tooltipReset}
          data-tour="reset"
        >
          <RotateCcwIcon size={15} />
        </button>
      </div>

      <button
        className="toolbar__btn"
        onClick={handleAuthAction}
        disabled={authLoading}
        title={session ? 'Sign out of GitHub' : 'Sign in with GitHub to edit and save family data'}
      >
        {authLoading ? 'Checking…' : session ? 'Sign out' : 'Sign in with GitHub'}
      </button>
      {session && (
        <span
          className="family-data-save-status"
          role="status"
          title={cloudError ?? (cloudReady ? 'GitHub family data is ready' : 'Loading GitHub family data')}
        >
          {isSaving ? 'Saving…' : cloudReady ? 'Saved' : cloudError ? 'Unavailable' : 'Loading…'}
        </span>
      )}

      <button
        className="toolbar__btn toolbar__btn--lang"
        onClick={toggleLang}
        title={lang === 'en' ? t.tooltipSwitchLangToMr : t.tooltipSwitchLangToEn}
      >
        {lang === 'en' ? t.langLabelMr : t.langLabelEn}
      </button>
      <ThemeSwitcher />
      {onStartTour && (
        <button
          className="toolbar__btn toolbar__btn--icon toolbar__btn--tour"
          onClick={onStartTour}
          title={t.tooltipTour}
          aria-label={t.tooltipTour}
        >
          <HelpCircleIcon size={15} />
        </button>
      )}

      {showStats && (
        <div ref={statsDropdownRef} className="top-bar__stats-dropdown">
          <StatsPanel visible={showStats} />
        </div>
      )}
      {showAvatarPicker && (
        <div ref={avatarDropdownRef} className="top-bar__avatar-dropdown">
          <span className="top-bar__avatar-group-label">{t.avatarGroupSilhouette}</span>
          {([
            { value: 'silhouette',      label: t.avatarStyleClassic, icon: '👤' },
            { value: 'silhouette-flat', label: t.avatarStyleFlat,    icon: '🎨' },
            { value: 'silhouette-bold', label: t.avatarStyleBold,    icon: '◼' },
          ] as { value: import('../../types/FamilyTypes').AvatarStyle; label: string; icon: string }[]).map(opt => (
            <button
              key={opt.value}
              className={`top-bar__avatar-option${state.avatarStyle === opt.value ? ' active' : ''}`}
              onClick={() => {
                dispatch({ type: 'SET_AVATAR_STYLE', payload: opt.value });
                setShowAvatarPicker(false);
              }}
            >
              <span className="top-bar__avatar-option-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
          <span className="top-bar__avatar-group-label" style={{ marginTop: 4 }}>{t.avatarGroupOther}</span>
          {([
            { value: 'initials', label: t.avatarStyleInitials, icon: 'Aa' },
            { value: 'emoji',    label: t.avatarStyleEmoji,    icon: '😊' },
          ] as { value: import('../../types/FamilyTypes').AvatarStyle; label: string; icon: string }[]).map(opt => (
            <button
              key={opt.value}
              className={`top-bar__avatar-option${state.avatarStyle === opt.value ? ' active' : ''}`}
              onClick={() => {
                dispatch({ type: 'SET_AVATAR_STYLE', payload: opt.value });
                setShowAvatarPicker(false);
              }}
            >
              <span className="top-bar__avatar-option-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
      {showTimeline && <TimelineModal onClose={() => setShowTimeline(false)} />}
    </div>
  );
};

export default TopBar;
