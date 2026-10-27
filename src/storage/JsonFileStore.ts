// The JSON-file repository: one file per student, read once on start-up
// and rewritten after every change. The files are small, so rewriting the
// whole thing is simpler than anything cleverer.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DomainError, ErrorCodes } from '../domain/errors.js';
import type { Card, Deck, Review } from '../domain/types.js';
import { InMemoryStore, type Snapshot } from './InMemoryStore.js';

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const shape = value as Record<string, unknown>;
  return Array.isArray(shape.decks) && Array.isArray(shape.cards) && Array.isArray(shape.reviews);
}

export function readSnapshot(path: string): Snapshot {
  if (!existsSync(path)) {
    return { decks: [], cards: [], reviews: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new DomainError(ErrorCodes.BAD_DATA_FILE, `${path} is not valid JSON`);
  }
  if (!isSnapshot(parsed)) {
    throw new DomainError(ErrorCodes.BAD_DATA_FILE, `${path} does not look like a Recall file`);
  }
  return parsed;
}

/** Reads like the in-memory store; every write also rewrites the file. */
export class JsonFileStore extends InMemoryStore {
  constructor(private readonly path: string) {
    super(readSnapshot(path));
  }

  override saveDeck(deck: Deck): void {
    super.saveDeck(deck);
    this.flush();
  }

  override saveCard(card: Card): void {
    super.saveCard(card);
    this.flush();
  }

  override addReview(review: Review): void {
    super.addReview(review);
    this.flush();
  }

  private flush(): void {
    writeFileSync(this.path, `${JSON.stringify(this.snapshot(), null, 2)}\n`, 'utf8');
  }
}
