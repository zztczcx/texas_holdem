import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, dealCards } from './deck';

describe('deck', () => {
  describe('createDeck', () => {
    it('returns exactly 52 cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it('contains each suit exactly 13 times', () => {
      const deck = createDeck();
      const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
      for (const suit of suits) {
        expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
      }
    });

    it('contains each rank exactly 4 times', () => {
      const deck = createDeck();
      const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;
      for (const rank of ranks) {
        expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
      }
    });

    it('contains no duplicate cards', () => {
      const deck = createDeck();
      const keys = deck.map((c) => `${c.rank}-${c.suit}`);
      const unique = new Set(keys);
      expect(unique.size).toBe(52);
    });
  });

  describe('shuffle', () => {
    it('returns a deck of the same length', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      expect(shuffled).toHaveLength(52);
    });

    it('does not mutate the original deck', () => {
      const deck = createDeck();
      const copy = [...deck];
      shuffle(deck);
      expect(deck).toEqual(copy);
    });

    it('contains the same cards (no cards added or removed)', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      const toKey = (c: { rank: string; suit: string }) => `${c.rank}-${c.suit}`;
      expect(new Set(shuffled.map(toKey))).toEqual(new Set(deck.map(toKey)));
    });

    it('produces deterministic output when given a seeded RNG', () => {
      const deck = createDeck();
      // Simple LCG so we get the same sequence each run
      let seed = 42;
      const seededRng = () => {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        return (seed >>> 0) / 0x100000000;
      };
      let seed2 = 42;
      const seededRng2 = () => {
        seed2 = (seed2 * 1664525 + 1013904223) & 0xffffffff;
        return (seed2 >>> 0) / 0x100000000;
      };
      expect(shuffle(deck, seededRng)).toEqual(shuffle(deck, seededRng2));
    });

    it('produces a different order than the original (with real RNG — probabilistic)', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      // Probability of exact same order is 1/52! — effectively zero
      const same = shuffled.every((c, i) => c.rank === deck[i]!.rank && c.suit === deck[i]!.suit);
      expect(same).toBe(false);
    });
  });

  describe('dealCards', () => {
    it('deals the correct number of cards', () => {
      const deck = createDeck();
      const [dealt] = dealCards(deck, 2);
      expect(dealt).toHaveLength(2);
    });

    it('returns the correct remaining deck length', () => {
      const deck = createDeck();
      const [, remaining] = dealCards(deck, 5);
      expect(remaining).toHaveLength(47);
    });

    it('dealt cards come from the top of the deck', () => {
      const deck = createDeck();
      const [dealt] = dealCards(deck, 3);
      expect(dealt).toEqual(deck.slice(0, 3));
    });

    it('does not mutate the source deck', () => {
      const deck = createDeck();
      const copy = [...deck];
      dealCards(deck, 5);
      expect(deck).toEqual(copy);
    });

    it('deals the full deck when n === deck.length', () => {
      const deck = createDeck();
      const [dealt, remaining] = dealCards(deck, 52);
      expect(dealt).toHaveLength(52);
      expect(remaining).toHaveLength(0);
    });

    it('deals 0 cards (no-op)', () => {
      const deck = createDeck();
      const [dealt, remaining] = dealCards(deck, 0);
      expect(dealt).toHaveLength(0);
      expect(remaining).toEqual(deck);
    });

    it('throws when n > deck length', () => {
      const deck = createDeck();
      expect(() => dealCards(deck, 53)).toThrow(RangeError);
    });

    it('throws when n is negative', () => {
      const deck = createDeck();
      expect(() => dealCards(deck, -1)).toThrow(RangeError);
    });
  });
});
