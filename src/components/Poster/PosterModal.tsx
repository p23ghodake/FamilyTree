import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../lib/AuthContext';
import { useDialog } from '../useDialog';
import { getDisplayFirstName } from '../../processing/displayName';
import { buildPosterLayout, findPosterRoot, PosterNode } from '../../processing/posterLayout';
import { DownloadIcon, ImageIcon, Maximize2Icon, PrinterIcon, XIcon } from '../Icons';
import { BARK_DARK, BARK_LIGHT, buildPosterArt, LEAF_COLORS, LEAF_PATHS, LeafArt, PAPER, Point } from './posterArt';
import './PosterModal.css';

const SLOT_W = 160;
const LEVEL_H = 112;
const MAX_LEVEL_H = 320;
const POSTER_RATIO = 0.62;
const ANCESTOR_RATIO = 0.45;
const BANNER_H = 44;
const MIN_BANNER_W = 76;
const MAX_BANNER_W = 150;
const BANNER_PAD = 28;
const NAME_FONT = 16;
const NAME_MAX_CHARS = 20;
const SIDE_PAD = 110;
const TOP_PAD = 150;
const TRUNK_H = 90;
const TITLE_H = 96;
const MIN_W = 760;
const GENERATION_CHOICES = [2, 3, 4, 5, 6, 7, 8];
const BANNER_EDGE = '#8a6a4a';
const FOCUS_EDGE = '#c79a2c';

const Leaf: React.FC<{ leaf: LeafArt }> = ({ leaf }) => (
  <path
    d={LEAF_PATHS[leaf.shape]}
    fill={leaf.color}
    opacity={leaf.opacity.toFixed(2)}
    transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.size.toFixed(2)})`}
  />
);

// Text styles live inside the SVG so the downloaded image matches the screen.
const SVG_STYLE = `
  .poster-banner__name { font-family: Georgia, 'Times New Roman', serif; font-size: ${NAME_FONT}px; font-weight: 700; fill: #2f2117; }
  .poster-banner__years { font-family: Georgia, 'Times New Roman', serif; font-size: 9.5px; fill: #6b5544; }
  .poster-title-text { font-family: 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive; fill: ${BARK_DARK}; }
`;

/** Print quality (about 6000 px on the long side) while staying within browser canvas limits. */
function exportScale(width: number, height: number): number {
  const target = Math.min(6, Math.max(2, 6000 / Math.max(width, height)));
  return Math.min(target, 16384 / width, 16384 / height, Math.sqrt(120e6 / (width * height)));
}

function serializeForExport(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(clone);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Rendered width of a banner name, falling back to an estimate where canvas is unavailable. */
function nameWidth(text: string): number {
  if (measureContext === undefined) measureContext = document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * NAME_FONT * 0.56;
  measureContext.font = `700 ${NAME_FONT}px Georgia, 'Times New Roman', serif`;
  return measureContext.measureText(text).width;
}

interface Props { onClose: () => void; returnFocus?: () => HTMLElement | null; }

const PosterModal: React.FC<Props> = ({ onClose, returnFocus }) => {
  const { state, currentTree } = useFamilyTree();
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose, true, returnFocus);

  const members = useMemo(() => currentTree?.members ?? [], [currentTree]);
  const parentChild = useMemo(() => currentTree?.relationships.parentChild ?? [], [currentTree]);
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const [rootId, setRootId] = useState<string>(
    () => state.selectedMemberId ?? findPosterRoot(members, parentChild) ?? members[0]?.id ?? '',
  );
  const [generations, setGenerations] = useState(4);
  const [fit, setFit] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const nameOf = useCallback(
    (id: string) => { const m = byId.get(id); return m ? getDisplayFirstName(m, lang) : ''; },
    [byId, lang],
  );

  // Duplicate first names are common, so the picker adds the father's name.
  const personOptions = useMemo(() => {
    const fatherOf = new Map<string, string>();
    parentChild.forEach(r => { if (byId.get(r.parentId)?.gender === 'male') fatherOf.set(r.childId, r.parentId); });
    return members
      .map(m => {
        const father = fatherOf.get(m.id);
        return { id: m.id, label: father ? `${nameOf(m.id)} (${nameOf(father)})` : nameOf(m.id) };
      })
      .sort((a, b) => a.label.localeCompare(b.label, lang === 'mr' ? 'mr' : 'en'));
  }, [members, parentChild, byId, nameOf, lang]);

  const familyName = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const surname = (lang === 'mr' && m.lastName_mr) || m.lastName;
      if (surname) counts.set(surname, (counts.get(surname) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }, [members, lang]);

  const layout = useMemo(
    () => buildPosterLayout(rootId, generations, members, parentChild),
    [rootId, generations, members, parentChild],
  );

  const contentW = layout.slots * SLOT_W;
  const width = Math.max(contentW + SIDE_PAD * 2, MIN_W);
  const offsetX = (width - contentW) / 2;
  const titleSize = Math.min(96, Math.max(40, width / 28));
  const titleH = Math.max(TITLE_H, titleSize * 2.4);
  const focusDepth = layout.focusDepth;
  const descGaps = Math.max(layout.levels - 1 - focusDepth, 0);
  const fixedH = TOP_PAD + BANNER_H / 2 + titleH;
  // Stretch the levels so wide families still look like a poster rather than a thin strip.
  const levelH = descGaps + focusDepth
    ? Math.min(MAX_LEVEL_H, Math.max(LEVEL_H, (width * POSTER_RATIO - fixedH - TRUNK_H) / (descGaps + ANCESTOR_RATIO * focusDepth + 0.8)))
    : LEVEL_H;
  // Ancestors sit closer together on the trunk than the descendant levels above.
  const ancestorGap = Math.max(BANNER_H + 30, levelH * ANCESTOR_RATIO);
  const trunkH = Math.max(TRUNK_H, levelH * 0.6);
  const height = fixedH + descGaps * levelH + focusDepth * ancestorGap + trunkH;
  const groundY = height - titleH;
  const rootY = groundY - trunkH;
  const artScale = Math.min(1.8, Math.max(1, levelH / 150));

  const posOf = useCallback(
    (n: PosterNode): Point => ({
      x: offsetX + n.x * SLOT_W,
      y: n.depth <= focusDepth
        ? rootY - n.depth * ancestorGap
        : rootY - focusDepth * ancestorGap - (n.depth - focusDepth) * levelH,
    }),
    [offsetX, rootY, levelH, ancestorGap, focusDepth],
  );

  const art = useMemo(
    () => buildPosterArt({
      nodes: layout.nodes, focusDepth, posOf, bannerH: BANNER_H, groundY, trunkH, scale: artScale,
      minX: offsetX, maxX: offsetX + contentW,
    }),
    [layout, focusDepth, posOf, groundY, trunkH, artScale, offsetX, contentW],
  );
  const exportSize = useMemo(() => {
    const scale = exportScale(width, height);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }, [width, height]);

  const root = layout.nodes[0];
  const rootPos = root ? posOf(root) : { x: width / 2, y: rootY };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || fit) return;
    el.scrollLeft = rootPos.x - el.clientWidth / 2;
    el.scrollTop = el.scrollHeight;
  }, [fit, rootPos.x, layout]);

  const handleDownload = useCallback(async () => {
    const svg = sheetRef.current?.querySelector('svg');
    if (!svg) return;
    setIsExporting(true);
    const svgUrl = URL.createObjectURL(new Blob([serializeForExport(svg, exportSize.width, exportSize.height)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = svgUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = exportSize.width;
      canvas.height = exportSize.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available');
      ctx.drawImage(img, 0, 0, exportSize.width, exportSize.height);
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('PNG encoding failed');
      const link = document.createElement('a');
      link.download = `family-poster-${nameOf(rootId) || 'export'}.png`;
      link.href = URL.createObjectURL(png);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } catch (err) {
      console.error('Poster export failed:', err);
      toast.error(t.alertExportFailed);
    } finally {
      URL.revokeObjectURL(svgUrl);
      setIsExporting(false);
    }
  }, [exportSize, nameOf, rootId, t]);

  const handlePrint = useCallback(() => {
    if (!isAdmin) return;
    const cleanup = () => {
      document.body.classList.remove('poster-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.add('poster-printing');
    window.addEventListener('afterprint', cleanup);
    window.print();
  }, [isAdmin]);

  if (!currentTree) return null;

  const title = t.posterFamilyName(familyName);
  // Keep the title under the trunk, but fully on the sheet (rough width estimate for a script font).
  const titleHalf = Math.max(160, title.length * titleSize * 0.24);
  const titleX = Math.min(width - titleHalf - 20, Math.max(titleHalf + 20, rootPos.x));

  return createPortal(
    <div className="poster-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="poster-modal" role="dialog" aria-modal="true" aria-labelledby="poster-title">
        <div className="poster-header">
          <div className="poster-header__left">
            <ImageIcon size={18} className="poster-header__icon" />
            <span id="poster-title" className="poster-header__title">{t.posterTitle}</span>
          </div>

          <div className="poster-controls">
            <label className="poster-field">
              <span>{t.posterStartFrom}</span>
              <select value={rootId} onChange={e => setRootId(e.target.value)}>
                {personOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="poster-field">
              <span>{t.posterGenerations}</span>
              <select value={generations} onChange={e => setGenerations(Number(e.target.value))}>
                {GENERATION_CHOICES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <button type="button" className="poster-action" aria-pressed={fit} onClick={() => setFit(v => !v)}>
              <Maximize2Icon size={14} /><span>{t.posterFit}</span>
            </button>
          </div>

          <div className="poster-header__actions">
            <button
              type="button"
              className="poster-action"
              onClick={handleDownload}
              disabled={isExporting || layout.nodes.length === 0}
              title={t.posterDownloadHint(exportSize.width, exportSize.height)}
            >
              <DownloadIcon size={15} /><span>{t.posterDownload}</span>
            </button>
            {isAdmin && (
              <button type="button" className="poster-action" onClick={handlePrint} disabled={layout.nodes.length === 0}>
                <PrinterIcon size={15} /><span>{t.menuPrint}</span>
              </button>
            )}
            <button type="button" className="poster-close" onClick={onClose} title={t.close} aria-label={t.close}>
              <XIcon size={14} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className={`poster-scroll${fit ? ' poster-scroll--fit' : ''}`}>
          {layout.nodes.length <= 1 && (
            <p className="poster-hint" role="status">{t.posterNoRelatives}</p>
          )}
          <div ref={sheetRef} className="poster-sheet" style={fit ? undefined : { width, height }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}>
              <defs>
                <style>{SVG_STYLE}</style>
                <linearGradient id="poster-bark" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor={BARK_DARK} />
                  <stop offset="0.45" stopColor={BARK_LIGHT} />
                  <stop offset="1" stopColor={BARK_DARK} />
                </linearGradient>
                <filter id="poster-banner-shadow" x="-20%" y="-40%" width="140%" height="190%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#2f2117" floodOpacity="0.45" />
                </filter>
              </defs>
              <rect width={width} height={height} fill={PAPER} />

              <ellipse cx={art.ground.cx} cy={art.ground.cy} rx={art.ground.rx} ry={10} fill={BARK_DARK} opacity={0.12} />
              {art.fallen.map((leaf, i) => <Leaf key={`f${i}`} leaf={leaf} />)}
              {art.wood.map((d, i) => <path key={`w${i}`} d={d} fill="url(#poster-bark)" />)}
              {art.texture.map((d, i) => <path key={`g${i}`} d={d} stroke={BARK_DARK} strokeWidth={1.1} fill="none" opacity={0.38} />)}
              {art.twigs.map((d, i) => <path key={`t${i}`} d={d} fill={BARK_DARK} />)}
              {art.leaves.map((leaf, i) => <Leaf key={`l${i}`} leaf={leaf} />)}

              {/* Name banners */}
              {layout.nodes.map(n => {
                const m = byId.get(n.id);
                if (!m) return null;
                const { x, y } = posOf(n);
                const years = m.birthYear || m.deathYear
                  ? `${m.birthYear ?? '?'}${m.deathYear ? ` – ${m.deathYear}` : ''}`
                  : '';
                const name = getDisplayFirstName(m, lang);
                const label = truncate(name, NAME_MAX_CHARS);
                const textW = nameWidth(label);
                const bw = Math.min(MAX_BANNER_W, Math.max(MIN_BANNER_W, textW + BANNER_PAD));
                const squeeze = textW > bw - BANNER_PAD;
                const left = x - bw / 2;
                const top = y - BANNER_H / 2;
                const focus = n.depth === focusDepth;
                const edge = focus ? FOCUS_EDGE : BANNER_EDGE;
                return (
                  <g key={`b-${n.id}`} className="poster-banner" filter="url(#poster-banner-shadow)">
                    <title>{name}</title>
                    <path d={`M${left + 6},${top + 8} h-14 l6,${(BANNER_H - 4) / 2} l-6,${(BANNER_H - 4) / 2} h14Z`} fill="#eadbc2" stroke={BANNER_EDGE} />
                    <path d={`M${left + bw - 6},${top + 8} h14 l-6,${(BANNER_H - 4) / 2} l6,${(BANNER_H - 4) / 2} h-14Z`} fill="#eadbc2" stroke={BANNER_EDGE} />
                    <rect x={left} y={top} width={bw} height={BANNER_H} rx={4} fill={focus ? '#fff1cf' : '#fffdf7'} stroke={edge} strokeWidth={focus ? 2.5 : 1.5} />
                    <rect x={left + 3} y={top + 3} width={bw - 6} height={BANNER_H - 6} rx={2} fill="none" stroke={edge} strokeWidth={0.6} opacity={0.55} />
                    <text
                      x={x}
                      y={years ? y - 2 : y + 5.5}
                      textAnchor="middle"
                      className="poster-banner__name"
                      {...(squeeze ? { textLength: bw - BANNER_PAD, lengthAdjust: 'spacingAndGlyphs' } : {})}
                    >
                      {label}
                    </text>
                    {years && <text x={x} y={y + 14} textAnchor="middle" className="poster-banner__years">{years}</text>}
                  </g>
                );
              })}

              {art.drifting.map((leaf, i) => <Leaf key={`d${i}`} leaf={leaf} />)}

              {/* Title */}
              <text x={titleX} y={groundY + titleSize * 1.45} textAnchor="middle" className="poster-title-text" style={{ fontSize: titleSize }}>{title}</text>
              <g transform={`translate(${titleX} ${groundY + titleSize * 1.95}) scale(${titleSize / 40})`}>
                <path d="M-150,0 C-80,-6 80,-6 150,0" stroke={BARK_DARK} strokeWidth={1.4} fill="none" />
                {[-120, -80, -40, 40, 80, 120].map((dx, i) => (
                  <Leaf key={dx} leaf={{ x: dx, y: -3, angle: i % 2 ? -25 : -155, size: 13, color: LEAF_COLORS[(i * 3) % LEAF_COLORS.length], shape: i % 3 ? 'oak' : 'round', opacity: 0.9 }} />
                ))}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PosterModal;
