import { computeAge, getAgeCategory } from './ageCalculation';

describe('computeAge', () => {
  const CURRENT_YEAR = new Date().getFullYear(); // dynamic so tests never go stale

  it('returns null when birthYear is null', () => {
    expect(computeAge(null, null)).toBeNull();
  });

  it('calculates age for a living person using current year', () => {
    expect(computeAge(1990, null)).toBe(CURRENT_YEAR - 1990);
  });

  it('calculates age for a deceased person', () => {
    expect(computeAge(1920, 1990)).toBe(70);
  });

  it('returns 0 when born and died in the same year', () => {
    expect(computeAge(2000, 2000)).toBe(0);
  });

  it('handles historical birth years', () => {
    expect(computeAge(1850, 1920)).toBe(70);
  });

  it('returns negative when deathYear is before birthYear', () => {
    expect(computeAge(2000, 1990)).toBe(-10);
  });

  it('returns 0 when born and died in the same year (current)', () => {
    expect(computeAge(CURRENT_YEAR, CURRENT_YEAR)).toBe(0);
  });
});

describe('getAgeCategory', () => {
  it('returns "unknown" for null age', () => {
    expect(getAgeCategory(null)).toBe('unknown');
  });

  it('returns "infant" for age 0', () => {
    expect(getAgeCategory(0)).toBe('infant');
  });

  it('returns "infant" for age 1', () => {
    expect(getAgeCategory(1)).toBe('infant');
  });

  it('returns "toddler" for age 2', () => {
    expect(getAgeCategory(2)).toBe('toddler');
  });

  it('returns "toddler" for age 5', () => {
    expect(getAgeCategory(5)).toBe('toddler');
  });

  it('returns "youth" for age 6', () => {
    expect(getAgeCategory(6)).toBe('youth');
  });

  it('returns "youth" for age 17', () => {
    expect(getAgeCategory(17)).toBe('youth');
  });

  it('returns "adult" for age 18', () => {
    expect(getAgeCategory(18)).toBe('adult');
  });

  it('returns "adult" for age 59', () => {
    expect(getAgeCategory(59)).toBe('adult');
  });

  it('returns "senior" for age 60', () => {
    expect(getAgeCategory(60)).toBe('senior');
  });

  it('returns "senior" for age 100', () => {
    expect(getAgeCategory(100)).toBe('senior');
  });

  it('returns "senior" for very large ages (e.g. 200)', () => {
    expect(getAgeCategory(200)).toBe('senior');
  });
});
