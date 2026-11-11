export type PosterNameStyle = 'heritage' | 'readable';

export interface PosterNameFont {
  family: string;
  size: number;
  lineHeight: number;
}

export interface PosterTextMetrics {
  width: number;
  ascent: number;
  descent: number;
}

/** Canvas bounds are measured with centered, alphabetic text, matching the SVG labels. */
export function getPosterTextMetrics(metrics: Partial<TextMetrics>, size: number): PosterTextMetrics {
  const extent = (value: number | undefined, fallback: number) => value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback;
  const halfAdvance = extent(metrics.width, 0) / 2;
  return {
    width: Math.ceil(2 * Math.max(halfAdvance, extent(metrics.actualBoundingBoxLeft, halfAdvance), extent(metrics.actualBoundingBoxRight, halfAdvance))),
    ascent: Math.ceil(extent(metrics.actualBoundingBoxAscent, size)),
    descent: Math.ceil(extent(metrics.actualBoundingBoxDescent, size * 0.25)),
  };
}

export function getPosterCardFootprint(width: number, height: number, tilt: number): { width: number; height: number } {
  const radians = tilt * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return { width: Math.ceil(width * cos + height * sin), height: Math.ceil(height * cos + width * sin) };
}

const NAME_FONTS: Record<PosterNameStyle, Record<'en' | 'mr', PosterNameFont>> = {
  heritage: {
    en: { family: "'Poster Great Vibes', 'Brush Script MT', cursive", size: 23, lineHeight: 32 },
    mr: { family: "'Poster Yatra One', 'Nirmala UI', 'Mangal', sans-serif", size: 17, lineHeight: 24 },
  },
  readable: {
    en: { family: 'Georgia, serif', size: 18, lineHeight: 24 },
    mr: { family: "'Nirmala UI', 'Mangal', 'Poster Yatra One', sans-serif", size: 18, lineHeight: 26 },
  },
};

export const getPosterNameFont = (style: PosterNameStyle, lang: 'en' | 'mr'): PosterNameFont => NAME_FONTS[style][lang];
