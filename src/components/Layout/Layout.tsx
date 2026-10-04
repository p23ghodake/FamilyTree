import React, { useMemo, useState, useEffect } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import TopBar from './TopBar';
import TreeView from '../TreeView/TreeView';
import FloatingSearch from '../SearchBar/FloatingSearch';
import MemberFormModal from '../TreeView/MemberFormModal';
import RelationshipPanel from '../TreeView/RelationshipPanel';
import TourOverlay from '../Tour/TourOverlay';
import { CONFIG } from '../../constants/config';
import './Layout.css';

const Layout: React.FC = () => {
  const { state, currentTree } = useFamilyTree();
  const { t } = useLanguage();
  const [tourActive, setTourActive] = useState(false);

  // Auto-show tour for first-time visitors
  useEffect(() => {
    if (!localStorage.getItem(CONFIG.storage.TOUR_SEEN_KEY)) {
      setTourActive(true);
    }
  }, []);

  const memberCount = useMemo(() => currentTree?.members.length ?? 0, [currentTree]);
  const printDate = useMemo(
    () => new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  if (state.error) {
    return (
      <div className="layout layout--loading">
        <div className="layout__loader">
          <div className="layout__error-icon">⚠️</div>
          <p>{t.errorLoadTree}</p>
          <p className="layout__error-msg">{state.error}</p>
        </div>
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="layout layout--loading">
        <div className="layout__loader">
          <div className="layout__spinner" />
          <p>{t.loadingTree}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <TopBar onStartTour={() => setTourActive(true)} />
      <main className="layout__main">
        <div className="print-header">
          <div>
            <span className="print-header__title">
              {currentTree?.familyTreeDisplayName ?? 'Family Tree'}
            </span>
            <span className="print-header__meta">{memberCount} {t.printMembers}</span>
          </div>
          <span className="print-header__date">{t.printPrinted} {printDate}</span>
        </div>
        <TreeView />
        <RelationshipPanel />
        <FloatingSearch />
      </main>
      <MemberFormModal />
      <TourOverlay active={tourActive} onClose={() => setTourActive(false)} />
    </div>
  );
};

export default Layout;
