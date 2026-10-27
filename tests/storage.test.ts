import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DomainError, ErrorCodes } from '../src/domain/errors.js';
import { InMemoryStore } from '../src/storage/InMemoryStore.js';
import { JsonFileStore, readSnapshot } from '../src/storage/JsonFileStore.js';
import { card } from './helpers.js';

const deck = { id: 'd1', name: 'Anatomy 101', createdOn: '2026-10-01' };

describe('InMemoryStore', () => {
  it('saves and finds decks and cards', () => {
    const store = new InMemoryStore();
    store.saveDeck(deck);
    store.saveCard(card('c1'));
    expect(store.findDeck('d1')).toEqual(deck);
    expect(store.findDeckByName(' anatomy 101 ')).toEqual(deck);
    expect(store.findCard('c1')?.front).toBe('front c1');
    expect(store.findCard('missing')).toBeUndefined();
  });

  it('replaces a card saved with the same id', () => {
    const store = new InMemoryStore({ decks: [deck], cards: [card('c1')], reviews: [] });
    store.saveCard(card('c1', { front: 'changed' }));
    expect(store.listCards()).toHaveLength(1);
    expect(store.findCard('c1')?.front).toBe('changed');
  });

  it('lists cards by deck and reviews by card', () => {
    const store = new InMemoryStore({
      decks: [deck],
      cards: [card('c1'), card('c2', { deckId: 'd2' })],
      reviews: [
        { id: 'r1', cardId: 'c1', reviewedOn: '2026-11-10', grade: 4, intervalBefore: 0, intervalAfter: 1 },
        { id: 'r2', cardId: 'c2', reviewedOn: '2026-11-10', grade: 2, intervalBefore: 6, intervalAfter: 1 },
      ],
    });
    expect(store.listCards('d1').map((c) => c.id)).toEqual(['c1']);
    expect(store.listReviews('c2').map((r) => r.id)).toEqual(['r2']);
    expect(store.listReviews()).toHaveLength(2);
  });
});

describe('JsonFileStore', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'recall-'));
    path = join(dir, 'student.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts empty when the file does not exist and writes it on first save', () => {
    const store = new JsonFileStore(path);
    expect(store.listDecks()).toEqual([]);
    store.saveDeck(deck);
    expect(JSON.parse(readFileSync(path, 'utf8')).decks).toEqual([deck]);
  });

  it('round-trips cards and reviews through the file', () => {
    const first = new JsonFileStore(path);
    first.saveDeck(deck);
    first.saveCard(card('c1', { tags: ['heart'] }));
    first.addReview({ id: 'r1', cardId: 'c1', reviewedOn: '2026-11-10', grade: 4, intervalBefore: 0, intervalAfter: 1 });

    const second = new JsonFileStore(path);
    expect(second.findDeck('d1')).toEqual(deck);
    expect(second.findDeckByName('Anatomy 101')).toEqual(deck);
    expect(second.findCard('c1')?.tags).toEqual(['heart']);
    expect(second.listCards('d1')).toHaveLength(1);
    expect(second.listReviews('c1')).toHaveLength(1);
  });

  it('rejects a file that is not JSON or has the wrong shape', () => {
    writeFileSync(path, '{not json');
    expect(() => new JsonFileStore(path)).toThrow(DomainError);
    writeFileSync(path, JSON.stringify({ decks: [] }));
    try {
      readSnapshot(path);
      expect.fail('should have thrown');
    } catch (error) {
      expect((error as DomainError).code).toBe(ErrorCodes.BAD_DATA_FILE);
    }
  });

  it('reads the shipped sample data', () => {
    const snapshot = readSnapshot('data/sample.json');
    expect(snapshot.decks.map((d) => d.name)).toEqual(['Anatomy 101', 'Spanish verbs']);
    expect(snapshot.cards).toHaveLength(36);
  });
});
