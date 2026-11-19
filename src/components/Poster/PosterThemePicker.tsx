import React from 'react';
import { POSTER_THEMES, PosterTheme } from './posterArt';

interface Props {
  theme: PosterTheme;
  onChange: (theme: PosterTheme) => void;
  label: string;
  names: Record<PosterTheme, string>;
}

const PosterThemePicker: React.FC<Props> = ({ theme, onChange, label, names }) => {
  return (
    <label className="poster-field poster-theme-picker">
      <span>{label}</span>
      <select value={theme} onChange={event => onChange(event.target.value as PosterTheme)}>
        {POSTER_THEMES.map(option => <option key={option} value={option}>{names[option]}</option>)}
      </select>
    </label>
  );
};

export default PosterThemePicker;
