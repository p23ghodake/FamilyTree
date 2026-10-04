import React, { useMemo, useState, useCallback } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import './TimelineModal.css';

type EventType = 'birth' | 'death' | 'marriage';
type LanePos = 'above' | 'below';

interface TLEvent {
  id: string;
  year: number;
  type: EventType;
  label: string;
  memberId?: string;
}

interface PlacedEvent extends TLEvent {
  x: number;
  lanePos: LanePos;
  laneDepth: number;
}

interface TooltipState {
  evt: PlacedEvent;
  clientX: number;
  clientY: number;
}

const PX_PER_YEAR = 24;
const SIDE_PAD    = 72;
const DOT_HALF    = 16;   // dot radius (14) + 2px buffer
const MIN_GAP     = 6;
const DEPTH_STEP  = 36;   // 28px dot + 8px gap

function getInitials(evt: TLEvent): string {
  if (evt.type === 'marriage') {
    const parts = evt.label.split(' & ');
    if (parts.length === 2)
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  const words = evt.label.trim().split(/\s+/);
  if (words.length >= 2)
    return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
  return evt.label.substring(0, 2).toUpperCase();
}

function assignLanes(sorted: TLEvent[], xOf: (y: number) => number): PlacedEvent[] {
  const lanes: Array<{ pos: LanePos; depth: number; lastRight: number }> = [
    { pos: 'above', depth: 0, lastRight: -Infinity },
    { pos: 'below', depth: 0, lastRight: -Infinity },
    { pos: 'above', depth: 1, lastRight: -Infinity },
    { pos: 'below', depth: 1, lastRight: -Infinity },
  ];
  return sorted.map(evt => {
    const x     = xOf(evt.year);
    const left  = x - DOT_HALF;
    const right = x + DOT_HALF;
    const lane  =
      lanes.find(l => left >= l.lastRight + MIN_GAP) ??
      lanes.reduce((a, b) => (a.lastRight <= b.lastRight ? a : b));
    lane.lastRight = right;
    return { ...evt, x, lanePos: lane.pos, laneDepth: lane.depth };
  });
}

interface Props { onClose: () => void; }

const TimelineModal: React.FC<Props> = ({ onClose }) => {
  const { currentTree } = useFamilyTree();
  const { t, lang } = useLanguage();
  const [active, setActive] = useState<Set<EventType>>(
    new Set<EventType>(['birth', 'death', 'marriage'])
  );
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Per-type label and verb from translations
  const typeLabel = (type: EventType) =>
    ({ birth: t.tlFilterBirths, death: t.tlFilterDeaths, marriage: t.tlFilterMarriages })[type];
  const typeVerb = (type: EventType) =>
    ({ birth: t.tlVerbBorn, death: t.tlVerbDied, marriage: t.tlVerbMarried })[type];

  const allEvents = useMemo<TLEvent[]>(() => {
    if (!currentTree) return [];
    const evts: TLEvent[] = [];

    // Language-aware display names (mirrors PersonNode logic)
    const dName = (m: typeof currentTree.members[number]) =>
      lang === 'mr' && (m.firstName_mr || m.lastName_mr)
        ? `${m.firstName_mr || m.firstName} ${m.lastName_mr || m.lastName}`.trim()
        : m.fullName;
    const dFirst = (m: typeof currentTree.members[number]) =>
      lang === 'mr' && m.firstName_mr ? m.firstName_mr : m.firstName;

    currentTree.members.forEach(m => {
      if (m.birthYear) evts.push({ id: `b-${m.id}`, year: m.birthYear, type: 'birth',  label: dName(m), memberId: m.id });
      if (m.deathYear) evts.push({ id: `d-${m.id}`, year: m.deathYear, type: 'death',  label: dName(m), memberId: m.id });
    });
    currentTree.relationships.spouses.forEach((r, i) => {
      if (r.marriageYear) {
        const s1 = currentTree.members.find(m => m.id === r.spouse1Id);
        const s2 = currentTree.members.find(m => m.id === r.spouse2Id);
        if (s1 && s2) evts.push({ id: `m-${i}`, year: r.marriageYear, type: 'marriage', label: `${dFirst(s1)} & ${dFirst(s2)}` });
      }
    });
    return evts.sort((a, b) => a.year - b.year);
  }, [currentTree, lang]);

  const filtered = useMemo(
    () => allEvents.filter(e => active.has(e.type)),
    [allEvents, active]
  );

  const { canvasW, xOf, ticks, placedEvents } = useMemo(() => {
    if (!filtered.length)
      return { canvasW: 700, xOf: (_y: number) => 0, ticks: [] as number[], placedEvents: [] as PlacedEvent[] };

    const yrs  = filtered.map(e => e.year);
    const minY = Math.min(...yrs) - 5;
    const maxY = Math.max(...yrs) + 5;
    const rng  = Math.max(maxY - minY, 1);
    const w    = Math.max(rng * PX_PER_YEAR + SIDE_PAD * 2, 700);
    const xOfFn = (year: number) => SIDE_PAD + ((year - minY) / rng) * (w - SIDE_PAD * 2);

    const tks: number[] = [];
    const start = Math.ceil(minY / 10) * 10;
    for (let y = start; y <= maxY; y += 10) tks.push(y);

    return { canvasW: w, xOf: xOfFn, ticks: tks, placedEvents: assignLanes(filtered, xOfFn) };
  }, [filtered]);

  const aboveEvents = placedEvents.filter(e => e.lanePos === 'above');
  const belowEvents = placedEvents.filter(e => e.lanePos === 'below');

  const toggleFilter = (type: EventType) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(type) && next.size > 1) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const showTip  = useCallback((evt: PlacedEvent, e: React.MouseEvent) =>
    setTooltip({ evt, clientX: e.clientX, clientY: e.clientY }), []);
  const hideTip  = useCallback(() => setTooltip(null), []);

  if (!currentTree) return null;

  const births    = allEvents.filter(e => e.type === 'birth').length;
  const deaths    = allEvents.filter(e => e.type === 'death').length;
  const marriages = allEvents.filter(e => e.type === 'marriage').length;

  return (
    <div className="tl-backdrop" onClick={handleBackdrop}>
      <div className="tl-modal">

        {/* Header */}
        <div className="tl-header">
          <div className="tl-header__left">
            <svg className="tl-header__icon" width={18} height={18} viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
              <line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
              <line x1="3" x2="21" y1="10" y2="10"/>
              <line x1="8" x2="8" y1="14" y2="18"/><line x1="12" x2="12" y1="14" y2="18"/>
              <line x1="16" x2="16" y1="14" y2="18"/>
            </svg>
            <span className="tl-header__title">{t.tooltipTimeline}</span>
            <span className="tl-header__tree">{currentTree.familyTreeDisplayName}</span>
          </div>
          <div className="tl-header__filters">
            {(['birth', 'death', 'marriage'] as EventType[]).map(type => (
              <button key={type}
                className={`tl-filter tl-filter--${type}${active.has(type) ? ' tl-filter--on' : ''}`}
                onClick={() => toggleFilter(type)}>
                <span className="tl-filter__dot" />
                {typeLabel(type)}
              </button>
            ))}
          </div>
          <button className="tl-close" onClick={onClose} title={t.close}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <div className="tl-empty">
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{t.tlEmpty}</p>
            <p className="tl-empty__hint">{t.tlEmptyHint}</p>
          </div>
        ) : (
          <div className="tl-scroll" onMouseLeave={hideTip}>
            <div className="tl-canvas" style={{ width: canvasW }}>

              {/* Above track */}
              <div className="tl-track tl-track--above">
                {aboveEvents.map(evt => (
                  <div key={evt.id}
                    className={`tl-dot tl-dot--${evt.type}`}
                    style={{ left: evt.x, bottom: evt.laneDepth * DEPTH_STEP }}
                    onMouseEnter={e => showTip(evt, e)}
                    onMouseLeave={hideTip}>
                    <span className="tl-dot__initials">{getInitials(evt)}</span>
                  </div>
                ))}
              </div>

              {/* Axis row */}
              <div className="tl-axis-row" style={{ width: canvasW }}>
                <div className="tl-axis__line"
                  style={{ left: SIDE_PAD - 20, width: canvasW - (SIDE_PAD - 20) * 2 }} />
                {ticks.map(y => (
                  <div key={y} className="tl-axis__tick" style={{ left: xOf(y) }}>
                    <div className="tl-axis__tick-mark" />
                    <span className="tl-axis__tick-label">{y}</span>
                  </div>
                ))}
              </div>

              {/* Below track */}
              <div className="tl-track tl-track--below">
                {belowEvents.map(evt => (
                  <div key={evt.id}
                    className={`tl-dot tl-dot--${evt.type}`}
                    style={{ left: evt.x, top: evt.laneDepth * DEPTH_STEP }}
                    onMouseEnter={e => showTip(evt, e)}
                    onMouseLeave={hideTip}>
                    <span className="tl-dot__initials">{getInitials(evt)}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <div className="tl-footer">
          <span>{t.tlEventsShown(filtered.length)}</span>
          <span className="tl-footer__sep">·</span>
          <span className="tl-footer__stat tl-footer__stat--birth">{t.tlBirthsCount(births)}</span>
          <span className="tl-footer__sep">·</span>
          <span className="tl-footer__stat tl-footer__stat--death">{t.tlDeathsCount(deaths)}</span>
          <span className="tl-footer__sep">·</span>
          <span className="tl-footer__stat tl-footer__stat--marriage">{t.tlMarriagesCount(marriages)}</span>
        </div>

      </div>

      {/* Hover tooltip — rendered outside scroll so it's never clipped */}
      {tooltip && (
        <div
          className={`tl-tooltip tl-tooltip--${tooltip.evt.type}`}
          style={{ left: tooltip.clientX, top: tooltip.clientY - 72 }}
          onMouseEnter={() => setTooltip(tooltip)}
          onMouseLeave={hideTip}
        >
          <span className="tl-tooltip__name">{tooltip.evt.label}</span>
          <span className="tl-tooltip__meta">
            {t.tlTooltipMeta(typeVerb(tooltip.evt.type), tooltip.evt.year)}
          </span>
        </div>
      )}

    </div>
  );
};

export default TimelineModal;
