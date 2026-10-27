import { describe, expect, it } from 'vitest';
import { addDays, assertIsoDay, compareDays, daysBetween, formatDay, isIsoDay, todayFrom } from '../src/dates/days.js';
import { DomainError } from '../src/domain/errors.js';

describe('isIsoDay / assertIsoDay', () => {
  it('accepts YYYY-MM-DD and rejects other shapes and impossible dates', () => {
    expect(isIsoDay('2026-11-17')).toBe(true);
    expect(assertIsoDay('2026-11-17')).toBe('2026-11-17');
    expect(isIsoDay('17/11/2026')).toBe(false);
    expect(isIsoDay('2026-13-99')).toBe(false);
    expect(() => assertIsoDay('tomorrow')).toThrow(DomainError);
  });
});

describe('formatDay / todayFrom', () => {
  it('formats the local calendar day of a Date', () => {
    expect(formatDay(new Date('2026-11-17T23:30'))).toBe('2026-11-17');
  });

  it('reads today from the injected clock', () => {
    expect(todayFrom(() => new Date('2026-03-01T08:00'))).toBe('2026-03-01');
  });
});

describe('addDays', () => {
  it('adding 0 days returns the same day', () => {
    expect(addDays('2026-11-17', 0)).toBe('2026-11-17');
  });
});

describe('compareDays / daysBetween', () => {
  it('orders days as a calendar would', () => {
    expect(compareDays('2026-11-16', '2026-11-17')).toBeLessThan(0);
    expect(compareDays('2026-11-17', '2026-11-17')).toBe(0);
    expect(compareDays('2026-12-01', '2026-11-17')).toBeGreaterThan(0);
  });

  it('counts whole days across a month end', () => {
    expect(daysBetween('2026-10-28', '2026-11-03')).toBe(6);
    expect(daysBetween('2026-11-03', '2026-10-28')).toBe(-6);
  });
});
