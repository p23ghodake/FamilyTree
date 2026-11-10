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

/** Partial dates are rejected only when their possible ranges cannot overlap. */
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
