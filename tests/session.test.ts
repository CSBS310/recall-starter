import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCodes } from '../src/domain/errors.js';
import { card, makeService, state, TODAY } from './helpers.js';

describe('session (R2, R6)', () => {
  it('offers overdue cards, oldest due first', () => {
    const { service } = makeService({
      cards: [
        card('c1', { state: state({ due: '2026-11-10' }) }),
        card('c2', { state: state({ due: '2026-11-01' }) }),
        card('c3', { state: state({ due: '2026-11-05' }) }),
      ],
    });
    expect(service.session('d1').cardIds).toEqual(['c2', 'c3', 'c1']);
  });

  it('offers overdue and due-today cards, oldest due first', () => {
    const { service } = makeService({
      cards: [
        card('c1', { state: state({ due: TODAY }) }),
        card('c2', { state: state({ due: '2026-11-16' }) }),
        card('c3', { state: state({ due: '2026-11-18' }) }),
      ],
    });
    expect(service.session('d1', TODAY).cardIds).toEqual(['c2', 'c1']);
  });

  it('caps the session at the limit', () => {
    const cards = Array.from({ length: 25 }, (_, i) =>
      card(`c${String(i).padStart(2, '0')}`, { state: state({ due: '2026-11-01' }) }),
    );
    const { service } = makeService({ cards });
    expect(service.session('d1').cardIds).toHaveLength(20);
    expect(service.session('d1', TODAY, 3).cardIds).toEqual(['c00', 'c01', 'c02']);
  });

  it('leaves leeches out', () => {
    const { service } = makeService({
      cards: [
        card('c1', { state: state({ due: '2026-11-01', lapses: 8 }) }),
        card('c2', { state: state({ due: '2026-11-01', lapses: 7 }) }),
      ],
    });
    expect(service.session('d1').cardIds).toEqual(['c2']);
  });

  it('only includes cards from the requested deck', () => {
    const { service } = makeService({
      decks: [
        { id: 'd1', name: 'Anatomy 101', createdOn: '2026-10-01' },
        { id: 'd2', name: 'Spanish verbs', createdOn: '2026-10-12' },
      ],
      cards: [
        card('c1', { state: state({ due: '2026-11-01' }) }),
        card('c2', { deckId: 'd2', state: state({ due: '2026-11-01' }) }),
      ],
    });
    expect(service.session('Spanish verbs').cardIds).toEqual(['c2']);
  });

  it('rejects an unknown deck and a malformed today', () => {
    const { service } = makeService({ cards: [card('c1')] });
    expect(() => service.session('Chemistry')).toThrow(DomainError);
    try {
      service.session('d1', '17-11-2026');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(ErrorCodes.INVALID_DATE);
    }
  });
});

describe('answer (R3-R5)', () => {
  it('records a review and reschedules the card', () => {
    const { service, store } = makeService({ cards: [card('c1')] });
    const review = service.answer('c1', 4);
    expect(review).toMatchObject({ cardId: 'c1', reviewedOn: TODAY, grade: 4, intervalBefore: 0, intervalAfter: 1 });
    expect(store.findCard('c1')?.state.repetitions).toBe(1);
    expect(store.listReviews('c1')).toHaveLength(1);
  });

  it('a lapse increments lapses and resets the streak', () => {
    const { service, store } = makeService({
      cards: [card('c1', { state: state({ repetitions: 3, intervalDays: 15, lapses: 0 }) })],
    });
    service.answer('c1', 1);
    expect(store.findCard('c1')?.state).toMatchObject({ repetitions: 0, intervalDays: 1, lapses: 1 });
  });

  it('rejects an unknown card', () => {
    const { service } = makeService();
    expect(() => service.answer('nope', 4)).toThrow(/No card/);
  });
});

describe('resetLeech (R6)', () => {
  it('turns a leech back into a new card', () => {
    const { service } = makeService({
      cards: [card('c1', { state: state({ lapses: 9, intervalDays: 1, easeFactor: 1.3, due: '2026-11-10' }) })],
    });
    const reset = service.resetLeech('c1');
    expect(reset.state).toEqual({ intervalDays: 0, easeFactor: 2.5, repetitions: 0, due: TODAY, lapses: 0 });
    expect(service.session('d1', '2026-11-18').cardIds).toEqual(['c1']);
  });

  it('refuses to reset a card that is not a leech', () => {
    const { service } = makeService({ cards: [card('c1', { state: state({ lapses: 2 }) })] });
    expect(() => service.resetLeech('c1')).toThrow(/not a leech/);
  });
});
