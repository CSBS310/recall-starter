// Calendar-day helpers. The whole system thinks in 'YYYY-MM-DD' strings so
// that comparisons are plain string comparisons and nothing depends on the
// time of day (R7). "Today" always comes from a clock the caller hands in.

import { DomainError, ErrorCodes } from '../domain/errors.js';

export type Clock = () => Date;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string): boolean {
  return ISO_DAY.test(value) && !Number.isNaN(Date.parse(value));
}

export function assertIsoDay(value: string): string {
  if (!isIsoDay(value)) {
    throw new DomainError(ErrorCodes.INVALID_DATE, `Not a calendar day (YYYY-MM-DD): ${value}`);
  }
  return value;
}

/** Formats a Date as the calendar day it falls on in the local time zone. */
export function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayFrom(clock: Clock): string {
  return formatDay(clock());
}

/** Adds n calendar days (n may be negative) to an ISO day. */
export function addDays(day: string, n: number): string {
  if (n === 0) {
    return day;
  }
  // Let Date carry the arithmetic across month and year ends.
  const date = new Date(day);
  date.setDate(date.getDate() + n);
  return formatDay(date);
}

/** Negative when a is earlier than b, 0 when equal, positive when later. */
export function compareDays(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/** Whole days from a to b (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) -
    Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.round(ms / 86_400_000);
}
