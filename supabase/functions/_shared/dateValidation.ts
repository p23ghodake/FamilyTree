// Keep the calendar primitives aligned with src/processing/dateValidation.ts (covered by its tests).
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9999;
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!isValidYear(year)) return false;
  if (month === undefined) return true;
  if (month < 1 || month > 12) return false;
  return day === undefined || (day >= 1 && day <= daysInMonth(year, month));
}

export function yearFromDate(value: string | null | undefined): number | null {
  return isValidIsoDate(value) ? Number(value.slice(0, 4)) : null;
}

function dateRange(value: string): [string, string] {
  if (value.length === 4) return [`${value}-01-01`, `${value}-12-31`];
  if (value.length === 7) {
    const [year, month] = value.split('-').map(Number);
    return [`${value}-01`, `${value}-${daysInMonth(year, month)}`];
  }
  return [value, value];
}

export function isDateDefinitelyBefore(candidate: string | null | undefined, reference: string | null | undefined): boolean {
  if (!isValidIsoDate(candidate) || !isValidIsoDate(reference)) return false;
  return dateRange(candidate)[1] < dateRange(reference)[0];
}

export function validateEventDate(year: unknown, date: unknown): string | null {
  if (year != null && !isValidYear(year)) return 'has an invalid year.';
  if (date != null && date !== '' && !isValidIsoDate(date)) return 'has an invalid calendar date.';
  if (isValidYear(year) && isValidIsoDate(date) && year !== yearFromDate(date)) {
    return 'has a date that does not match its year.';
  }
  return null;
}

export function eventDate(year: number | null | undefined, date: string | null | undefined): string | null {
  return date || (year != null ? String(year).padStart(4, '0') : null);
}

export function findInvalidDate(data: unknown): string | null {
  const trees = (data as { familyTrees?: unknown } | null)?.familyTrees;
  if (!Array.isArray(trees)) return 'Family data must contain a familyTrees array.';
  for (const tree of trees) {
    const members = (tree as { members?: unknown } | null)?.members;
    if (!Array.isArray(members)) return 'Each family tree must contain a members array.';
    for (const member of members) {
      if (!member || typeof member !== 'object') return 'Invalid family member.';
      const m = member as Record<string, unknown>;
      if (m.isDeceased !== undefined && typeof m.isDeceased !== 'boolean') return 'Invalid deceased status.';
      for (const kind of ['birth', 'death']) {
        const error = validateEventDate(m[`${kind}Year`], m[`${kind}Date`]);
        if (error) return `Member "${m.id ?? ''}" ${kind} ${error}`;
      }
      if (isDateDefinitelyBefore(
        eventDate(m.deathYear as number | null, m.deathDate as string | null),
        eventDate(m.birthYear as number | null, m.birthDate as string | null),
      )) return `Member "${m.id ?? ''}" has a death date before birth.`;
    }
    const spouses = (tree as { relationships?: { spouses?: unknown } }).relationships?.spouses;
    if (spouses != null && !Array.isArray(spouses)) return 'Invalid spouse relationships.';
    for (const spouse of spouses ?? []) {
      if (!spouse || typeof spouse !== 'object') return 'Invalid spouse relationship.';
      const s = spouse as Record<string, unknown>;
      const error = validateEventDate(s.marriageYear, s.marriageDate) ?? validateEventDate(s.endYear, s.endDate);
      if (error) return `Marriage ${error}`;
      if (isDateDefinitelyBefore(
        eventDate(s.endYear as number | null, s.endDate as string | null),
        eventDate(s.marriageYear as number | null, s.marriageDate as string | null),
      )) return 'A marriage ends before it begins.';
    }
  }
  return null;
}
