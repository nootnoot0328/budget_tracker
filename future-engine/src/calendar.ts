// Month arithmetic. A "month index" (MI) is year*12 + (month-1), so Jan 2026 = 2026*12.
export type MI = number;

export const mi = (year: number, month: number): MI => year * 12 + (month - 1);
export const yearOf = (m: MI): number => Math.floor(m / 12);
export const monthOf = (m: MI): number => (m % 12) + 1;

/** Parse "YYYY-MM" (or "YYYY-MM-DD") into a month index. */
export function parseYM(s: string): MI {
  const [y, m] = s.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) throw new Error(`Bad year-month: ${s}`);
  return mi(y, m);
}

export const fmtYM = (m: MI): string => `${yearOf(m)}-${String(monthOf(m)).padStart(2, '0')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const labelYM = (m: MI): string => `${MONTHS[monthOf(m) - 1]} ${yearOf(m)}`;
export const monthName = (month: number): string => MONTHS[month - 1];

export interface BirthDate { y: number; m: number; d: number }

export function parseDate(s: string): BirthDate {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Bad date: ${s}`);
  return { y, m, d };
}

/** Whole years of age on the given calendar day. */
export function ageOn(b: BirthDate, y: number, m: number, d: number): number {
  let age = y - b.y;
  if (m < b.m || (m === b.m && d < b.d)) age -= 1;
  return age;
}

/**
 * Age that drives CPF rate and allocation bands for wage month `m`.
 * CPF: new age-band rates apply from the first day of the month AFTER the
 * month of the relevant birthday. So we take the age attained by the last
 * day of the previous month.
 */
export function bandAge(b: BirthDate, m: MI): number {
  const prev = m - 1;
  const y = yearOf(prev), mo = monthOf(prev);
  return ageOn(b, y, mo, 31); // day 31 >= any birthday day in that month
}

/** Age at the first day of month m (used for display and the 55+ extra interest). */
export function ageAtStart(b: BirthDate, m: MI): number {
  return ageOn(b, yearOf(m), monthOf(m), 1);
}

/** Month index of the birthday at which the person reaches `age`. */
export const birthdayMonth = (b: BirthDate, age: number): MI => mi(b.y + age, b.m);
