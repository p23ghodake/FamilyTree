import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../lib/AuthContext';
import { useDialog } from '../useDialog';
import { getDisplayFirstName } from '../../processing/displayName';
import { buildPosterLayout, findPosterRoot, PosterNode } from '../../processing/posterLayout';
import { DownloadIcon, ImageIcon, Maximize2Icon, MinusIcon, PlusIcon, PrinterIcon, RotateCcwIcon, SlidersHorizontalIcon, XIcon } from '../Icons';
import {
  BARK_DARK, BARK_LIGHT, BARK_MID, buildPosterArt, LEAF_DEFS, LeafArt, LeafShape, mix, PAPER, Point, PosterTheme,
  rng, SHADOW_OFFSET, SOIL, THEMES,
} from './posterArt';
import PosterThemePicker from './PosterThemePicker';
import { getPosterCardFootprint, getPosterNameFont, getPosterTextMetrics, PosterNameFont, PosterNameStyle, PosterTextMetrics } from './posterText';
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
const YEARS_ROW = 13;
const HEART_ROW = 18;
const WIFE_GAP = 2;
/** Cards are nudged up or down a little so generations don't sit on ruler-straight lines. */
const CARD_JITTER = 8;
const MIN_CARD_W = 84;
const CARD_PAD = 30;
const CARD_GAP = 16;
const TEXT_GAP = 4;
const YEARS_SPACING = 0.3;
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
/** Zoom is a multiple of the poster's drawn size; Fit shows the whole sheet. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
/** Below this share of the drawn size, fine detail is too small to see and is hidden on screen only. */
const FAR_SCALE = 0.3;
const ZOOM_STEP = 1.25;
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
  .poster-card text { text-rendering: geometricPrecision; -webkit-text-size-adjust: none; text-size-adjust: none; }
  .poster-card__name--en { font-family: '${FONT.en.family}', 'Brush Script MT', cursive; font-size: ${FONT.en.size}px; }
  .poster-card__name--mr { font-family: '${FONT.mr.family}', 'Nirmala UI', 'Mangal', sans-serif; font-size: ${FONT.mr.size}px; }
  .poster-card__heart { font-family: Georgia, serif; font-size: 12px; fill: ${HEART}; }
  .poster-card__years { font-family: ${YEARS_FONT.family}; font-size: ${YEARS_FONT.size}px; letter-spacing: ${YEARS_SPACING}px; }
  .poster-title-text { font-family: 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive; fill: ${BARK_DARK}; }
`;

/** Swaps the bundled font URLs for data URLs, since an SVG drawn as an image cannot fetch them. */
async function inlineFonts(svgText: string): Promise<string> {
  let out = svgText;
  for (const url of FONT_FILES) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Poster font download failed');
    const blob = await response.blob();
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
interface CardLayout { people: CardPerson[]; rows: CardRow[]; h: number; w: number }

/** Stacks the names (and optional years) on a card: the man first, then a heart, then each wife. */
function cardRows(people: CardPerson[], font: PosterNameFont, fontRevision: number): { rows: CardRow[]; h: number } {
  const rows: CardRow[] = [];
  let y = CARD_PAD_Y;
  people.forEach((p, i) => {
    if (i === 1) {
      const heart = textMetrics('♥', YEARS_FONT.family, 12, fontRevision);
      rows.push({ kind: 'heart', person: i, baseline: y + heart.ascent });
      y += Math.max(HEART_ROW, heart.ascent + heart.descent + TEXT_GAP);
    } else if (i > 1) {
      y += WIFE_GAP;
    }
    const name = textMetrics(p.name, font.family, font.size, fontRevision);
    rows.push({ kind: 'name', person: i, baseline: y + name.ascent });
    y += Math.max(font.lineHeight, name.ascent + name.descent + TEXT_GAP);
    if (p.years) {
      const years = textMetrics(p.years, YEARS_FONT.family, YEARS_FONT.size, fontRevision);
      rows.push({ kind: 'years', person: i, baseline: y + years.ascent });
      y += Math.max(YEARS_ROW, years.ascent + years.descent + TEXT_GAP);
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

let measureContext: CanvasRenderingContext2D | null | undefined;
let measureSvgText: SVGTextElement | null | undefined;
const textMeasurements = new Map<string, PosterTextMetrics>();

function resetTextMeasurements(): void {
  textMeasurements.clear();
  measureContext = undefined;
  measureSvgText?.ownerSVGElement?.remove();
  measureSvgText = undefined;
}

/** SVG geometry is the fallback when canvas or its ink-bound metrics are unavailable. */
function svgTextMetrics(text: string, font: string, size: number): Partial<TextMetrics> | null {
  if (measureSvgText === undefined) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    if (typeof label.getBBox !== 'function') measureSvgText = null;
    else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '1');
      svg.setAttribute('height', '1');
      svg.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;text-rendering:geometricPrecision;-webkit-text-size-adjust:none;text-size-adjust:none';
      label.setAttribute('text-anchor', 'middle');
      svg.appendChild(label);
      document.body.appendChild(svg);
      measureSvgText = label;
    }
  }
  if (!measureSvgText) return null;
  measureSvgText.setAttribute('font-family', font);
  measureSvgText.setAttribute('font-size', String(size));
  measureSvgText.textContent = text;
  try {
    const box = measureSvgText.getBBox();
    return {
      width: measureSvgText.getComputedTextLength(),
      actualBoundingBoxLeft: -box.x, actualBoundingBoxRight: box.x + box.width,
      actualBoundingBoxAscent: -box.y, actualBoundingBoxDescent: box.y + box.height,
    };
  } catch {
    return null;
  }
}

function textMetrics(text: string, font: string, size: number, fontRevision = 0): PosterTextMetrics {
  const key = `${fontRevision}:${size}:${font}:${text}`;
  const cached = textMeasurements.get(key);
  if (cached) return cached;
  if (measureContext === undefined) {
    try { measureContext = document.createElement('canvas').getContext('2d'); }
    catch { measureContext = null; }
  }
  let measured: Partial<TextMetrics> | undefined;
  if (measureContext) {
    measureContext.font = `${size}px ${font}`;
    measureContext.textAlign = 'center';
    measureContext.textBaseline = 'alphabetic';
    measured = measureContext.measureText(text);
  }
  if (!measured || ![measured.actualBoundingBoxLeft, measured.actualBoundingBoxRight, measured.actualBoundingBoxAscent, measured.actualBoundingBoxDescent].every(value => value !== undefined && Number.isFinite(value))) {
    measured = svgTextMetrics(text, font, size) ?? measured;
  }
  const metrics = getPosterTextMetrics(measured ?? { width: Array.from(text).length * size }, size);
  if (textMeasurements.size >= 5000) textMeasurements.clear();
  textMeasurements.set(key, metrics);
  return metrics;
}

function textWidth(text: string, font: string, size: number, fontRevision = 0): number {
  return textMetrics(text, font, size, fontRevision).width;
}

function cardTilt(id: string): number {
  return Number(((rng(`poster-card:${id}`)() - 0.5) * 5).toFixed(1));
}

function useCompactPoster(): boolean {
  const media = '(max-width: 980px), (max-height: 560px)';
  const [compact, setCompact] = useState(() => window.matchMedia ? window.matchMedia(media).matches : window.innerWidth <= 980 || window.innerHeight <= 560);
  useEffect(() => {
    const query = window.matchMedia ? window.matchMedia(media) : null;
    const update = () => setCompact(query ? query.matches : window.innerWidth <= 980 || window.innerHeight <= 560);
    update();
    if (!query) {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    if (query.addEventListener) {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);
  return compact;
}

interface Props { onClose: () => void; returnFocus?: () => HTMLElement | null; }

const PosterModal: React.FC<Props> = ({ onClose, returnFocus }) => {
  const { state, currentTree } = useFamilyTree();
  const hasTree = !!currentTree;
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const customizeRef = useRef<HTMLButtonElement>(null);
  const toolbarFocus = useRef<'settings' | 'toggle' | null>(null);
  const compact = useCompactPoster();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => { setSettingsOpen(false); customizeRef.current?.focus(); }, []);
  useDialog(dialogRef, () => { if (compact && settingsOpen) closeSettings(); else onClose(); }, hasTree, returnFocus);
  useLayoutEffect(() => {
    const settings = settingsRef.current;
    if (compact && settingsOpen) settings?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    else if (compact && (toolbarFocus.current === 'settings' || settings?.contains(document.activeElement))) customizeRef.current?.focus();
    else if (!compact && (toolbarFocus.current === 'toggle' || document.activeElement === customizeRef.current)) settings?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, [compact, settingsOpen]);

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
  const [nameStyle, setNameStyle] = useState<PosterNameStyle>('heritage');
  const [personQuery, setPersonQuery] = useState('');
  const [showYears, setShowYears] = useState(false);
  // Paper texture is realistic but noisy, which makes the PNG several times larger.
  const [agedPaper, setAgedPaper] = useState(true);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [viewReset, setViewReset] = useState(0);
  const [far, setFar] = useState(false);
  const zoomAnchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // Font loading can change both the ink bounds and the card's required spacing.
  const [fontRevision, setFontsLoaded] = useState(0);
  useEffect(() => {
    if (!hasTree) return;
    const fonts = document.fonts;
    let live = true;
    const refresh = () => { if (live) { resetTextMeasurements(); setFontsLoaded(n => n + 1); } };
    if (fonts) {
      Promise.all([FONT.en, FONT.mr].map(f => fonts.load(`${f.size}px '${f.family}'`, 'Aa अ')))
        .then(refresh).catch(refresh);
      if (typeof fonts.addEventListener === 'function') fonts.addEventListener('loadingdone', refresh);
    }
    return () => {
      live = false;
      if (fonts && typeof fonts.removeEventListener === 'function') fonts.removeEventListener('loadingdone', refresh);
      resetTextMeasurements();
    };
  }, [hasTree]);

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
  const matchingPeople = useMemo(() => {
    const query = personQuery.trim().toLocaleLowerCase(lang);
    return personOptions.filter(person => person.label.toLocaleLowerCase(lang).includes(query));
  }, [personOptions, personQuery, lang]);
  useEffect(() => {
    if (personOptions.some(person => person.id === rootId)) return;
    const selected = state.selectedMemberId;
    setRootId(selected && byId.get(selected)?.gender === 'male' ? selected
      : findPosterRoot(members, parentChild) ?? members.find(member => member.gender === 'male')?.id ?? '');
  }, [personOptions, rootId, state.selectedMemberId, byId, members, parentChild]);

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
        name: getDisplayFirstName(p, lang),
        years: showYears ? t.posterLifeYears(p.birthYear, p.deathYear) : '',
      })),
    [byId, lang, showYears, t],
  );
  const nameFont = getPosterNameFont(nameStyle, lang);
  const cardLayouts = useMemo(() => new Map<string, CardLayout>(layout.nodes.filter(n => n.kind === 'person').map(n => {
    const people = peopleOf(n);
    const { rows, h } = cardRows(people, nameFont, fontRevision);
    const textW = Math.max(0,
      ...people.map(person => textWidth(person.name, nameFont.family, nameFont.size, fontRevision)),
      ...people.map(person => person.years ? textWidth(person.years, YEARS_FONT.family, YEARS_FONT.size, fontRevision) + Math.max(0, Array.from(person.years).length - 1) * YEARS_SPACING : 0),
    );
    return [n.id, { people, rows, h, w: Math.max(MIN_CARD_W, textW + CARD_PAD) }];
  })), [layout, peopleOf, nameFont, fontRevision]);
  const cardH = useCallback(
    (n: PosterNode) => (n.kind === 'fork' ? 0 : cardLayouts.get(n.id)?.h ?? 0),
    [cardLayouts],
  );
  const { slotW, tallestCard } = useMemo(() => {
    let slotW = SLOT_W;
    let tallestCard = COUPLE_H;
    cardLayouts.forEach((card, id) => {
      const footprint = getPosterCardFootprint(card.w, card.h, cardTilt(id));
      slotW = Math.max(slotW, footprint.width + CARD_GAP);
      tallestCard = Math.max(tallestCard, footprint.height);
    });
    return { slotW, tallestCard };
  }, [cardLayouts]);

  const contentW = layout.slots * slotW;
  const width = Math.max(contentW + SIDE_PAD * 2, MIN_W);
  const offsetX = (width - contentW) / 2;
  const titleSize = Math.min(96, Math.max(40, width / 28));
  const titleH = Math.max(TITLE_H, titleSize * 2.4) + TITLE_GAP;
  const focusDepth = layout.focusDepth;
  const descGaps = Math.max(layout.levels - 1 - focusDepth, 0);
  const fixedH = TOP_PAD + tallestCard / 2 + titleH + FRAME;
  // Stretch the levels so wide families still look like a poster rather than a thin strip.
  const levelH = descGaps + focusDepth
    ? Math.max(tallestCard + 40, Math.min(MAX_LEVEL_H, Math.max(LEVEL_H, (width * POSTER_RATIO - fixedH - TRUNK_H) / (descGaps + ANCESTOR_RATIO * focusDepth + 0.8))))
    : Math.max(LEVEL_H, tallestCard + 40);
  // Ancestors sit closer together on the trunk than the descendant levels above.
  const ancestorGap = Math.max(tallestCard + 30, levelH * ANCESTOR_RATIO);
  const trunkH = Math.max(TRUNK_H, levelH * 0.6);
  const height = fixedH + descGaps * levelH + focusDepth * ancestorGap + trunkH;
  const groundY = height - titleH - FRAME;
  const rootY = groundY - trunkH;
  const artScale = Math.min(1.8, Math.max(1, levelH / 150));

  const posOf = useCallback(
    (n: PosterNode): Point => {
      const x = offsetX + n.x * slotW;
      return {
        x,
        y: n.depth <= focusDepth
          ? rootY - n.depth * ancestorGap
          : rootY - focusDepth * ancestorGap - (n.depth - focusDepth) * levelH
            + (n.kind === 'person' ? (rng(n.id)() - 0.5) * 2 * CARD_JITTER : 0),
      };
    },
    [offsetX, slotW, rootY, levelH, ancestorGap, focusDepth],
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

  // Zoom about a screen point (default: the middle of the view), keeping that point of the poster fixed.
  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const scroller = scrollRef.current;
    const sheet = sheetRef.current;
    if (!scroller || !sheet) return;
    const rect = sheet.getBoundingClientRect();
    const measuredFit = Math.min(rect.width / width, rect.height / height);
    const current = fit ? (measuredFit > 0 ? measuredFit : fitScale) : zoom;
    const minimum = Math.min(MIN_ZOOM, fit ? current : fitScale);
    const next = Math.min(MAX_ZOOM, Math.max(minimum, current * factor));
    if (next === current) return;
    const box = scroller.getBoundingClientRect();
    const cx = clientX ?? box.left + box.width / 2;
    const cy = clientY ?? box.top + box.height / 2;
    const w = width * current;
    const h = height * current;
    const left = rect.left + (rect.width - w) / 2;
    const top = rect.top + (rect.height - h) / 2;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    zoomAnchor.current = { fx: w > 0 ? clamp01((cx - left) / w) : 0.5, fy: h > 0 ? clamp01((cy - top) / h) : 0.5, cx, cy };
    flushSync(() => { setFit(false); setZoom(next); });
  }, [fit, zoom, fitScale, width, height]);
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!hasTree || !el || fit) return;
    const anchor = zoomAnchor.current;
    zoomAnchor.current = null;
    if (anchor && sheetRef.current) {
      const rect = sheetRef.current.getBoundingClientRect();
      el.scrollLeft += rect.left + anchor.fx * rect.width - anchor.cx;
      el.scrollTop += rect.top + anchor.fy * rect.height - anchor.cy;
      return;
    }
    el.scrollLeft = rootPos.x * zoom - el.clientWidth / 2;
    el.scrollTop = el.scrollHeight;
  }, [fit, zoom, rootPos.x, rootPos.y, layout, viewReset, hasTree]);

  // Hide fine detail on screen once the poster is shown very small. The class sits on the wrapper, not the
  // <svg>, so the PNG export (which clones only the <svg>) and print always keep full detail.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!hasTree || !sheet) return;
    const measure = () => {
      if (!fit) return setFar(zoom < FAR_SCALE);
      const rect = sheet.getBoundingClientRect();
      const measured = Math.min(rect.width / width, rect.height / height);
      setFitScale(measured > 0 ? measured : 1);
      setFar(measured > 0 && measured < FAR_SCALE);
    };
    measure();
    if (!fit || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [fit, zoom, width, height, hasTree]);

  // Ctrl/⌘ + wheel (also a trackpad pinch) and a two-finger pinch zoom the poster. These need
  // non-passive native listeners so the browser's own page zoom and scrolling can be cancelled.
  useEffect(() => {
    const el = scrollRef.current;
    if (!hasTree || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomByRef.current(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002), e.clientX, e.clientY);
    };
    let last = 0;
    const gap = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => { last = e.touches.length === 2 ? gap(e.touches) : 0; };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const now = gap(e.touches);
      if (last > 0 && now > 0) {
        zoomByRef.current(now / last, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
      }
      last = now;
    };
    const onTouchEnd = () => { last = 0; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [hasTree]);

  const handleDownload = useCallback(async () => {
    const svg = sheetRef.current?.querySelector('svg');
    if (!svg) return;
    setIsExporting(true);
    let svgUrl: string | null = null;
    try {
      if (document.fonts) {
        await document.fonts.ready;
        resetTextMeasurements();
        flushSync(() => setFontsLoaded(revision => revision + 1));
      }
      const [, , logicalW, logicalH] = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      const scale = exportScale(logicalW, logicalH);
      const imageW = Math.round(logicalW * scale);
      const imageH = Math.round(logicalH * scale);
      const serialized = serializeForExport(svg, imageW, imageH);
      const withFonts = await inlineFonts(serialized);
      svgUrl = URL.createObjectURL(new Blob([withFonts], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = svgUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = imageW;
      canvas.height = imageH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available');
      ctx.drawImage(img, 0, 0, imageW, imageH);
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
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      setIsExporting(false);
    }
  }, [nameOf, rootId, t]);

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
  const maxTitleHalf = (width - FRAME_INSET * 2 - 30) / 2;
  const titleHalf = Math.min(maxTitleHalf, Math.max(160, title.length * titleSize * 0.24));
  const titleRoom = Math.max(1, titleHalf * 1.8);
  const titleTextWidth = textWidth(title, "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive", titleSize);
  const titleFit = titleTextWidth > titleRoom ? { textLength: titleRoom, lengthAdjust: 'spacingAndGlyphs' as const } : {};
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
        <section className="poster-toolbar" aria-label={t.posterToolbar} onFocusCapture={event => { toolbarFocus.current = settingsRef.current?.contains(event.target) ? 'settings' : event.target === customizeRef.current ? 'toggle' : null; }}>
          <div className="poster-header">
            <div className="poster-header__left">
              <ImageIcon size={18} className="poster-header__icon" />
              <span id="poster-title" className="poster-header__title">{t.posterTitle}</span>
            </div>
            <div className="poster-view-controls">
              <div className="poster-zoom-controls" role="group" aria-label={t.posterZoomLevel}>
                <button type="button" className="poster-action poster-action--fit" aria-label={t.posterFit} title={t.posterFit} aria-pressed={fit} onClick={() => { zoomAnchor.current = null; setZoom(1); setFit(true); }}>
                  <Maximize2Icon size={16} /><span>{t.posterFitShort}</span>
                </button>
                <button type="button" className="poster-action poster-action--icon" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={(fit ? fitScale : zoom) <= Math.min(MIN_ZOOM, fitScale)} title={t.tooltipZoomOut} aria-label={t.tooltipZoomOut}><MinusIcon size={16} /></button>
                <output className="poster-zoom-value" aria-label={t.posterZoomLevel} aria-live="off">{Math.round((fit ? fitScale : zoom) * 100)}%</output>
                <button type="button" className="poster-action poster-action--icon" onClick={() => zoomBy(ZOOM_STEP)} disabled={(fit ? fitScale : zoom) >= MAX_ZOOM} title={t.tooltipZoomIn} aria-label={t.tooltipZoomIn}><PlusIcon size={16} /></button>
                <button type="button" className="poster-action poster-action--icon" title={t.posterResetView} aria-label={t.posterResetView} onClick={() => { zoomAnchor.current = null; setFit(false); setZoom(1); setViewReset(value => value + 1); }}><RotateCcwIcon size={16} /></button>
              </div>
              <button ref={customizeRef} type="button" className="poster-action poster-customize-toggle" hidden={!compact} disabled={!compact || isExporting} aria-controls="poster-settings" aria-expanded={compact && settingsOpen} aria-label={t.posterCustomize} title={t.posterCustomize} onClick={() => { if (settingsOpen) closeSettings(); else setSettingsOpen(true); }}>
                <SlidersHorizontalIcon size={17} /><span>{t.posterCustomize}</span>
              </button>
            </div>
            <div className="poster-header__actions">
              <button
                type="button"
                className="poster-action poster-action--primary poster-action--download"
                onClick={handleDownload}
                disabled={isExporting || layout.nodes.length === 0}
                aria-label={t.posterDownload}
                aria-busy={isExporting}
                title={t.posterDownloadHint(exportSize.width, exportSize.height)}
              >
                <DownloadIcon size={15} /><span>{t.posterDownload}</span>
              </button>
              {isAdmin && (
                <button type="button" className="poster-action poster-action--print" onClick={handlePrint} disabled={isExporting || layout.nodes.length === 0} aria-label={t.menuPrint} title={t.menuPrint}>
                  <PrinterIcon size={15} /><span>{t.menuPrint}</span>
                </button>
              )}
              <button type="button" className="poster-close" onClick={onClose} title={t.close} aria-label={t.close}>
                <XIcon size={14} />
              </button>
            </div>
          </div>
          <section ref={settingsRef} id="poster-settings" className="poster-settings" hidden={compact && !settingsOpen} aria-label={t.posterCustomize}>
            <div className="poster-settings__heading" hidden={!compact}>
              <span>{t.posterCustomize}</span>
              <button type="button" className="poster-action" disabled={!compact || !settingsOpen} onClick={closeSettings}>{t.posterDone}</button>
            </div>
            <fieldset className="poster-settings__body" disabled={isExporting || (compact && !settingsOpen)}>
              <fieldset className="poster-settings-group">
                <legend>{t.posterFamilyControls}</legend>
                <div className="poster-family-fields">
                  <label className="poster-field poster-field--search">
                    <span>{t.posterFindPerson}</span>
                    <input type="search" value={personQuery} onChange={e => setPersonQuery(e.target.value)} />
                  </label>
                  <label className="poster-field">
                    <span>{t.posterStartFrom}</span>
                    <select value={matchingPeople.some(person => person.id === rootId) ? rootId : ''} disabled={matchingPeople.length === 0} onChange={e => { setRootId(e.target.value); setPersonQuery(''); }}>
                      {!matchingPeople.some(person => person.id === rootId) && <option value="" disabled>{t.posterChooseMatch}</option>}
                      {matchingPeople.map(person => <option key={person.id} value={person.id}>{person.label}</option>)}
                    </select>
                  </label>
                  <label className="poster-field">
                    <span>{t.posterGenerations}</span>
                    <select value={generations} onChange={e => setGenerations(Number(e.target.value))}>
                      {GENERATION_CHOICES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                </div>
                {matchingPeople.length === 0 && <p className="poster-field-hint" role="status">{t.posterNoMatches}</p>}
                <p className="poster-field-hint">{t.posterLineageHint}</p>
              </fieldset>
              <fieldset className="poster-settings-group">
                <legend>{t.posterAppearance}</legend>
                <PosterThemePicker theme={theme} onChange={setTheme} label={t.posterStyle} names={t.posterThemeNames} />
                <div className="poster-appearance-fields">
                  <label className="poster-field">
                    <span>{t.posterNameStyle}</span>
                    <select value={nameStyle} onChange={e => setNameStyle(e.target.value as PosterNameStyle)}>
                      <option value="heritage">{t.posterHeritageNames}</option>
                      <option value="readable">{t.posterReadableNames}</option>
                    </select>
                  </label>
                  <div className="poster-checks">
                    <label className="poster-field poster-field--check">
                      <input type="checkbox" checked={showYears} onChange={e => setShowYears(e.target.checked)} />
                      <span>{t.posterShowYears}</span>
                    </label>
                    <label className="poster-field poster-field--check">
                      <input type="checkbox" checked={agedPaper} onChange={e => setAgedPaper(e.target.checked)} />
                      <span>{t.posterAgedPaper}</span>
                    </label>
                  </div>
                </div>
              </fieldset>
            </fieldset>
          </section>
        </section>
        <div className="poster-workspace">
          <div className="poster-viewport">
            <div ref={scrollRef} className={`poster-scroll${fit ? ' poster-scroll--fit' : ''}`}>
          {layout.nodes.length <= 1 && (
            <p className="poster-hint" role="status">{t.posterNoRelatives}</p>
          )}
          <div ref={sheetRef} className={`poster-sheet${far ? ' poster-sheet--far' : ''}`} style={fit ? undefined : { width: Math.round(width * zoom), height: Math.round(height * zoom) }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}>
              <defs>
                <style>{SVG_STYLE}</style>
                {LEAF_SHAPES.map(shape => {
                  const def = LEAF_DEFS[shape];
                  return (
                    <g key={shape} id={`poster-leaf-${shape}`}>
                      <path d={def.body} />
                      {def.half && <path d={def.half} fill="#ffffff" opacity={0.14} />}
                      {def.lower && <path d={def.lower} fill="#1d2a12" opacity={0.12} />}
                      {def.vein && <path className="poster-detail" d={def.vein} fill="none" stroke="#2a1d12" strokeOpacity={0.4} strokeWidth={0.035} strokeLinecap="round" />}
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
                <radialGradient id="poster-dapple">
                  <stop offset="0" stopColor="#fff4bd" stopOpacity={0.9} />
                  <stop offset="1" stopColor="#fff4bd" stopOpacity={0} />
                </radialGradient>
                <radialGradient id="poster-ground-shadow">
                  <stop offset="0" stopColor={BARK_DARK} stopOpacity={0.22} />
                  <stop offset="1" stopColor={BARK_DARK} stopOpacity={0} />
                </radialGradient>
                <radialGradient id="poster-vignette" cx="0.5" cy="0.48" r="0.75">
                  <stop offset="0.55" stopColor="#a07a4f" stopOpacity={0} />
                  <stop offset="1" stopColor="#a07a4f" stopOpacity={0.3} />
                </radialGradient>
                <linearGradient id="poster-background" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#f5f0e5" />
                  <stop offset="0.7" stopColor={PAPER} />
                  <stop offset="1" stopColor="#e9dcc5" />
                </linearGradient>
                <pattern id="poster-paper-texture" width="128" height="128" patternUnits="userSpaceOnUse">
                  <path d="M8 17l17-3M62 31l24 2M94 8l15-2M17 72l21-3M74 88l19 2M101 117l18-4M45 119l10 1"
                    stroke="#9c805d" strokeWidth="1" opacity="0.16" />
                  <circle cx="39" cy="44" r="1.7" fill="#8c6944" opacity="0.12" />
                  <circle cx="111" cy="58" r="1.2" fill="#8c6944" opacity="0.14" />
                  <circle cx="57" cy="99" r="1.5" fill="#8c6944" opacity="0.1" />
                  <path d="M21 28c9 4 12 7 15 13M83 101c6 3 8 6 10 11" fill="none" stroke="#8c6944" strokeWidth="1.2" opacity="0.1" />
                </pattern>
                <filter id="poster-cast" x="-5%" y="-5%" width="110%" height="110%">
                  <feColorMatrix type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0 0.07  0 0 0 0.2 0" />
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
                <filter id="poster-banner-shadow" x="-20%" y="-40%" width="140%" height="190%">
                  <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#2f2117" floodOpacity="0.4" />
                </filter>
              </defs>
              <rect width={width} height={height} fill="url(#poster-background)" />
              {agedPaper && (
                <>
                  <rect width={width} height={height} fill="url(#poster-paper-texture)" />
                  <rect width={width} height={height} fill="url(#poster-vignette)" />
                </>
              )}

              {art.canopy.map((c, i) => <circle key={`c${i}`} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r.toFixed(1)} fill="url(#poster-canopy)" />)}
              {art.dappled.map((spot, i) => (
                <circle key={`dp${i}`} cx={spot.cx.toFixed(1)} cy={spot.cy.toFixed(1)} r={spot.r.toFixed(1)}
                  fill="url(#poster-dapple)" opacity={spot.opacity.toFixed(2)} />
              ))}
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
                    {piece.grain && <path className="poster-detail" d={piece.grain} stroke={SHADOW_INK} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.3} />}
                    {piece.cracks && <path className="poster-detail" d={piece.cracks} stroke={SHADOW_INK} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.5} />}
                    {piece.knots.map((k, j) => (
                      <g key={j} className="poster-detail" transform={`translate(${k.cx.toFixed(1)} ${k.cy.toFixed(1)}) rotate(${k.angle.toFixed(1)})`}>
                        <ellipse rx={k.rx * 1.7} ry={k.ry * 1.9} fill="none" stroke={SHADOW_INK} strokeWidth={0.9} opacity={0.35} />
                        <ellipse rx={k.rx} ry={k.ry} fill={SHADOW_INK} opacity={0.55} />
                        <ellipse rx={k.rx * 0.45} ry={k.ry * 0.4} fill="#1f150f" opacity={0.6} />
                      </g>
                    ))}
                  </g>
                ))}
                {art.twigs.map((d, i) => <path key={`t${i}`} d={d} fill={BARK_DARK} />)}
                {art.leaves.map((leaf, i) => <Leaf key={`l${i}`} leaf={leaf} />)}
                {art.berries.map((b, i) => (
                  <circle key={`f${i}`} cx={b.cx.toFixed(1)} cy={b.cy.toFixed(1)} r={b.r.toFixed(1)} fill={b.color} stroke="#3a1d12" strokeOpacity={0.35} strokeWidth={0.5} />
                ))}
              </g>

              {/* Soil mound over the root tips, with grass and pebbles */}
              {art.ground.mound && <path d={art.ground.mound} fill="url(#poster-soil)" />}
              {art.ground.footings.map((f, i) => <ellipse key={`ft${i}`} cx={f.x} cy={f.y} rx={9} ry={3.5} fill="url(#poster-soil)" />)}
              <g className="poster-detail">
                {art.ground.pebbles.map((p, i) => (
                  <ellipse key={`p${i}`} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} transform={`rotate(${p.angle.toFixed(1)} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)})`}
                    fill="#a39784" stroke="#6f6252" strokeWidth={0.8} />
                ))}
                {art.ground.grass && <path d={art.ground.grass} stroke={spec.grass} strokeWidth={1.3} strokeLinecap="round" fill="none" />}
                {art.fallen.map((leaf, i) => <Leaf key={`f${i}`} leaf={leaf} />)}
              </g>

              {/* Member cards: hanging name tags, one per person, with his wives on the same tag */}
              {layout.nodes.map(n => {
                const m = byId.get(n.id);
                if (!m || n.kind === 'fork') return null;
                const { x, y } = posOf(n);
                const { people, w, rows, h } = cardLayouts.get(n.id)!;
                const font = lang === 'mr' ? 'mr' : 'en';
                const left = x - w / 2;
                const top = y - h / 2;
                const female = m.gender === 'female';
                const colors = female ? CARD_COLORS.female : CARD_COLORS.male;
                const focus = n.depth === focusDepth;
                const nameClass = `poster-card__name--${font}`;
                const holes = [left + w * 0.24, left + w * 0.76];
                const nail = { x, y: top - 12 };
                const tilt = cardTilt(n.id);
                return (
                  <g key={`c-${n.id}`} className="poster-card" transform={`rotate(${tilt.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
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
                      return (
                        <text key={`n${p.id}`} x={x} y={top + row.baseline} textAnchor="middle" className={nameClass} fill={colors.text} style={{ fontFamily: nameFont.family, fontSize: nameFont.size }}>
                          {p.name}
                        </text>
                      );
                    })}
                  </g>
                );
              })}

              <g className="poster-detail">{art.drifting.map((leaf, i) => <Leaf key={`d${i}`} leaf={leaf} />)}</g>

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
              <rect x={titleX - titleHalf} y={titleY - titleSize * 1.05} width={titleHalf * 2} height={titleSize * 1.75}
                rx={12} fill="#f8f1e4" fillOpacity={0.88} stroke={BARK_DARK} strokeOpacity={0.38} />
              <text x={titleX} y={titleY} textAnchor="middle" className="poster-title-text" style={{ fontSize: titleSize }} {...titleFit}>{title}</text>
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
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PosterModal;
