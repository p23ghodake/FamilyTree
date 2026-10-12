import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { TOUR_STEPS } from './tourSteps';
import { CONFIG } from '../../constants/config';
import './TourOverlay.css';

interface Props {
  active: boolean;
  onClose: () => void;
}

interface SpotlightBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const GAP = 12;
const TOOLTIP_W = 290;
const TOOLTIP_H_APPROX = 210;

type Placement = 'top' | 'bottom' | 'left' | 'right';

/** Use the preferred side when the card fits there, otherwise the side with the most room. */
function choosePlacement(preferred: Placement, b: SpotlightBounds, w: number, h: number): Placement {
  const room: Record<Placement, number> = {
    top: b.top - GAP,
    bottom: window.innerHeight - (b.top + b.height) - GAP,
    left: b.left - GAP,
    right: window.innerWidth - (b.left + b.width) - GAP,
  };
  const fits = (p: Placement) => room[p] >= (p === 'top' || p === 'bottom' ? h : w);
  if (fits(preferred)) return preferred;
  const fallback = (['bottom', 'top', 'right', 'left'] as Placement[]).find(fits);
  return fallback ?? (room.bottom >= room.top ? 'bottom' : 'top');
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const TourOverlay: React.FC<Props> = ({ active, onClose }) => {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [bounds, setBounds] = useState<SpotlightBounds | null>(null);
  const [tipSize, setTipSize] = useState({ w: TOOLTIP_W, h: TOOLTIP_H_APPROX });
  const tipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const totalSteps = TOUR_STEPS.length;
  const step = TOUR_STEPS[stepIndex];

  const measureTarget = useCallback(() => {
    if (!step.selector) {
      setBounds(null);
      return;
    }
    // Desktop and phone layouts can both contain a target; use the one that is visible.
    const el = Array.from(document.querySelectorAll<HTMLElement>(step.selector))
      .find(candidate => candidate.getClientRects().length > 0);
    if (!el) {
      setBounds(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBounds({
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
    });
  }, [step.selector]);

  // Reset to step 0 whenever the tour becomes active
  useEffect(() => {
    if (active) setStepIndex(0);
  }, [active]);

  // Measure the rendered card so placement uses its real size (text length varies by step and language).
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setTipSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [active, stepIndex, bounds, t]);

  // Measure target element on step change + re-measure on window resize
  useEffect(() => {
    if (!active) return;
    measureTarget();
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureTarget);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, measureTarget]);

  const handleClose = useCallback(() => {
    localStorage.setItem(CONFIG.storage.TOUR_SEEN_KEY, '1');
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex(i => i + 1);
    } else {
      handleClose();
    }
  }, [stepIndex, totalSteps, handleClose]);

  const handleBack = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')                        handleClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft')                     handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, handleClose, handleNext, handleBack]);

  if (!active) return null;

  // ── Tooltip position ──────────────────────────────────────────────────────
  const tooltipStyle: React.CSSProperties = {};
  const noTarget = step.placement === 'center' || !bounds;

  if (noTarget) {
    // Centre with measured size: the card's entrance animation overrides any CSS transform.
    tooltipStyle.top  = Math.max(8, (window.innerHeight - tipSize.h) / 2);
    tooltipStyle.left = Math.max(8, (window.innerWidth - tipSize.w) / 2);
  } else {
    const { top, left, width, height } = bounds;
    const cx   = left + width / 2;
    const cy   = top + height / 2;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const { w, h } = tipSize;
    const maxTop = Math.max(8, viewH - h - 8);
    const maxLeft = Math.max(8, viewW - w - 8);

    switch (choosePlacement(step.placement as Placement, bounds, w, h)) {
      case 'bottom':
        tooltipStyle.top  = clamp(top + height + GAP, 8, maxTop);
        tooltipStyle.left = clamp(cx - w / 2, 8, maxLeft);
        break;
      case 'top':
        tooltipStyle.top  = clamp(top - h - GAP, 8, maxTop);
        tooltipStyle.left = clamp(cx - w / 2, 8, maxLeft);
        break;
      case 'right':
        tooltipStyle.top  = clamp(cy - h / 2, 8, maxTop);
        tooltipStyle.left = clamp(left + width + GAP, 8, maxLeft);
        break;
      case 'left':
        tooltipStyle.top  = clamp(cy - h / 2, 8, maxTop);
        tooltipStyle.left = clamp(left - w - GAP, 8, maxLeft);
        break;
    }
  }

  const titles = t.tourStepTitles;
  const bodies = t.tourStepBodies;

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label={t.tourTitle}>
      {/* Backdrop — catches outside clicks; provides dim when no spotlight */}
      <div
        className={`tour-overlay__backdrop${noTarget ? ' tour-overlay__backdrop--dim' : ''}`}
        onClick={handleClose}
      />

      {/* Spotlight — box-shadow creates the surrounding dim */}
      {bounds && (
        <div
          className="tour-spotlight"
          style={{
            top:    bounds.top,
            left:   bounds.left,
            width:  bounds.width,
            height: bounds.height,
          }}
        />
      )}

      {/* Tooltip card — key forces remount (re-triggers animation) on step change */}
      <div ref={tipRef} className={`tour-tooltip${step.media ? ' tour-tooltip--media' : ''}`} style={tooltipStyle} key={stepIndex} role="document">
        <div className="tour-tooltip__header">
          <span className="tour-tooltip__counter">
            {stepIndex + 1} / {totalSteps}
          </span>
          <button
            className="tour-tooltip__close"
            onClick={handleClose}
            aria-label={t.close}
          >
            ×
          </button>
        </div>

        {step.media && (
          <div className="tour-tooltip__media">
            <img src={`${process.env.PUBLIC_URL}/tour/${step.media}`} alt="" width={456} height={288} />
          </div>
        )}
        <h3 className="tour-tooltip__title">{titles[stepIndex]}</h3>
        <p className="tour-tooltip__body">{bodies[stepIndex]}</p>

        {/* Progress dots */}
        <div className="tour-tooltip__dots" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`tour-tooltip__dot${i === stepIndex ? ' active' : ''}`}
            />
          ))}
        </div>

        <div className="tour-tooltip__footer">
          <button className="tour-tooltip__skip" onClick={handleClose}>
            {t.tourSkip}
          </button>
          <div className="tour-tooltip__nav">
            {stepIndex > 0 && (
              <button className="tour-tooltip__back" onClick={handleBack}>
                {t.tourBack}
              </button>
            )}
            <button className="tour-tooltip__next" onClick={handleNext}>
              {stepIndex === totalSteps - 1 ? t.tourDone : t.tourNext}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TourOverlay;
