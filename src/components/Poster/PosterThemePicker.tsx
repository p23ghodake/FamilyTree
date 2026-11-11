import React, { useId } from 'react';
import { CheckIcon } from '../Icons';
import { BARK_DARK, LEAF_DEFS, POSTER_THEMES, PosterTheme, THEMES } from './posterArt';

interface Props {
  theme: PosterTheme;
  onChange: (theme: PosterTheme) => void;
  label: string;
  names: Record<PosterTheme, string>;
}

const ThemePreview: React.FC<{ theme: PosterTheme }> = ({ theme }) => {
  const spec = THEMES[theme];
  return (
    <svg className="poster-theme-preview" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
      <rect width="120" height="64" rx="8" fill="#f8f1e4" />
      <ellipse cx="60" cy="25" rx="39" ry="22" fill={spec.canopy} opacity="0.2" />
      <path d="M60 58V22M60 43L38 27M60 37L81 19M60 31L48 15" fill="none" stroke={BARK_DARK} strokeWidth="4" strokeLinecap="round" />
      {Array.from({ length: 14 }, (_, i) => {
        const angle = i * 2.4;
        const x = 60 + Math.cos(angle) * (18 + i % 3 * 7);
        const y = 24 + Math.sin(angle) * (11 + i % 2 * 7);
        const accent = spec.accent && i % 4 === 0 ? spec.accent : null;
        const shape = accent ? accent.shape : spec.shapes[i % spec.shapes.length];
        const colors = accent ? accent.colors : i % 2 ? spec.inner : spec.outer;
        return <path key={i} d={LEAF_DEFS[shape].body} fill={colors[i % colors.length]} transform={`translate(${x} ${y}) rotate(${i * 35}) scale(13)`} />;
      })}
      {theme === 'banyan' && <path d="M34 30v23M81 25v28" fill="none" stroke={BARK_DARK} strokeWidth="1.2" />}
      <path d="M49 58h22" stroke={spec.grass} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const PosterThemePicker: React.FC<Props> = ({ theme, onChange, label, names }) => {
  const id = useId();
  return (
    <fieldset className="poster-theme-picker" aria-labelledby={`${id}-label`}>
      <legend id={`${id}-label`}>{label}</legend>
      <div className="poster-theme-grid">
        {POSTER_THEMES.map(option => (
          <label key={option} className={`poster-theme-option${theme === option ? ' poster-theme-option--selected' : ''}`}>
            <input className="poster-theme-option__input" type="radio" name={`${id}-theme`} value={option} checked={theme === option} onChange={() => onChange(option)} />
            <span className="poster-theme-option__surface">
              <ThemePreview theme={option} />
              <span className="poster-theme-option__label"><span>{names[option]}</span>{theme === option && <CheckIcon size={14} />}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default PosterThemePicker;
