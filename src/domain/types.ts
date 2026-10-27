// Entity types. Everything is a readonly plain object so that storage can
// serialise it as-is and tests can build fixtures with object literals.

/** Recall grade, as in SM-2: 0 = blackout, 5 = perfect recall. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
export const GRADES: readonly Grade[] = [0, 1, 2, 3, 4, 5];

export const PASS_GRADE = 3; // at or above this, the card counts as remembered (R3)
export const LEECH_THRESHOLD = 8; // lapses at which a card becomes a leech (R6)
export const MATURE_INTERVAL_DAYS = 21; // interval at which "learning" becomes "mature" (R9)
export const DEFAULT_SESSION_LIMIT = 20;

export interface Deck {
  readonly id: string;
  readonly name: string;
  /** ISO calendar day, e.g. '2026-10-03'. */
  readonly createdOn: string;
}

export interface CardState {
  readonly intervalDays: number;
  readonly easeFactor: number;
  readonly repetitions: number;
  /** ISO calendar day the card next comes up. */
  readonly due: string;
  readonly lapses: number;
}

export interface Card {
  readonly id: string;
  readonly deckId: string;
  readonly front: string;
  readonly back: string;
  readonly tags: readonly string[];
  readonly state: CardState;
}

export interface Review {
  readonly id: string;
  readonly cardId: string;
  readonly reviewedOn: string;
  readonly grade: Grade;
  readonly intervalBefore: number;
  readonly intervalAfter: number;
}

/** One day's worth of due cards for a deck. Lives in memory only. */
export interface Session {
  readonly date: string;
  readonly cardIds: readonly string[];
  readonly answered: number;
}

export interface CardFilter {
  readonly tag?: string;
  /** Only cards due on or before this day (R1). */
  readonly dueOn?: string;
}

export interface ImportResult {
  readonly added: readonly Card[];
  /** Fronts that already existed in the deck and were skipped (R8). */
  readonly skipped: readonly string[];
}

export interface DeckStats {
  readonly total: number;
  readonly dueToday: number;
  readonly newCards: number;
  readonly learning: number;
  readonly mature: number;
  readonly leeches: number;
  readonly reviewsLast7Days: number;
}
