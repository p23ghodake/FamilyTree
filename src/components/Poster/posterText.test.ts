import { getPosterCardFootprint, getPosterNameFont, getPosterTextMetrics } from './posterText';

describe('poster name typography', () => {
  it('keeps the existing heritage fonts and offers readable alternatives', () => {
    expect(getPosterNameFont('heritage', 'en').family).toContain('Poster Great Vibes');
    expect(getPosterNameFont('heritage', 'en').lineHeight).toBeGreaterThanOrEqual(32);
    expect(getPosterNameFont('heritage', 'mr').family).toContain('Poster Yatra One');
    expect(getPosterNameFont('readable', 'en').family).toBe('Georgia, serif');
    expect(getPosterNameFont('readable', 'mr').family).toContain('Nirmala UI');
    expect(getPosterNameFont('readable', 'mr').family).toContain('Poster Yatra One');
  });

  it('reserves symmetric room for cursive overhang rather than just advance width', () => {
    expect(getPosterTextMetrics({
      width: 120, actualBoundingBoxLeft: 82, actualBoundingBoxRight: 59,
      actualBoundingBoxAscent: 28.2, actualBoundingBoxDescent: 8.1,
    }, 23)).toEqual({ width: 164, ascent: 29, descent: 9 });
  });

  it('does not shrink below the advance width for whitespace or narrow ink', () => {
    expect(getPosterTextMetrics({
      width: 128, actualBoundingBoxLeft: 40, actualBoundingBoxRight: 50,
      actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3,
    }, 18).width).toBe(128);
  });

  it('uses finite conservative extents when ink metrics are unavailable', () => {
    expect(getPosterTextMetrics({ width: 64 }, 18)).toEqual({ width: 64, ascent: 18, descent: 5 });
    expect(getPosterTextMetrics({ width: NaN, actualBoundingBoxAscent: Infinity }, 18)).toEqual({ width: 0, ascent: 18, descent: 5 });
  });

  it('handles glyphs whose ink lies entirely on one side of the baseline or anchor', () => {
    expect(getPosterTextMetrics({
      width: 30, actualBoundingBoxLeft: -2, actualBoundingBoxRight: 20,
      actualBoundingBoxAscent: -5, actualBoundingBoxDescent: 12,
    }, 18)).toEqual({ width: 40, ascent: 0, descent: 12 });
  });

  it('keeps unrotated card footprints unchanged', () => {
    expect(getPosterCardFootprint(158, 120, 0)).toEqual({ width: 158, height: 120 });
  });

  it('accounts for tall cards protruding into neighboring slots when tilted', () => {
    const footprint = getPosterCardFootprint(158, 1200, 2.5);
    expect(footprint.width).toBeGreaterThan(170);
    expect(footprint.height).toBeGreaterThanOrEqual(1200);
    expect(getPosterCardFootprint(158, 1200, -2.5)).toEqual(footprint);
  });

  it('contains every rotated corner in the card footprint', () => {
    const width = 340, height = 520, tilt = 2.3;
    const radians = tilt * Math.PI / 180;
    const footprint = getPosterCardFootprint(width, height, tilt);
    for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) {
      expect(Math.abs(x * Math.cos(radians) - y * Math.sin(radians))).toBeLessThanOrEqual(footprint.width / 2);
      expect(Math.abs(x * Math.sin(radians) + y * Math.cos(radians))).toBeLessThanOrEqual(footprint.height / 2);
    }
  });
});
