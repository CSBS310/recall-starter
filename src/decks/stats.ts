// Deck statistics (R9). Pure: give it the deck's cards, the reviews and
// today's date; it never touches storage.

import { compareDays, daysBetween } from '../dates/days.js';
import { type Card, type DeckStats, MATURE_INTERVAL_DAYS, type Review } from '../domain/types.js';
import { isLeech } from '../scheduler/sm2.js';

export const RECENT_WINDOW_DAYS = 7;

export function isDue(card: Card, today: string): boolean {
  return compareDays(card.state.due, today) <= 0;
}

function isRecent(review: Review, today: string): boolean {
  const age = daysBetween(review.reviewedOn, today);
  return age >= 0 && age < RECENT_WINDOW_DAYS;
}

/** Reviews of this card in the last 7 days. Scans the whole review list. */
function recentReviewsOf(card: Card, reviews: readonly Review[], today: string): number {
  return reviews.filter((review) => review.cardId === card.id && isRecent(review, today)).length;
}

export function deckStats(cards: readonly Card[], reviews: readonly Review[], today: string): DeckStats {
  let dueToday = 0;
  let newCards = 0;
  let learning = 0;
  let mature = 0;
  let leeches = 0;
  let reviewsLast7Days = 0;
  for (const card of cards) {
    if (isDue(card, today)) {
      dueToday += 1;
    }
    if (card.state.repetitions === 0) {
      newCards += 1;
    } else if (card.state.intervalDays < MATURE_INTERVAL_DAYS) {
      learning += 1;
    } else {
      mature += 1;
    }
    if (isLeech(card.state)) {
      leeches += 1;
    }
    reviewsLast7Days += recentReviewsOf(card, reviews, today);
  }
  return { total: cards.length, dueToday, newCards, learning, mature, leeches, reviewsLast7Days };
}
