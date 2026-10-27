import { describe, expect, it } from 'vitest';
import { toGrade } from '../src/decks/DeckService.js';
import { parseMarkdown } from '../src/decks/markdown.js';
import { deckStats } from '../src/decks/stats.js';
import { DomainError, ErrorCodes } from '../src/domain/errors.js';
import type { Review } from '../src/domain/types.js';
import { card, makeService, state, TODAY } from './helpers.js';

describe('createDeck / decks / deck', () => {
  it('creates a deck dated today and lists decks by name', () => {
    const { service } = makeService();
    const deck = service.createDeck('Spanish verbs');
    expect(deck).toEqual({ id: 'id1', name: 'Spanish verbs', createdOn: TODAY });
    expect(service.decks().map((d) => d.name)).toEqual(['Anatomy 101', 'Spanish verbs']);
  });

  it('refuses a duplicate or empty name', () => {
    const { service } = makeService();
    expect(() => service.createDeck('anatomy 101')).toThrow(/already exists/);
    expect(() => service.createDeck('   ')).toThrow(DomainError);
  });

  it('finds a deck by id or by name, case-insensitively', () => {
    const { service } = makeService();
    expect(service.deck('d1').name).toBe('Anatomy 101');
    expect(service.deck('ANATOMY 101').id).toBe('d1');
    expect(() => service.deck('Chemistry')).toThrow(/No deck/);
  });
});

describe('addCard / cards', () => {
  it('adds a new card due today', () => {
    const { service } = makeService();
    const added = service.addCard('d1', ' What is the aorta? ', 'The largest artery', ['heart']);
    expect(added.front).toBe('What is the aorta?');
    expect(added.state).toEqual({ intervalDays: 0, easeFactor: 2.5, repetitions: 0, due: TODAY, lapses: 0 });
    expect(service.cards('d1')).toHaveLength(1);
  });

  it('refuses a front that already exists in the deck', () => {
    const { service } = makeService({ cards: [card('c1', { front: 'Femur?' })] });
    expect(() => service.addCard('d1', 'femur?', 'x')).toThrow(/already in/);
  });

  it('filters by tag and by due date', () => {
    const { service } = makeService({
      cards: [
        card('c1', { tags: ['heart'], state: state({ due: '2026-11-10' }) }),
        card('c2', { tags: ['heart', 'valves'], state: state({ due: '2026-12-01' }) }),
        card('c3', { tags: ['bone'], state: state({ due: TODAY }) }),
      ],
    });
    expect(service.cards('d1', { tag: 'heart' }).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(service.cards('d1', { dueOn: TODAY }).map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(service.cards('d1', { tag: 'heart', dueOn: TODAY }).map((c) => c.id)).toEqual(['c1']);
  });
});

describe('importMarkdown (R8)', () => {
  const text = ['#heart #valves', 'Q: Mitral valve?', 'A: Left side', 'Q: Femur?', 'A: Thigh bone', ''].join('\n');

  it('creates one card per pair and applies the tag line to the next card only', () => {
    const { service } = makeService();
    const result = service.importMarkdown('d1', text);
    expect(result.added.map((c) => c.front)).toEqual(['Mitral valve?', 'Femur?']);
    expect(result.added[0]?.tags).toEqual(['heart', 'valves']);
    expect(result.added[1]?.tags).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('skips and reports duplicates of existing fronts', () => {
    const { service } = makeService({ cards: [card('c1', { front: 'femur?' })] });
    const result = service.importMarkdown('d1', text);
    expect(result.added.map((c) => c.front)).toEqual(['Mitral valve?']);
    expect(result.skipped).toEqual(['Femur?']);
  });
});

describe('parseMarkdown', () => {
  it('rejects an answer without a question and a question without an answer', () => {
    expect(() => parseMarkdown('A: orphan\n')).toThrow(/line 1/);
    expect(() => parseMarkdown('Q: lonely')).toThrow(/end of file/);
  });

  it('rejects two questions in a row, naming the line', () => {
    try {
      parseMarkdown('Q: one\nQ: two\nA: x\n');
      expect.fail('should have thrown');
    } catch (error) {
      expect((error as DomainError).code).toBe(ErrorCodes.IMPORT_SYNTAX);
      expect((error as DomainError).message).toMatch(/line 2/);
    }
  });

  it('rejects an empty question or answer', () => {
    expect(() => parseMarkdown('Q: \nA: x\n')).toThrow(/question/);
    expect(() => parseMarkdown('Q: x\nA: \n')).toThrow(/answer/);
  });
});

describe('toGrade', () => {
  it('accepts 0-5 and rejects everything else', () => {
    expect(toGrade(0)).toBe(0);
    expect(toGrade(5)).toBe(5);
    expect(() => toGrade(6)).toThrow(/Grade/);
    expect(() => toGrade(2.5)).toThrow(DomainError);
    expect(() => toGrade(Number.NaN)).toThrow(DomainError);
  });
});

describe('stats (R9)', () => {
  const cards = [
    card('c1', { state: state({ repetitions: 0, due: TODAY }) }),
    card('c2', { state: state({ repetitions: 2, intervalDays: 6, due: '2026-11-20' }) }),
    card('c3', { state: state({ repetitions: 5, intervalDays: 40, due: '2026-11-01' }) }),
    card('c4', { state: state({ repetitions: 0, intervalDays: 1, lapses: 8, due: '2026-11-10' }) }),
  ];
  const review = (id: string, cardId: string, reviewedOn: string): Review => ({
    id,
    cardId,
    reviewedOn,
    grade: 4,
    intervalBefore: 1,
    intervalAfter: 6,
  });
  const reviews = [
    review('r1', 'c2', '2026-11-16'),
    review('r2', 'c3', '2026-11-11'),
    review('r3', 'c3', '2026-11-10'),
    review('r4', 'other', '2026-11-17'),
  ];

  it('counts each bucket', () => {
    expect(deckStats(cards, reviews, TODAY)).toEqual({
      total: 4,
      dueToday: 3,
      newCards: 2,
      learning: 1,
      mature: 1,
      leeches: 1,
      reviewsLast7Days: 2,
    });
  });

  it('is reachable through the service for one deck', () => {
    const { service } = makeService({ cards, reviews });
    expect(service.stats('Anatomy 101').total).toBe(4);
    expect(service.reviewsOf('c3')).toHaveLength(2);
  });
});
