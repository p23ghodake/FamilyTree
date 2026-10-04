import React, { useState, useRef, useEffect } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { THEMES, ThemeName } from '../../theme/themeConfig';
import {
  SunIcon, MoonIcon, ScrollIcon, LeafIcon, WavesIcon, SunriseIcon,
} from '../Icons';
import './ThemeSwitcher.css';

const THEME_ICONS: Record<ThemeName, React.ReactElement> = {
  light:  <SunIcon size={14} />,
  dark:   <MoonIcon size={14} />,
  sepia:  <ScrollIcon size={14} />,
  forest: <LeafIcon size={14} />,
  ocean:  <WavesIcon size={14} />,
  sunset: <SunriseIcon size={14} />,
};

const ThemeSwitcher: React.FC = () => {
  const { state, dispatch } = useFamilyTree();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const themeLabel = (id: ThemeName): string => {
    const map: Record<ThemeName, string> = {
      light:  t.themeLight,
      dark:   t.themeDark,
      sepia:  t.themeSepia,
      forest: t.themeForest,
      ocean:  t.themeOcean,
      sunset: t.themeSunset,
    };
    return map[id];
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSwatchKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const total = THEMES.length;
    let targetIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetIdx = (idx + 1) % total;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetIdx = (idx - 1 + total) % total;
    }
    if (targetIdx !== null && gridRef.current) {
      const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>('button');
      buttons[targetIdx]?.focus();
    }
  };

  const activeTheme = THEMES.find(t => t.id === state.theme) ?? THEMES[0];

  return (
    <div className="theme-switcher__wrap" ref={wrapperRef} data-tour="theme">
      <button
        className="theme-switcher__btn"
        onClick={() => setOpen(v => !v)}
        title={`${t.tooltipThemePrefix}: ${themeLabel(activeTheme.id)}`}
        aria-label={t.ariaLabelSwitchTheme}
      >
        {THEME_ICONS[activeTheme.id]}
      </button>

      {open && (
        <div className="theme-switcher__picker">
          <div className="theme-switcher__picker-title">{t.themePickerTitle}</div>
          <div className="theme-switcher__grid" ref={gridRef}>
            {THEMES.map((theme, idx) => (
              <button
                key={theme.id}
                className={`theme-switcher__item ${state.theme === theme.id ? 'theme-switcher__item--active' : ''}`}
                onClick={() => {
                  dispatch({ type: 'SET_THEME', payload: theme.id });
                  setOpen(false);
                }}
                title={themeLabel(theme.id)}
                aria-label={themeLabel(theme.id)}
                aria-pressed={state.theme === theme.id}
                onKeyDown={e => handleSwatchKeyDown(e, idx)}
              >
                <div
                  className="theme-switcher__swatch"
                  style={{
                    background: `linear-gradient(135deg, ${theme.swatchBg} 60%, ${theme.swatchAccent} 60%)`,
                  }}
                >
                  <span className="theme-switcher__swatch-icon" style={{ color: theme.swatchAccent }}>
                    {THEME_ICONS[theme.id]}
                  </span>
                </div>
                <span className="theme-switcher__item-name">{themeLabel(theme.id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
