import * as browserDates from './dateValidation';
import * as serverDates from '../../supabase/functions/_shared/dateValidation';
import { validateRawFamilyData } from './dataValidation';
import { processAllFamilyData } from './dataProcessor';
import { ageOnDate } from './spouseRules';
import { RawFamilyData } from '../types/FamilyTypes';

const validData = (): RawFamilyData => ({ familyTrees: [{
  familyTreeId: 'dates', familyTreeDisplayName: 'Dates',
  members: [
    { id: 'a', firstName: 'Anil', lastName: 'Family', gender: 'male', birthYear: 1950, deathYear: null },
    { id: 'b', firstName: 'Bela', lastName: 'Family', gender: 'female', birthYear: 1955, deathYear: null },
  ],
  relationships: { spouses: [{ spouse1Id: 'a', spouse2Id: 'b' }], parentChild: [] },
}] });

describe.each([
  { name: 'browser', helpers: browserDates },
  { name: 'Edge Function', helpers: serverDates },
])('$name calendar validation', ({ helpers }) => {
  it.each([
    ['2000-02-29', true], ['1900-02-29', false], ['2024-02-29', true], ['1971-02-29', false],
    ['1970-02-31', false], ['1970-04-31', false], ['1970-12-31', true],
    ['1970-00-01', false], ['1970-13-01', false], ['1970-01-00', false],
    ['1970-01-32', false], ['0000-01-01', false], ['1970-2-03', false],
    ['1970-02-03T00:00:00Z', false], ['1970', true], ['1970-02', true], ['', false],
  ])('validates %s as %s', (date, valid) => {
    expect(helpers.isValidIsoDate(date)).toBe(valid);
  });

  it.each([
    [1, true], [9999, true], [0, false], [-1, false], [10000, false],
    [1970.5, false], [NaN, false], [Infinity, false], ['1970', false], [null, false],
  ])('validates year %s as %s', (year, valid) => {
    expect(helpers.isValidYear(year)).toBe(valid);
  });

  it.each([
    ['2000-01-01', '2000-12-31', true], ['2000-12-31', '2000-12-31', false],
    ['2000-02', '2000-03', true], ['2000-02', '2000-02-15', false],
    ['2000', '2000-12-31', false], ['1999', '2000', true],
    ['2001', '2000', false], ['1900-02', '1900-03-01', true],
  ])('compares the possible ranges of %s and %s', (candidate, reference, before) => {
    expect(helpers.isDateDefinitelyBefore(candidate, reference)).toBe(before);
  });

  it('checks event-year consistency and permits an unknown date', () => {
    expect(helpers.validateEventDate(2000, '2000-02-29')).toBeNull();
    expect(helpers.validateEventDate(null, null)).toBeNull();
    expect(helpers.validateEventDate(null, '2000-02')).toBeNull();
    expect(helpers.validateEventDate(1999, '2000-02-29')).toMatch(/match its year/);
    expect(helpers.validateEventDate(2000, '2000-02-31')).toMatch(/calendar date/);
    expect(helpers.validateEventDate(2000.5, null)).toMatch(/invalid year/);
  });
});

describe('import and server-write date checks', () => {
  it.each([
    { birthDate: '1950-02-31' },
    { birthDate: '1950-02-29' },
    { birthYear: 1950.5 },
    { birthYear: -1 },
    { birthDate: '1951-01-01' },
    { birthDate: '1950-12-31', deathYear: 1950, deathDate: '1950-01-01' },
    { birthDate: '1950-03', deathYear: 1950, deathDate: '1950-02' },
    { isDeceased: 'yes' },
  ])('rejects invalid member dates/status: %j', changes => {
    const data = validData();
    Object.assign(data.familyTrees[0].members[0], changes);
    expect(validateRawFamilyData(data).ok).toBe(false);
    expect(serverDates.findInvalidDate(data)).not.toBeNull();
  });

  it.each([
    { marriageDate: '1980-02-31' },
    { marriageYear: 1981, marriageDate: '1980-02' },
    { marriageDate: '1980-12-31', endDate: '1980-01-01' },
    { marriageYear: 1980, endYear: 1979 },
  ])('rejects invalid marriage dates: %j', changes => {
    const data = validData();
    Object.assign(data.familyTrees[0].relationships!.spouses[0], changes);
    expect(validateRawFamilyData(data).ok).toBe(false);
    expect(serverDates.findInvalidDate(data)).not.toBeNull();
  });

  it('accepts deceased members with unknown death dates and uncertain partial-date ordering', () => {
    const data = validData();
    Object.assign(data.familyTrees[0].members[0], { isDeceased: true });
    Object.assign(data.familyTrees[0].members[1], { birthDate: '1955-12-31', deathYear: 1955 });
    expect(validateRawFamilyData(data).ok).toBe(true);
    expect(serverDates.findInvalidDate(data)).toBeNull();
    expect(processAllFamilyData(data).familyTreesStyled[0].members[0].age).toBeNull();
  });

  it('derives known years and age from date-only legacy records', () => {
    const data = validData();
    Object.assign(data.familyTrees[0].members[0], {
      birthYear: null, birthDate: '1950-02', deathYear: null, deathDate: '2020-04-01',
    });
    expect(validateRawFamilyData(data).ok).toBe(true);
    expect(processAllFamilyData(data).familyTreesStyled[0].members[0]).toMatchObject({ birthYear: 1950, deathYear: 2020, age: 70, generationIndex: 1 });
  });

  it('does not use an impossible birthday for marriage-age checks', () => {
    expect(ageOnDate('2000-02-31')).toBeNull();
    expect(ageOnDate('1900-02-29')).toBeNull();
    expect(ageOnDate('2000-02-29', new Date(2021, 1, 28))).toBe(20);
  });
});
