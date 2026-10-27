// The in-memory repository. Tests use it directly; JsonFileStore wraps it.

import type { Card, Deck, Review } from '../domain/types.js';
import type { RecallStore } from '../decks/ports.js';

export interface Snapshot {
  readonly decks: readonly Deck[];
  readonly cards: readonly Card[];
  readonly reviews: readonly Review[];
}

export class InMemoryStore implements RecallStore {
  private readonly decks = new Map<string, Deck>();
  private readonly cards = new Map<string, Card>();
  private readonly reviews: Review[] = [];

  constructor(seed?: Snapshot) {
    for (const deck of seed?.decks ?? []) {
      this.decks.set(deck.id, deck);
    }
    for (const card of seed?.cards ?? []) {
      this.cards.set(card.id, card);
    }
    this.reviews.push(...(seed?.reviews ?? []));
  }

  listDecks(): readonly Deck[] {
    return [...this.decks.values()];
  }

  findDeck(id: string): Deck | undefined {
    return this.decks.get(id);
  }

  findDeckByName(name: string): Deck | undefined {
    const wanted = name.trim().toLowerCase();
    return this.listDecks().find((deck) => deck.name.toLowerCase() === wanted);
  }

  saveDeck(deck: Deck): void {
    this.decks.set(deck.id, deck);
  }

  listCards(deckId?: string): readonly Card[] {
    const all = [...this.cards.values()];
    return deckId === undefined ? all : all.filter((card) => card.deckId === deckId);
  }

  findCard(id: string): Card | undefined {
    return this.cards.get(id);
  }

  saveCard(card: Card): void {
    this.cards.set(card.id, card);
  }

  listReviews(cardId?: string): readonly Review[] {
    if (cardId === undefined) {
      return [...this.reviews];
    }
    return this.reviews.filter((review) => review.cardId === cardId);
  }

  addReview(review: Review): void {
    this.reviews.push(review);
  }

  /** Everything, in a shape that can be written to a file. */
  snapshot(): Snapshot {
    return { decks: this.listDecks(), cards: this.listCards(), reviews: this.listReviews() };
  }
}
