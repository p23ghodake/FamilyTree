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
import greatVibesLatin from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2';
import yatraOneDevanagari from '@fontsource/yatra-one/files/yatra-one-devanagari-400-normal.woff2';
import yatraOneLatin from '@fontsource/yatra-one/files/yatra-one-latin-400-normal.woff2';
import './PosterModal.css';

const SLOT_W = 170;
const LEVEL_H = 150;
const MAX_LEVEL_H = 320;
const POSTER_RATIO = 0.62;
const ANCESTOR_RATIO = 0.45;
const SINGLE_H = 44;
const COUPLE_H = 76;
const MIN_CARD_W = 84;
const MAX_CARD_W = 158;
const CARD_PAD = 30;
const NAME_MAX_CHARS = 20;
const SIDE_PAD = 110;
const TOP_PAD = 150;
const TRUNK_H = 90;
const TITLE_H = 96;
const MIN_W = 760;
const GENERATION_CHOICES = [2, 3, 4, 5, 6, 7, 8];
// Leaf cards: sons in green, daughters in rose, mirrored corner shapes.
const CARD_COLORS = {
  male: { edge: '#6a994e', text: '#24402a' },
  female: { edge: '#c96f8a', text: '#5c2638' },
};
const HEART = '#a7c957';
const FONT = {
  en: { family: 'Poster Great Vibes', size: 23 },
  mr: { family: 'Poster Yatra One', size: 17 },
};
const FONT_FILES = [greatVibesLatin, yatraOneDevanagari, yatraOneLatin];

const Leaf: React.FC<{ leaf: LeafArt }> = ({ leaf }) => (
  <path
    d={LEAF_PATHS[leaf.shape]}
    fill={leaf.color}
    opacity={leaf.opacity.toFixed(2)}
    transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.size.toFixed(2)})`}
  />
);

// Text styles and fonts live inside the SVG so the downloaded image matches the screen.
const SVG_STYLE = `
  @font-face { font-family: '${FONT.en.family}'; src: url(${greatVibesLatin}) format('woff2'); }
  @font-face { font-family: '${FONT.mr.family}'; src: url(${yatraOneDevanagari}) format('woff2'); unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+25CC, U+A8E0-A8FF; }
  @font-face { font-family: '${FONT.mr.family}'; src: url(${yatraOneLatin}) format('woff2'); unicode-range: U+0000-00FF; }
  .poster-card__name--en { font-family: '${FONT.en.family}', 'Brush Script MT', cursive; font-size: ${FONT.en.size}px; }
  .poster-card__name--mr { font-family: '${FONT.mr.family}', 'Nirmala UI', 'Mangal', sans-serif; font-size: ${FONT.mr.size}px; }
  .poster-card__heart { font-family: Georgia, serif; font-size: 12px; fill: ${HEART}; }
  .poster-title-text { font-family: 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive; fill: ${BARK_DARK}; }
`;

/** Swaps the bundled font URLs for data URLs, since an SVG drawn as an image cannot fetch them. */
async function inlineFonts(svgText: string): Promise<string> {
  let out = svgText;
  for (const url of FONT_FILES) {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    out = out.split(url).join(data);
  }
  return out;
}

/** Card outline with two rounded corners: top-right/bottom-left for sons, mirrored for daughters. */
function leafCard(left: number, top: number, w: number, h: number, female: boolean): string {
  const big = Math.min(18, h / 2);
  const [tl, tr, br, bl] = female ? [big, 3, big, 3] : [3, big, 3, big];
  return `M${left + tl},${top} H${left + w - tr} A${tr},${tr} 0 0 1 ${left + w},${top + tr} V${top + h - br} `
    + `A${br},${br} 0 0 1 ${left + w - br},${top + h} H${left + bl} A${bl},${bl} 0 0 1 ${left},${top + h - bl} `
    + `V${top + tl} A${tl},${tl} 0 0 1 ${left + tl},${top} Z`;
}

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

/** Rendered width of a card name, falling back to an estimate where canvas is unavailable. */
function nameWidth(text: string, lang: 'en' | 'mr'): number {
  const { family, size } = FONT[lang];
  if (measureContext === undefined) measureContext = document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * size * 0.5;
  measureContext.font = `${size}px '${family}', serif`;
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
  const marriages = useMemo(() => currentTree?.relationships.spouses ?? [], [currentTree]);
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const [rootId, setRootId] = useState<string>(
    () => state.selectedMemberId ?? findPosterRoot(members, parentChild) ?? members[0]?.id ?? '',
  );
  const [generations, setGenerations] = useState(4);
  const [fit, setFit] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  // Card widths are measured with the card fonts, so re-render once they have loaded.
  const [, setFontsLoaded] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let live = true;
    Promise.all([FONT.en, FONT.mr].map(f => fonts.load(`${f.size}px '${f.family}'`, 'Aa अ')))
      .then(() => { if (live) setFontsLoaded(n => n + 1); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

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
    () => buildPosterLayout(rootId, generations, members, parentChild, marriages),
    [rootId, generations, members, parentChild, marriages],
  );
  const cardH = useCallback((n: PosterNode) => (n.kind === 'fork' ? 0 : n.spouseId ? COUPLE_H : SINGLE_H), []);

  const contentW = layout.slots * SLOT_W;
  const width = Math.max(contentW + SIDE_PAD * 2, MIN_W);
  const offsetX = (width - contentW) / 2;
  const titleSize = Math.min(96, Math.max(40, width / 28));
  const titleH = Math.max(TITLE_H, titleSize * 2.4);
  const focusDepth = layout.focusDepth;
  const descGaps = Math.max(layout.levels - 1 - focusDepth, 0);
  const fixedH = TOP_PAD + COUPLE_H / 2 + titleH;
  // Stretch the levels so wide families still look like a poster rather than a thin strip.
  const levelH = descGaps + focusDepth
    ? Math.min(MAX_LEVEL_H, Math.max(LEVEL_H, (width * POSTER_RATIO - fixedH - TRUNK_H) / (descGaps + ANCESTOR_RATIO * focusDepth + 0.8)))
    : LEVEL_H;
  // Ancestors sit closer together on the trunk than the descendant levels above.
  const ancestorGap = Math.max(COUPLE_H + 30, levelH * ANCESTOR_RATIO);
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
      nodes: layout.nodes, focusDepth, posOf, cardH, groundY, trunkH, scale: artScale,
      minX: offsetX, maxX: offsetX + contentW,
    }),
    [layout, focusDepth, posOf, cardH, groundY, trunkH, artScale, offsetX, contentW],
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
    const svgUrl = URL.createObjectURL(new Blob([await inlineFonts(serializeForExport(svg, exportSize.width, exportSize.height))], { type: 'image/svg+xml' }));
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

              {/* Member cards: one per person, with the spouse on the same card */}
              {layout.nodes.map(n => {
                const m = byId.get(n.id);
                if (!m || n.kind === 'fork') return null;
                const spouse = n.spouseId ? byId.get(n.spouseId) : undefined;
                const { x, y } = posOf(n);
                const names = [m, ...(spouse ? [spouse] : [])].map(p => truncate(getDisplayFirstName(p, lang), NAME_MAX_CHARS));
                const font = lang === 'mr' ? 'mr' : 'en';
                const textW = Math.max(...names.map(s => nameWidth(s, font)));
                const w = Math.min(MAX_CARD_W, Math.max(MIN_CARD_W, textW + CARD_PAD));
                const squeeze = textW > w - CARD_PAD ? { textLength: w - CARD_PAD, lengthAdjust: 'spacingAndGlyphs' as const } : {};
                const h = cardH(n);
                const female = m.gender === 'female';
                const colors = female ? CARD_COLORS.female : CARD_COLORS.male;
                const focus = n.depth === focusDepth;
                const nameClass = `poster-card__name--${font}`;
                return (
                  <g key={`c-${n.id}`} className="poster-card" filter="url(#poster-banner-shadow)">
                    <title>{names.join(' ♥ ')}</title>
                    <path d={leafCard(x - w / 2, y - h / 2, w, h, female)} fill={focus ? '#fdfbea' : '#ffffff'} stroke={colors.edge} strokeWidth={focus ? 3 : 2} />
                    {spouse ? (
                      <>
                        <text x={x} y={y - 12} textAnchor="middle" className={nameClass} fill={colors.text} {...squeeze}>{names[0]}</text>
                        <text x={x} y={y + 4} textAnchor="middle" className="poster-card__heart">♥</text>
                        <text x={x} y={y + 25} textAnchor="middle" className={nameClass} fill={colors.text} {...squeeze}>{names[1]}</text>
                      </>
                    ) : (
                      <text x={x} y={y + 7} textAnchor="middle" className={nameClass} fill={colors.text} {...squeeze}>{names[0]}</text>
                    )}
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
