// The one service. Every operation goes through here; storage and the
// scheduler are details it delegates to.

import { type Clock, assertIsoDay, compareDays, todayFrom } from '../dates/days.js';
import { DomainError, ErrorCodes } from '../domain/errors.js';
import { DEFAULT_SESSION_LIMIT, GRADES } from '../domain/types.js';
import type { Card, CardFilter, Deck, DeckStats, Grade, ImportResult, Review, Session } from '../domain/types.js';
import { isLeech, newCardState, schedule } from '../scheduler/sm2.js';
import { parseMarkdown } from './markdown.js';
import type { IdGenerator, RecallStore } from './ports.js';
import { deckStats } from './stats.js';

export interface DeckServiceDeps {
  readonly store: RecallStore;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export function toGrade(value: number): Grade {
  const grade = GRADES.find((g) => g === value);
  if (grade === undefined) {
    throw new DomainError(ErrorCodes.INVALID_GRADE, `Grade must be a whole number 0-5, got ${value}`);
  }
  return grade;
}

function normaliseFront(front: string): string {
  return front.trim().toLowerCase();
}

export class DeckService {
  private readonly store: RecallStore;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: DeckServiceDeps) {
    this.store = deps.store;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  today(): string {
    return todayFrom(this.clock);
  }

  decks(): readonly Deck[] {
    return [...this.store.listDecks()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Looks a deck up by id or, failing that, by name (case-insensitive). */
  deck(idOrName: string): Deck {
    const deck = this.store.findDeck(idOrName) ?? this.store.findDeckByName(idOrName);
    if (deck === undefined) {
      throw new DomainError(ErrorCodes.DECK_NOT_FOUND, `No deck called "${idOrName}"`);
    }
    return deck;
  }

  card(id: string): Card {
    const card = this.store.findCard(id);
    if (card === undefined) {
      throw new DomainError(ErrorCodes.CARD_NOT_FOUND, `No card with id ${id}`);
    }
    return card;
  }

  createDeck(name: string): Deck {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new DomainError(ErrorCodes.DECK_EXISTS, 'A deck needs a name');
    }
    if (this.store.findDeckByName(trimmed) !== undefined) {
      throw new DomainError(ErrorCodes.DECK_EXISTS, `A deck called "${trimmed}" already exists`);
    }
    const deck: Deck = { id: this.ids(), name: trimmed, createdOn: this.today() };
    this.store.saveDeck(deck);
    return deck;
  }

  addCard(deckIdOrName: string, front: string, back: string, tags: readonly string[] = []): Card {
    const deck = this.deck(deckIdOrName);
    if (this.findByFront(deck.id, front) !== undefined) {
      throw new DomainError(ErrorCodes.CARD_EXISTS, `"${front}" is already in ${deck.name}`);
    }
    const card: Card = {
      id: this.ids(),
      deckId: deck.id,
      front: front.trim(),
      back: back.trim(),
      tags: [...tags],
      state: newCardState(this.today()),
    };
    this.store.saveCard(card);
    return card;
  }

  /** R8: every well-formed pair becomes a card; repeats of an existing front are skipped. */
  importMarkdown(deckIdOrName: string, text: string): ImportResult {
    const deck = this.deck(deckIdOrName);
    const added: Card[] = [];
    const skipped: string[] = [];
    for (const parsed of parseMarkdown(text)) {
      if (this.findByFront(deck.id, parsed.front) !== undefined) {
        skipped.push(parsed.front);
      } else {
        added.push(this.addCard(deck.id, parsed.front, parsed.back, parsed.tags));
      }
    }
    return { added, skipped };
  }

  cards(deckIdOrName: string, filter: CardFilter = {}): readonly Card[] {
    const deck = this.deck(deckIdOrName);
    return this.store
      .listCards(deck.id)
      .filter((card) => filter.tag === undefined || card.tags.includes(filter.tag))
      .filter((card) => filter.dueOn === undefined || compareDays(card.state.due, filter.dueOn) <= 0);
  }

  /** R2 and R6: the deck's due, non-leech cards, oldest due first, capped. */
  session(deckIdOrName: string, today = this.today(), limit = DEFAULT_SESSION_LIMIT): Session {
    const deck = this.deck(deckIdOrName);
    assertIsoDay(today);
    const cardIds = this.store
      .listCards(deck.id)
      .filter((card) => !isLeech(card.state))
      .filter((card) => compareDays(card.state.due, today) <= 0)
      .sort((a, b) => compareDays(a.state.due, b.state.due) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((card) => card.id);
    return { date: today, cardIds, answered: 0 };
  }

  /** R3-R5: reschedules the card and records the review. */
  answer(cardId: string, grade: Grade, today = this.today()): Review {
    const card = this.card(cardId);
    assertIsoDay(today);
    const state = schedule(card.state, grade, today);
    const review: Review = {
      id: this.ids(), cardId: card.id, reviewedOn: today, grade,
      intervalBefore: card.state.intervalDays, intervalAfter: state.intervalDays,
    };
    this.store.saveCard({ ...card, state });
    this.store.addReview(review);
    return review;
  }

  /** R6: a reset leech starts over as a new card, keeping its history. */
  resetLeech(cardId: string, today = this.today()): Card {
    const card = this.card(cardId);
    if (!isLeech(card.state)) {
      throw new DomainError(ErrorCodes.NOT_A_LEECH, `${card.id} is not a leech (${card.state.lapses} lapses)`);
    }
    const reset: Card = { ...card, state: newCardState(today) };
    this.store.saveCard(reset);
    return reset;
  }

  stats(deckIdOrName: string, today = this.today()): DeckStats {
    const deck = this.deck(deckIdOrName);
    return deckStats(this.store.listCards(deck.id), this.store.listReviews(), today);
  }

  reviewsOf(cardId: string): readonly Review[] {
    return this.store.listReviews(this.card(cardId).id);
  }

  private findByFront(deckId: string, front: string): Card | undefined {
    const wanted = normaliseFront(front);
    return this.store.listCards(deckId).find((card) => normaliseFront(card.front) === wanted);
  }
}
