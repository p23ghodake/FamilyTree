import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './YearPicker.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YearPickerProps {
  value: string;              // selected year as string, '' = empty
  onChange: (year: string) => void;
  placeholder?: string;
  min?: number;               // earliest selectable year (default 1000)
  max?: number;               // latest selectable year (default currentYear + 10)
  hasError?: boolean;
  clearable?: boolean;        // show "Clear" button (for death year)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const COLS = 5; // years per row in the grid

function toDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

// ─── Popup rendered via React portal ─────────────────────────────────────────

interface PopupProps {
  anchorEl: HTMLElement;
  selectedYear: number | null;
  decade: number;
  min: number;
  max: number;
  clearable: boolean;
  hasValue: boolean;
  onDecadeChange: (d: number) => void;
  onSelect: (y: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const YearPickerPopup: React.FC<PopupProps> = ({
  anchorEl, selectedYear, decade, min, max,
  clearable, hasValue,
  onDecadeChange, onSelect, onClear, onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const POPUP_H = 226;

  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 220,
  });

  // Position below anchor; flip above if not enough room
  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= POPUP_H ? rect.bottom + 4 : rect.top - POPUP_H - 4;
    setPos({ top, left: rect.left, width: Math.max(rect.width, 220) });
  }, [anchorEl]);

  // Re-position on scroll / resize
  useEffect(() => {
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const top = spaceBelow >= POPUP_H ? rect.bottom + 4 : rect.top - POPUP_H - 4;
      setPos({ top, left: rect.left, width: Math.max(rect.width, 220) });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [anchorEl]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorEl, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const years = Array.from({ length: 10 }, (_, i) => decade + i)
    .filter(y => y >= min && y <= max);

  const canPrev = decade > toDecade(min);
  const canNext = decade < toDecade(max);

  return ReactDOM.createPortal(
    <div
      ref={popupRef}
      className="year-picker__popup"
      style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
    >
      {/* ── Decade navigation bar ── */}
      <div className="year-picker__nav">
        <button
          type="button"
          className="year-picker__nav-btn"
          onClick={() => onDecadeChange(decade - 10)}
          disabled={!canPrev}
          title="Previous decade"
        >
          ‹
        </button>

        <div className="year-picker__decade-info">
          <span className="year-picker__decade-label">{decade}s</span>
          <span className="year-picker__decade-range">{decade} – {decade + 9}</span>
        </div>

        <button
          type="button"
          className="year-picker__nav-btn"
          onClick={() => onDecadeChange(decade + 10)}
          disabled={!canNext}
          title="Next decade"
        >
          ›
        </button>
      </div>

      {/* ── Year grid (5 columns × 2 rows) ── */}
      <div className="year-picker__grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {years.map(y => (
          <button
            key={y}
            type="button"
            className={[
              'year-picker__year',
              selectedYear === y ? 'year-picker__year--sel' : '',
              y === CURRENT_YEAR ? 'year-picker__year--current' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── Footer: jump to current decade + optional clear ── */}
      <div className="year-picker__footer">
        <button
          type="button"
          className="year-picker__jump-btn"
          onClick={() => onDecadeChange(toDecade(CURRENT_YEAR))}
          title={`Jump to ${CURRENT_YEAR}`}
        >
          Today ({CURRENT_YEAR})
        </button>
        {clearable && hasValue && (
          <button type="button" className="year-picker__clear-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

// ─── YearPicker (trigger + popup) ────────────────────────────────────────────

const YearPicker: React.FC<YearPickerProps> = ({
  value,
  onChange,
  placeholder = 'Select year',
  min = 1000,
  max = CURRENT_YEAR + 10,
  hasError = false,
  clearable = false,
}) => {
  const numVal = value && /^\d+$/.test(value) ? parseInt(value, 10) : null;

  const [open, setOpen] = useState(false);
  const [decade, setDecade] = useState(() =>
    numVal ? toDecade(numVal) : toDecade(CURRENT_YEAR)
  );
  // Local typed text — lets the user type a year directly
  const [typed, setTyped] = useState(value);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Sync typed display when prop changes externally (e.g., edit mode prefill)
  useEffect(() => {
    setTyped(value);
    if (value && /^\d{4}$/.test(value)) {
      setDecade(toDecade(parseInt(value, 10)));
    }
  }, [value]);

  const handleSelect = useCallback((y: number) => {
    onChange(String(y));
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    setOpen(false);
  }, [onChange]);

  const handleDecadeChange = useCallback((d: number) => {
    setDecade(Math.max(toDecade(min), Math.min(toDecade(max), d)));
  }, [min, max]);

  // Allow typing 4 digits directly in the input
  const handleTyped = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setTyped(v);
    if (v.length === 4) {
      const n = parseInt(v, 10);
      if (n >= min && n <= max) {
        onChange(v);
        setDecade(toDecade(n));
      }
    } else if (v === '') {
      onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={triggerRef}
      className={['year-picker', hasError ? 'year-picker--err' : '', open ? 'year-picker--open' : ''].filter(Boolean).join(' ')}
    >
      <div className="year-picker__trigger" onClick={() => setOpen(o => !o)}>
        <input
          className="year-picker__input"
          type="text"
          inputMode="numeric"
          value={typed}
          onChange={handleTyped}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          onClick={e => e.stopPropagation()}
          maxLength={4}
        />
        <span className={`year-picker__chevron${open ? ' year-picker__chevron--up' : ''}`}>▾</span>
      </div>

      {open && triggerRef.current && (
        <YearPickerPopup
          anchorEl={triggerRef.current}
          selectedYear={numVal}
          decade={decade}
          min={min}
          max={max}
          clearable={clearable}
          hasValue={Boolean(value)}
          onDecadeChange={handleDecadeChange}
          onSelect={handleSelect}
          onClear={handleClear}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default YearPicker;
