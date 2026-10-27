import { describe, expect, it } from 'vitest';
import { easeAfter, isLeech, newCardState, schedule } from '../src/scheduler/sm2.js';
import { state, TODAY } from './helpers.js';

describe('newCardState', () => {
  it('starts at interval 0, ease 2.5, due today', () => {
    expect(newCardState(TODAY)).toEqual({
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      due: TODAY,
      lapses: 0,
    });
  });
});

describe('easeAfter (R5)', () => {
  it('grade 5 raises ease by 0.1, grade 4 keeps it, grade 3 lowers it by 0.14', () => {
    expect(easeAfter(2.5, 5)).toBe(2.6);
    expect(easeAfter(2.5, 4)).toBe(2.5);
    expect(easeAfter(2.5, 3)).toBe(2.36);
  });
});

describe('schedule on a pass (R3)', () => {
  it('first pass: interval 1; second pass: interval 6', () => {
    const first = schedule(state(), 4, TODAY);
    expect(first).toMatchObject({ repetitions: 1, intervalDays: 1, due: '2026-11-18' });
    const second = schedule(first, 4, '2026-11-18');
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6, due: '2026-11-24' });
  });

  it('later passes stretch the interval by the ease factor and keep the lapse count', () => {
    const next = schedule(state({ repetitions: 2, intervalDays: 6, easeFactor: 2.5, lapses: 3 }), 4, TODAY);
    expect(next).toMatchObject({ intervalDays: 15, repetitions: 3, lapses: 3 });
  });

  it('a 14-day interval from 2026-11-17 is due on 2026-12-01', () => {
    const next = schedule(state({ repetitions: 2, intervalDays: 6, easeFactor: 2.36 }), 4, TODAY);
    expect(next).toMatchObject({ intervalDays: 14, due: '2026-12-01' });
  });
});

describe('schedule on a lapse (R4)', () => {
  it('resets repetitions, sets interval 1 and counts the lapse', () => {
    const next = schedule(state({ repetitions: 4, intervalDays: 30, lapses: 1 }), 2, TODAY);
    expect(next).toMatchObject({ repetitions: 0, intervalDays: 1, lapses: 2, due: '2026-11-18' });
  });

  it('grade 2 lowers ease by 0.32', () => {
    expect(schedule(state(), 2, TODAY).easeFactor).toBe(2.18);
  });
});

describe('isLeech (R6)', () => {
  it('is false below 8 lapses and true from 8', () => {
    expect(isLeech(state({ lapses: 7 }))).toBe(false);
    expect(isLeech(state({ lapses: 8 }))).toBe(true);
  });
});
