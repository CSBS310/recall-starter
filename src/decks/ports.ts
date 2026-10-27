// The ports DeckService depends on. Storage implements RecallStore; the
// CLI and tests supply the id generator and the clock.

import type { Card, Deck, Review } from '../domain/types.js';

export interface RecallStore {
  listDecks(): readonly Deck[];
  findDeck(id: string): Deck | undefined;
  findDeckByName(name: string): Deck | undefined;
  saveDeck(deck: Deck): void;

  /** All cards, or only the cards of one deck. */
  listCards(deckId?: string): readonly Card[];
  findCard(id: string): Card | undefined;
  /** Inserts or replaces by id. */
  saveCard(card: Card): void;

  /** All reviews, or only the reviews of one card. */
  listReviews(cardId?: string): readonly Review[];
  addReview(review: Review): void;
}

export type IdGenerator = () => string;
