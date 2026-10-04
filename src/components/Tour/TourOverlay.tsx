import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const TOOLTIP_W = 290;
const TOOLTIP_H_APPROX = 210;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const TourOverlay: React.FC<Props> = ({ active, onClose }) => {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [bounds, setBounds] = useState<SpotlightBounds | null>(null);
  const rafRef = useRef<number>(0);

  const totalSteps = TOUR_STEPS.length;
  const step = TOUR_STEPS[stepIndex];

  const measureTarget = useCallback(() => {
    if (!step.selector) {
      setBounds(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(step.selector);
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
    tooltipStyle.top       = '50%';
    tooltipStyle.left      = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  } else {
    const { top, left, width, height } = bounds;
    const cx   = left + width / 2;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;

    switch (step.placement) {
      case 'bottom':
        tooltipStyle.top  = clamp(top + height + 12, 8, viewH - TOOLTIP_H_APPROX - 8);
        tooltipStyle.left = clamp(cx - TOOLTIP_W / 2, 8, viewW - TOOLTIP_W - 8);
        break;
      case 'top':
        tooltipStyle.top  = clamp(top - TOOLTIP_H_APPROX - 12, 8, viewH - TOOLTIP_H_APPROX - 8);
        tooltipStyle.left = clamp(cx - TOOLTIP_W / 2, 8, viewW - TOOLTIP_W - 8);
        break;
      case 'right':
        tooltipStyle.top  = clamp(top + height / 2 - TOOLTIP_H_APPROX / 2, 8, viewH - TOOLTIP_H_APPROX - 8);
        tooltipStyle.left = clamp(left + width + 12, 8, viewW - TOOLTIP_W - 8);
        break;
      case 'left':
        tooltipStyle.top  = clamp(top + height / 2 - TOOLTIP_H_APPROX / 2, 8, viewH - TOOLTIP_H_APPROX - 8);
        tooltipStyle.left = clamp(left - TOOLTIP_W - 12, 8, viewW - TOOLTIP_W - 8);
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
      <div className="tour-tooltip" style={tooltipStyle} key={stepIndex} role="document">
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
