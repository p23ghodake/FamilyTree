import React from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { THEMES, ThemeName } from '../../theme/themeConfig';
import { AvatarStyle } from '../../types/FamilyTypes';
import {
  LanguagesIcon, SunIcon, UserIcon, DownloadIcon, ImageIcon,
  PrinterIcon, RotateCcwIcon, LogInIcon, LogOutIcon, Loader2Icon,
} from '../Icons';

export interface HeaderMenuProps {
  isAdmin: boolean;
  signedIn: boolean;
  accountName: string | null;
  isExporting: boolean;
  canReset: boolean;
  /** Closes the surrounding menu or sheet. */
  onDone: () => void;
  onExportJson: () => void;
  onExportImage: () => void;
  onPrint: () => void;
  onReset: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** Settings, admin tools and account actions shared by the desktop menu and the mobile sheet. */
const HeaderMenu: React.FC<HeaderMenuProps> = ({
  isAdmin, signedIn, accountName, isExporting, canReset, onDone,
  onExportJson, onExportImage, onPrint, onReset, onSignIn, onSignOut,
}) => {
  const { state, dispatch } = useFamilyTree();
  const { t, lang, toggleLang } = useLanguage();

  const themeLabel: Record<ThemeName, string> = {
    light: t.themeLight, dark: t.themeDark, sepia: t.themeSepia,
    forest: t.themeForest, ocean: t.themeOcean, sunset: t.themeSunset,
  };
  const run = (action: () => void) => () => { onDone(); action(); };

  return (
    <div className="hdr-menu__content">
      <div className="hdr-menu__title">{t.settingsDisplay}</div>

      <div className="hdr-menu__row">
        <LanguagesIcon size={16} />
        <span id="hdr-menu-language">{t.settingsLanguage}</span>
        <span className="hdr-menu__lang" role="group" aria-labelledby="hdr-menu-language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => { if (lang !== 'en') toggleLang(); }}>{t.langLabelEn}</button>
          <button type="button" aria-pressed={lang === 'mr'} onClick={() => { if (lang !== 'mr') toggleLang(); }}>{t.langLabelMr}</button>
        </span>
      </div>

      <div className="hdr-menu__row">
        <SunIcon size={16} />
        <span id="hdr-menu-theme">{t.tooltipThemePrefix}</span>
      </div>
      <div className="hdr-menu__swatches" role="group" aria-labelledby="hdr-menu-theme">
        {THEMES.map(theme => (
          <button
            key={theme.id}
            type="button"
            className="hdr-menu__swatch"
            style={{ background: `linear-gradient(135deg, ${theme.swatchBg} 55%, ${theme.swatchAccent} 55%)` }}
            aria-pressed={state.theme === theme.id}
            aria-label={themeLabel[theme.id]}
            title={themeLabel[theme.id]}
            onClick={() => dispatch({ type: 'SET_THEME', payload: theme.id })}
          />
        ))}
      </div>

      <label className="hdr-menu__row">
        <UserIcon size={16} />
        <span>{t.settingsAvatarStyle}</span>
        <select
          className="hdr-menu__select"
          value={state.avatarStyle}
          onChange={e => dispatch({ type: 'SET_AVATAR_STYLE', payload: e.target.value as AvatarStyle })}
        >
          <optgroup label={t.avatarGroupSilhouette}>
            <option value="silhouette">{t.avatarStyleClassic}</option>
            <option value="silhouette-flat">{t.avatarStyleFlat}</option>
            <option value="silhouette-bold">{t.avatarStyleBold}</option>
          </optgroup>
          <optgroup label={t.avatarGroupOther}>
            <option value="initials">{t.avatarStyleInitials}</option>
            <option value="emoji">{t.avatarStyleEmoji}</option>
          </optgroup>
        </select>
      </label>

      {isAdmin && (
        <>
          <div className="hdr-menu__divider" />
          <div className="hdr-menu__title">{t.settingsAdmin}</div>
          <button type="button" className="hdr-menu__item" onClick={run(onExportJson)}>
            <DownloadIcon size={16} />{t.menuExportJson}
          </button>
          <button type="button" className="hdr-menu__item" disabled={isExporting} onClick={run(onExportImage)}>
            {isExporting ? <Loader2Icon size={16} /> : <ImageIcon size={16} />}{t.menuExportImage}
          </button>
          <button type="button" className="hdr-menu__item" onClick={run(onPrint)}>
            <PrinterIcon size={16} />{t.menuPrint}
          </button>
          {canReset && (
            <button type="button" className="hdr-menu__item hdr-menu__item--danger" title={t.tooltipReset} onClick={run(onReset)}>
              <RotateCcwIcon size={16} />{t.settingsResetShared}
            </button>
          )}
        </>
      )}

      <div className="hdr-menu__divider" />
      {signedIn ? (
        <button type="button" className="hdr-menu__item" onClick={run(onSignOut)}>
          <LogOutIcon size={16} />{t.authSignOut}
          {accountName && <span className="hdr-menu__meta">{accountName}</span>}
        </button>
      ) : (
        <button type="button" className="hdr-menu__item hdr-menu__item--accent" onClick={run(onSignIn)}>
          <LogInIcon size={16} />{t.authSignIn}
        </button>
      )}
    </div>
  );
};

export default HeaderMenu;
