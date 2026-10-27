// A simplified SM-2 scheduler (rules R3-R6). Pure functions only: the
// service decides *when* to call these, this file decides *what* happens.

import { addDays } from '../dates/days.js';
import { type CardState, type Grade, LEECH_THRESHOLD, PASS_GRADE } from '../domain/types.js';

export const MIN_EASE = 1.3;
export const INITIAL_EASE = 2.5;

export function newCardState(today: string): CardState {
  return { intervalDays: 0, easeFactor: INITIAL_EASE, repetitions: 0, due: today, lapses: 0 };
}

export function isPass(grade: Grade): boolean {
  return grade >= PASS_GRADE;
}

export function isLeech(state: CardState): boolean {
  return state.lapses >= LEECH_THRESHOLD;
}

/** Rounds to two decimals so stored ease factors stay readable. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * R5: ease' = ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)), never below MIN_EASE.
 * The floor is applied to both the incoming ease (so a bad value that somehow
 * got into the file cannot drag the next review further down) and the result,
 * so a card can never graduate below MIN_EASE no matter how many lapses.
 */
export function easeAfter(ease: number, grade: Grade): number {
  const miss = 5 - grade;
  const delta = 0.1 - miss * (0.08 + miss * 0.02);
  return round2(Math.max(MIN_EASE, Math.max(MIN_EASE, ease) + delta));
}

/** R3: 1 day, then 6 days, then the previous interval stretched by ease. */
function nextInterval(repetitions: number, intervalDays: number, ease: number): number {
  if (repetitions === 0) {
    return 1;
  }
  if (repetitions === 1) {
    return 6;
  }
  return Math.round(intervalDays * ease);
}

/** R3-R5: the card's state after one review graded `grade` on `today`. */
export function schedule(state: CardState, grade: Grade, today: string): CardState {
  const easeFactor = easeAfter(state.easeFactor, grade);
  if (!isPass(grade)) {
    // R4: forget the streak, see it again tomorrow.
    return {
      intervalDays: 1,
      easeFactor,
      repetitions: 0,
      due: addDays(today, 1),
      lapses: state.lapses + 1,
    };
  }
  const intervalDays = nextInterval(state.repetitions, state.intervalDays, easeFactor);
  return {
    intervalDays,
    easeFactor,
    repetitions: state.repetitions + 1,
    due: addDays(today, intervalDays),
    lapses: state.lapses,
  };
}
