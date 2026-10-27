// Shared fixtures: a deterministic service over an in-memory store.

import { DeckService } from '../src/decks/DeckService.js';
import type { Card, CardState } from '../src/domain/types.js';
import { InMemoryStore, type Snapshot } from '../src/storage/InMemoryStore.js';

export const TODAY = '2026-11-17';

export function fixedClock(day = TODAY): () => Date {
  return () => new Date(`${day}T09:00`);
}

export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function state(overrides: Partial<CardState> = {}): CardState {
  return { intervalDays: 0, easeFactor: 2.5, repetitions: 0, due: TODAY, lapses: 0, ...overrides };
}

export function card(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    deckId: 'd1',
    front: `front ${id}`,
    back: `back ${id}`,
    tags: [],
    state: state(),
    ...overrides,
  };
}

export function makeService(seed: Partial<Snapshot> = {}, today = TODAY): { service: DeckService; store: InMemoryStore } {
  const store = new InMemoryStore({
    decks: seed.decks ?? [{ id: 'd1', name: 'Anatomy 101', createdOn: '2026-10-01' }],
    cards: seed.cards ?? [],
    reviews: seed.reviews ?? [],
  });
  const service = new DeckService({ store, ids: sequentialIds(), clock: fixedClock(today) });
  return { service, store };
}
