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
import {
  BARK_DARK, BARK_LIGHT, BARK_MID, buildPosterArt, LEAF_DEFS, LeafArt, LeafShape, mix, PAPER, Point, POSTER_THEMES, PosterTheme,
  rng, SHADOW_OFFSET, SOIL, THEMES,
} from './posterArt';
import { RawFamilyMember } from '../../types/FamilyTypes';
import greatVibesLatin from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2';
import yatraOneDevanagari from '@fontsource/yatra-one/files/yatra-one-devanagari-400-normal.woff2';
import yatraOneLatin from '@fontsource/yatra-one/files/yatra-one-latin-400-normal.woff2';
import './PosterModal.css';

const SLOT_W = 170;
const LEVEL_H = 150;
const MAX_LEVEL_H = 320;
const POSTER_RATIO = 0.62;
const ANCESTOR_RATIO = 0.45;
const COUPLE_H = 80;
const CARD_PAD_Y = 11;
const NAME_ROW = 22;
const YEARS_ROW = 13;
const HEART_ROW = 14;
const WIFE_GAP = 2;
/** Cards are nudged up or down a little so generations don't sit on ruler-straight lines. */
const CARD_JITTER = 8;
const MIN_CARD_W = 84;
const MAX_CARD_W = 158;
const CARD_PAD = 30;
const NAME_MAX_CHARS = 20;
const SIDE_PAD = 110;
const TOP_PAD = 150;
const TRUNK_H = 90;
const TITLE_H = 96;
const TITLE_GAP = 10;
/** Space for the decorative border around the sheet. */
const FRAME = 44;
const FRAME_INSET = 20;
const MIN_W = 760;
const GENERATION_CHOICES = [2, 3, 4, 5, 6, 7, 8];
// Hanging tags: sons in green, daughters in rose, mirrored corner shapes.
const CARD_COLORS = {
  male: { edge: '#6a994e', text: '#24402a' },
  female: { edge: '#c96f8a', text: '#5c2638' },
};
const HEART = '#a7c957';
const TWINE = '#8b6b47';
const SHADOW_INK = '#2e2018';
const YEARS_FONT = { family: 'Georgia, serif', size: 11 };
const FONT = {
  en: { family: 'Poster Great Vibes', size: 23 },
  mr: { family: 'Poster Yatra One', size: 17 },
};
const FONT_FILES = [greatVibesLatin, yatraOneDevanagari, yatraOneLatin];

const LEAF_SHAPES = Object.keys(LEAF_DEFS) as LeafShape[];

/** Each leaf reuses one of the shapes drawn once in <defs>, which keeps the SVG small. */
const Leaf: React.FC<{ leaf: LeafArt }> = ({ leaf }) => (
  <use
    href={`#poster-leaf-${leaf.shape}`}
    fill={leaf.color}
    opacity={leaf.opacity.toFixed(2)}
    transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.size.toFixed(2)} ${(leaf.size * leaf.squash).toFixed(2)})`}
  />
);

/** Scroll-work for the top-left corner of the frame; mirrored for the other corners. */
const FLOURISH = 'M8,74C8,36 36,8 74,8M74,8c10,0 16,6 14,12c-2,5 -9,5 -10,0M8,74c0,10 6,16 12,14c5,-2 5,-9 0,-10'
  + 'M18,40C18,27 27,18 40,18M14,14L34,34';

// Text styles and fonts live inside the SVG so the downloaded image matches the screen.
const SVG_STYLE = `
  @font-face { font-family: '${FONT.en.family}'; src: url(${greatVibesLatin}) format('woff2'); }
  @font-face { font-family: '${FONT.mr.family}'; src: url(${yatraOneDevanagari}) format('woff2'); unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+25CC, U+A8E0-A8FF; }
  @font-face { font-family: '${FONT.mr.family}'; src: url(${yatraOneLatin}) format('woff2'); unicode-range: U+0000-00FF; }
  .poster-card__name--en { font-family: '${FONT.en.family}', 'Brush Script MT', cursive; font-size: ${FONT.en.size}px; }
  .poster-card__name--mr { font-family: '${FONT.mr.family}', 'Nirmala UI', 'Mangal', sans-serif; font-size: ${FONT.mr.size}px; }
  .poster-card__heart { font-family: Georgia, serif; font-size: 12px; fill: ${HEART}; }
  .poster-card__years { font-family: ${YEARS_FONT.family}; font-size: ${YEARS_FONT.size}px; letter-spacing: 0.3px; }
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

interface CardPerson { id: string; name: string; years: string }
type CardRow = { kind: 'name' | 'years' | 'heart'; person: number; baseline: number };

/** Stacks the names (and optional years) on a card: the man first, then a heart, then each wife. */
function cardRows(people: CardPerson[]): { rows: CardRow[]; h: number } {
  const rows: CardRow[] = [];
  let y = CARD_PAD_Y;
  people.forEach((p, i) => {
    if (i === 1) {
      rows.push({ kind: 'heart', person: i, baseline: y + 11 });
      y += HEART_ROW;
    } else if (i > 1) {
      y += WIFE_GAP;
    }
    rows.push({ kind: 'name', person: i, baseline: y + 17 });
    y += NAME_ROW;
    if (p.years) {
      rows.push({ kind: 'years', person: i, baseline: y + 8 });
      y += YEARS_ROW;
    }
  });
  return { rows, h: y + CARD_PAD_Y };
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

/** Long names may shrink to this share of the card font before their letters are squeezed. */
const MIN_NAME_SCALE = 0.72;

/** Fits one name into the card: names that fit keep their size; longer ones shrink, then squeeze as a last resort. */
function fitName(text: string, lang: 'en' | 'mr', room: number): React.SVGProps<SVGTextElement> {
  const natural = nameWidth(text, lang);
  if (natural <= room) return {};
  const scale = Math.max(MIN_NAME_SCALE, room / natural);
  const fit: React.SVGProps<SVGTextElement> = { style: { fontSize: FONT[lang].size * scale } };
  if (natural * scale > room) Object.assign(fit, { textLength: room, lengthAdjust: 'spacingAndGlyphs' });
  return fit;
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Rendered text width, falling back to an estimate where canvas is unavailable. */
function textWidth(text: string, font: string, size: number): number {
  if (measureContext === undefined) measureContext = document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * size * 0.5;
  measureContext.font = `${size}px ${font}`;
  return measureContext.measureText(text).width;
}

const nameWidth = (text: string, lang: 'en' | 'mr') => textWidth(text, `'${FONT[lang].family}', serif`, FONT[lang].size);

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

  // The poster follows the sons' line, so it always starts from a man.
  const [rootId, setRootId] = useState<string>(() => {
    const isMale = (id: string | null | undefined): id is string => !!id && byId.get(id)?.gender === 'male';
    return [state.selectedMemberId, findPosterRoot(members, parentChild)].find(isMale)
      ?? members.find(m => m.gender === 'male')?.id ?? '';
  });
  const [generations, setGenerations] = useState(4);
  const [theme, setTheme] = useState<PosterTheme>('autumn');
  const [showYears, setShowYears] = useState(false);
  // Paper texture is realistic but noisy, which makes the PNG several times larger.
  const [agedPaper, setAgedPaper] = useState(true);
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
      .filter(m => m.gender === 'male')
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
  const peopleOf = useCallback(
    (n: PosterNode): CardPerson[] => [n.id, ...n.spouseIds]
      .flatMap(id => byId.get(id) ?? [])
      .map((p: RawFamilyMember) => ({
        id: p.id,
        name: truncate(getDisplayFirstName(p, lang), NAME_MAX_CHARS),
        years: showYears ? t.posterLifeYears(p.birthYear, p.deathYear) : '',
      })),
    [byId, lang, showYears, t],
  );
  const cardH = useCallback(
    (n: PosterNode) => (n.kind === 'fork' ? 0 : cardRows(peopleOf(n)).h),
    [peopleOf],
  );
  const tallestCard = useMemo(() => Math.max(COUPLE_H, ...layout.nodes.map(cardH)), [layout, cardH]);

  const contentW = layout.slots * SLOT_W;
  const width = Math.max(contentW + SIDE_PAD * 2, MIN_W);
  const offsetX = (width - contentW) / 2;
  const titleSize = Math.min(96, Math.max(40, width / 28));
  const titleH = Math.max(TITLE_H, titleSize * 2.4) + TITLE_GAP;
  const focusDepth = layout.focusDepth;
  const descGaps = Math.max(layout.levels - 1 - focusDepth, 0);
  const fixedH = TOP_PAD + tallestCard / 2 + titleH + FRAME;
  // Stretch the levels so wide families still look like a poster rather than a thin strip.
  const levelH = descGaps + focusDepth
    ? Math.min(MAX_LEVEL_H, Math.max(LEVEL_H, tallestCard + 40, (width * POSTER_RATIO - fixedH - TRUNK_H) / (descGaps + ANCESTOR_RATIO * focusDepth + 0.8)))
    : Math.max(LEVEL_H, tallestCard + 40);
  // Ancestors sit closer together on the trunk than the descendant levels above.
  const ancestorGap = Math.max(tallestCard + 30, levelH * ANCESTOR_RATIO);
  const trunkH = Math.max(TRUNK_H, levelH * 0.6);
  const height = fixedH + descGaps * levelH + focusDepth * ancestorGap + trunkH;
  const groundY = height - titleH - FRAME;
  const rootY = groundY - trunkH;
  const artScale = Math.min(1.8, Math.max(1, levelH / 150));

  const posOf = useCallback(
    (n: PosterNode): Point => ({
      x: offsetX + n.x * SLOT_W,
      y: n.depth <= focusDepth
        ? rootY - n.depth * ancestorGap
        : rootY - focusDepth * ancestorGap - (n.depth - focusDepth) * levelH
          + (n.kind === 'person' ? (rng(n.id)() - 0.5) * 2 * CARD_JITTER : 0),
    }),
    [offsetX, rootY, levelH, ancestorGap, focusDepth],
  );

  const art = useMemo(
    () => buildPosterArt({
      nodes: layout.nodes, focusDepth, posOf, cardH, groundY, trunkH, scale: artScale,
      minX: offsetX, maxX: offsetX + contentW, theme,
    }),
    [layout, focusDepth, posOf, cardH, groundY, trunkH, artScale, offsetX, contentW, theme],
  );
  const spec = THEMES[theme];
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
  const titleX = Math.min(width - titleHalf - FRAME_INSET - 30, Math.max(titleHalf + FRAME_INSET + 30, rootPos.x));
  const titleY = groundY + TITLE_GAP + titleSize * 1.45;
  const frameCorners = [
    `translate(${FRAME_INSET} ${FRAME_INSET})`,
    `translate(${width - FRAME_INSET} ${FRAME_INSET}) scale(-1 1)`,
    `translate(${FRAME_INSET} ${height - FRAME_INSET}) scale(1 -1)`,
    `translate(${width - FRAME_INSET} ${height - FRAME_INSET}) scale(-1 -1)`,
  ];

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
            <label className="poster-field">
              <span>{t.posterStyle}</span>
              <select value={theme} onChange={e => setTheme(e.target.value as PosterTheme)}>
                {POSTER_THEMES.map(th => <option key={th} value={th}>{t.posterThemeNames[th]}</option>)}
              </select>
            </label>
            <label className="poster-field poster-field--check">
              <input type="checkbox" checked={showYears} onChange={e => setShowYears(e.target.checked)} />
              <span>{t.posterShowYears}</span>
            </label>
            <label className="poster-field poster-field--check">
              <input type="checkbox" checked={agedPaper} onChange={e => setAgedPaper(e.target.checked)} />
              <span>{t.posterAgedPaper}</span>
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
                {LEAF_SHAPES.map(shape => {
                  const def = LEAF_DEFS[shape];
                  return (
                    <g key={shape} id={`poster-leaf-${shape}`}>
                      <path d={def.body} />
                      {def.half && <path d={def.half} fill="#ffffff" opacity={0.14} />}
                      {def.vein && <path d={def.vein} fill="none" stroke="#2a1d12" strokeOpacity={0.4} strokeWidth={0.035} strokeLinecap="round" />}
                      {def.centre && <path d={def.centre} fill="#e8b84a" />}
                    </g>
                  );
                })}
                {/* Bark lit from the upper left across the whole tree, so overlapping limbs share one tone */}
                <linearGradient id="poster-bark" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width} y2={height}>
                  <stop offset="0" stopColor={mix(BARK_MID, BARK_LIGHT, 0.35)} />
                  <stop offset="1" stopColor={mix(BARK_MID, BARK_DARK, 0.5)} />
                </linearGradient>
                <linearGradient id="poster-tag" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#fffdf7" />
                  <stop offset="1" stopColor="#f1e6cf" />
                </linearGradient>
                <linearGradient id="poster-tag-focus" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#fffbe6" />
                  <stop offset="1" stopColor="#f3e3b3" />
                </linearGradient>
                <linearGradient id="poster-soil" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={SOIL} stopOpacity={0.95} />
                  <stop offset="0.6" stopColor={SOIL} stopOpacity={0.7} />
                  <stop offset="1" stopColor={SOIL} stopOpacity={0} />
                </linearGradient>
                <radialGradient id="poster-canopy">
                  <stop offset="0" stopColor={spec.canopy} stopOpacity={0.2} />
                  <stop offset="0.6" stopColor={spec.canopy} stopOpacity={0.09} />
                  <stop offset="1" stopColor={spec.canopy} stopOpacity={0} />
                </radialGradient>
                <radialGradient id="poster-ground-shadow">
                  <stop offset="0" stopColor={BARK_DARK} stopOpacity={0.22} />
                  <stop offset="1" stopColor={BARK_DARK} stopOpacity={0} />
                </radialGradient>
                <radialGradient id="poster-vignette" cx="0.5" cy="0.48" r="0.75">
                  <stop offset="0.55" stopColor="#a07a4f" stopOpacity={0} />
                  <stop offset="1" stopColor="#a07a4f" stopOpacity={0.3} />
                </radialGradient>
                {/* Aged paper: fine fibres plus large faint stains */}
                <filter id="poster-grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} />
                  <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.31  0 0 0 0 0.2  0.32 0 0 0 -0.1" />
                </filter>
                <filter id="poster-stains" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.005" numOctaves={3} seed={3} />
                  <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.4  0 0 0 0 0.22  0.55 0 0 0 -0.25" />
                </filter>
                <filter id="poster-cast" x="-5%" y="-5%" width="110%" height="110%">
                  <feColorMatrix type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0 0.07  0 0 0 0.2 0" />
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
                <filter id="poster-banner-shadow" x="-20%" y="-40%" width="140%" height="190%">
                  <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#2f2117" floodOpacity="0.4" />
                </filter>
              </defs>
              <rect width={width} height={height} fill={PAPER} />
              {agedPaper && (
                <>
                  <rect width={width} height={height} filter="url(#poster-stains)" />
                  <rect width={width} height={height} filter="url(#poster-grain)" />
                  <rect width={width} height={height} fill="url(#poster-vignette)" />
                </>
              )}

              {art.canopy.map((c, i) => <circle key={`c${i}`} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r.toFixed(1)} fill="url(#poster-canopy)" />)}
              {/* The whole tree again, blurred and offset, as its shadow on the paper */}
              <use href="#poster-tree" transform={`translate(${SHADOW_OFFSET.x} ${SHADOW_OFFSET.y})`} filter="url(#poster-cast)" />
              <ellipse cx={art.ground.cx} cy={art.ground.cy} rx={art.ground.rx} ry={18} fill="url(#poster-ground-shadow)" />

              <g id="poster-tree">
                {art.aerialRoots.map((d, i) => <path key={`a${i}`} d={d} fill="url(#poster-bark)" opacity={0.92} />)}
                {art.backLeaves.map((leaf, i) => <Leaf key={`b${i}`} leaf={leaf} />)}
                {art.wood.map((piece, i) => (
                  <g key={`w${i}`}>
                    <path d={piece.body} fill="url(#poster-bark)" />
                    {piece.shade && <path d={piece.shade} fill={SHADOW_INK} opacity={0.42} />}
                    {piece.light && <path d={piece.light} fill="#d9b48a" opacity={0.2} />}
                    {piece.cracks && <path d={piece.cracks} stroke={SHADOW_INK} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.5} />}
                    {piece.knots.map((k, j) => (
                      <g key={j} transform={`translate(${k.cx.toFixed(1)} ${k.cy.toFixed(1)}) rotate(${k.angle.toFixed(1)})`}>
                        <ellipse rx={k.rx * 1.7} ry={k.ry * 1.9} fill="none" stroke={SHADOW_INK} strokeWidth={0.9} opacity={0.35} />
                        <ellipse rx={k.rx} ry={k.ry} fill={SHADOW_INK} opacity={0.55} />
                        <ellipse rx={k.rx * 0.45} ry={k.ry * 0.4} fill="#1f150f" opacity={0.6} />
                      </g>
                    ))}
                  </g>
                ))}
                {art.twigs.map((d, i) => <path key={`t${i}`} d={d} fill={BARK_DARK} />)}
                {art.leaves.map((leaf, i) => <Leaf key={`l${i}`} leaf={leaf} />)}
              </g>

              {/* Soil mound over the root tips, with grass and pebbles */}
              {art.ground.mound && <path d={art.ground.mound} fill="url(#poster-soil)" />}
              {art.ground.footings.map((f, i) => <ellipse key={`ft${i}`} cx={f.x} cy={f.y} rx={9} ry={3.5} fill="url(#poster-soil)" />)}
              {art.ground.pebbles.map((p, i) => (
                <ellipse key={`p${i}`} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} transform={`rotate(${p.angle.toFixed(1)} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)})`}
                  fill="#a39784" stroke="#6f6252" strokeWidth={0.8} />
              ))}
              {art.ground.grass && <path d={art.ground.grass} stroke={spec.grass} strokeWidth={1.3} strokeLinecap="round" fill="none" />}
              {art.fallen.map((leaf, i) => <Leaf key={`f${i}`} leaf={leaf} />)}

              {/* Member cards: hanging name tags, one per person, with his wives on the same tag */}
              {layout.nodes.map(n => {
                const m = byId.get(n.id);
                if (!m || n.kind === 'fork') return null;
                const { x, y } = posOf(n);
                const people = peopleOf(n);
                const font = lang === 'mr' ? 'mr' : 'en';
                const textW = Math.max(
                  ...people.map(p => nameWidth(p.name, font)),
                  ...people.map(p => (p.years ? textWidth(p.years, YEARS_FONT.family, YEARS_FONT.size) : 0)),
                );
                const w = Math.min(MAX_CARD_W, Math.max(MIN_CARD_W, textW + CARD_PAD));
                const { rows, h } = cardRows(people);
                const left = x - w / 2;
                const top = y - h / 2;
                const female = m.gender === 'female';
                const colors = female ? CARD_COLORS.female : CARD_COLORS.male;
                const focus = n.depth === focusDepth;
                const nameClass = `poster-card__name--${font}`;
                const holes = [left + w * 0.24, left + w * 0.76];
                const nail = { x, y: top - 12 };
                return (
                  <g key={`c-${n.id}`} className="poster-card">
                    <title>{people.map(p => p.name).join(' ♥ ')}</title>
                    <g filter="url(#poster-banner-shadow)">
                      <path d={leafCard(left, top, w, h, female)} fill={focus ? 'url(#poster-tag-focus)' : 'url(#poster-tag)'} stroke={colors.edge} strokeWidth={focus ? 3 : 2} />
                    </g>
                    <path d={leafCard(left + 3.5, top + 3.5, w - 7, h - 7, female)} fill="none" stroke={colors.edge} strokeWidth={0.8} opacity={0.4} />
                    {holes.map(hx => <circle key={hx} cx={hx} cy={top + 6} r={2} fill="#e6d8bd" stroke={colors.edge} strokeWidth={0.8} />)}
                    <path d={`M${holes[0]},${top + 6}L${nail.x},${nail.y}L${holes[1]},${top + 6}`} stroke={TWINE} strokeWidth={1.3} strokeLinejoin="round" fill="none" />
                    <circle cx={nail.x} cy={nail.y} r={3.2} fill="#3a2a20" />
                    <circle cx={nail.x - 1} cy={nail.y - 1} r={1.1} fill="#b09070" />
                    {rows.map(row => {
                      const p = people[row.person];
                      if (row.kind === 'heart') return <text key={`h${row.person}`} x={x} y={top + row.baseline} textAnchor="middle" className="poster-card__heart">♥</text>;
                      if (row.kind === 'years') {
                        return <text key={`y${p.id}`} x={x} y={top + row.baseline} textAnchor="middle" className="poster-card__years" fill={colors.text} opacity={0.75}>{p.years}</text>;
                      }
                      return <text key={`n${p.id}`} x={x} y={top + row.baseline} textAnchor="middle" className={nameClass} fill={colors.text} {...fitName(p.name, font, w - CARD_PAD)}>{p.name}</text>;
                    })}
                  </g>
                );
              })}

              {art.drifting.map((leaf, i) => <Leaf key={`d${i}`} leaf={leaf} />)}

              {/* Decorative frame */}
              <rect x={FRAME_INSET} y={FRAME_INSET} width={width - FRAME_INSET * 2} height={height - FRAME_INSET * 2} fill="none" stroke={BARK_DARK} strokeWidth={2} opacity={0.55} />
              <rect x={FRAME_INSET + 7} y={FRAME_INSET + 7} width={width - FRAME_INSET * 2 - 14} height={height - FRAME_INSET * 2 - 14} fill="none" stroke={BARK_DARK} strokeWidth={0.8} opacity={0.45} />
              {frameCorners.map((transform, i) => (
                <g key={`fr${i}`} transform={transform}>
                  <path d={FLOURISH} stroke={BARK_DARK} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.6} />
                  {[0, 1].map(j => (
                    <Leaf key={j} leaf={{ x: 24 + j * 7, y: 24 + j * 7, angle: j ? 0 : 90, size: 13, squash: 1, color: spec.outer[(i + j) % spec.outer.length], shape: spec.shapes[0], opacity: 0.85 }} />
                  ))}
                </g>
              ))}

              {/* Title */}
              <text x={titleX} y={titleY} textAnchor="middle" className="poster-title-text" style={{ fontSize: titleSize }}>{title}</text>
              <g transform={`translate(${titleX} ${titleY + titleSize * 0.5}) scale(${titleSize / 40})`}>
                <path d="M-150,0 C-80,-6 80,-6 150,0" stroke={BARK_DARK} strokeWidth={1.4} fill="none" />
                {[-120, -80, -40, 40, 80, 120].map((dx, i) => (
                  <Leaf key={dx} leaf={{ x: dx, y: -3, angle: i % 2 ? -25 : -155, size: 13, squash: 1, color: spec.outer[(i * 3) % spec.outer.length], shape: spec.shapes[i % spec.shapes.length], opacity: 0.9 }} />
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
