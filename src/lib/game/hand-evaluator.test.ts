import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands, getBestHand } from './hand-evaluator';
import type { Card } from '../../types/game';

// ── helpers ──────────────────────────────────────────────────────────────────

function c(rank: string, suit: string): Card {
  return { rank, suit } as Card;
}

const A = (s: string) => c('A', s);
const K = (s: string) => c('K', s);
const Q = (s: string) => c('Q', s);
const J = (s: string) => c('J', s);
const T = (s: string) => c('10', s);
const n = (r: number, s: string) => c(String(r), s);

// ── evaluateHand ─────────────────────────────────────────────────────────────

describe('evaluateHand', () => {
  it('throws for < 2 cards', () => {
    expect(() => evaluateHand([c('A', 'spades')])).toThrow(RangeError);
  });

  it('throws for > 7 cards', () => {
    const cards = Array.from({ length: 8 }, () => c('A', 'spades'));
    expect(() => evaluateHand(cards)).toThrow(RangeError);
  });

  describe('Royal Flush (rank 10)', () => {
    it('identifies A-K-Q-J-10 of same suit', () => {
      const result = evaluateHand([
        A('spades'), K('spades'), Q('spades'), J('spades'), T('spades'),
        n(2, 'hearts'), n(3, 'hearts'),
      ]);
      expect(result.rank).toBe(10);
      expect(result.rankName).toBe('Royal Flush');
    });
  });

  describe('Straight Flush (rank 9)', () => {
    it('identifies 9-high straight flush', () => {
      const result = evaluateHand([
        n(9, 'clubs'), n(8, 'clubs'), n(7, 'clubs'), n(6, 'clubs'), n(5, 'clubs'),
        A('hearts'), K('spades'),
      ]);
      expect(result.rank).toBe(9);
      expect(result.rankName).toBe('Straight Flush');
    });

    it('identifies A-2-3-4-5 wheel straight flush', () => {
      const result = evaluateHand([
        A('hearts'), n(2, 'hearts'), n(3, 'hearts'), n(4, 'hearts'), n(5, 'hearts'),
        K('spades'), Q('clubs'),
      ]);
      expect(result.rank).toBe(9);
    });
  });

  describe('Four of a Kind (rank 8)', () => {
    it('identifies four aces', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), A('diamonds'), A('clubs'),
        K('spades'), Q('hearts'), J('clubs'),
      ]);
      expect(result.rank).toBe(8);
      expect(result.rankName).toBe('Four of a Kind');
    });
  });

  describe('Full House (rank 7)', () => {
    it('identifies A-A-A-K-K', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), A('diamonds'),
        K('clubs'), K('spades'),
        n(2, 'hearts'), n(3, 'clubs'),
      ]);
      expect(result.rank).toBe(7);
      expect(result.rankName).toBe('Full House');
    });

    it('picks best full house from 2 trips', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), A('diamonds'),
        K('clubs'), K('spades'), K('hearts'),
        n(2, 'hearts'),
      ]);
      expect(result.rank).toBe(7);
      // Best full house is A-A-A-K-K
      const cardRanks = result.cards.map((c) => c.rank);
      expect(cardRanks.filter((r) => r === 'A')).toHaveLength(3);
    });
  });

  describe('Flush (rank 6)', () => {
    it('identifies five hearts', () => {
      const result = evaluateHand([
        A('hearts'), T('hearts'), n(8, 'hearts'), n(6, 'hearts'), n(4, 'hearts'),
        K('spades'), Q('clubs'),
      ]);
      expect(result.rank).toBe(6);
      expect(result.rankName).toBe('Flush');
    });

    it('picks best 5 cards for flush with 6 suited cards', () => {
      const result = evaluateHand([
        A('hearts'), K('hearts'), Q('hearts'), J('hearts'), T('hearts'), n(2, 'hearts'),
        n(3, 'clubs'),
      ]);
      expect(result.rank).toBe(10); // A-K-Q-J-10 of hearts = Royal Flush
    });
  });

  describe('Straight (rank 5)', () => {
    it('identifies A-K-Q-J-10 straight (non-flush)', () => {
      const result = evaluateHand([
        A('spades'), K('hearts'), Q('diamonds'), J('clubs'), T('spades'),
        n(2, 'hearts'), n(3, 'clubs'),
      ]);
      expect(result.rank).toBe(5);
      expect(result.rankName).toBe('Straight');
    });

    it('identifies A-2-3-4-5 wheel straight', () => {
      const result = evaluateHand([
        A('spades'), n(2, 'hearts'), n(3, 'diamonds'), n(4, 'clubs'), n(5, 'spades'),
        K('hearts'), Q('clubs'),
      ]);
      expect(result.rank).toBe(5);
      expect(result.rankName).toBe('Straight');
    });

    it('wheel straight loses to 6-high straight', () => {
      const wheel = evaluateHand([
        A('spades'), n(2, 'hearts'), n(3, 'diamonds'), n(4, 'clubs'), n(5, 'spades'),
        n(8, 'hearts'), n(9, 'clubs'),
      ]);
      const sixHigh = evaluateHand([
        n(6, 'spades'), n(2, 'hearts'), n(3, 'diamonds'), n(4, 'clubs'), n(5, 'spades'),
        n(8, 'hearts'), n(9, 'clubs'),
      ]);
      expect(compareHands(sixHigh, wheel)).toBeGreaterThan(0);
    });
  });

  describe('Three of a Kind (rank 4)', () => {
    it('identifies three aces', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), A('diamonds'),
        K('clubs'), Q('spades'), J('hearts'), n(2, 'clubs'),
      ]);
      expect(result.rank).toBe(4);
      expect(result.rankName).toBe('Three of a Kind');
    });
  });

  describe('Two Pair (rank 3)', () => {
    it('identifies two pair', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), K('diamonds'), K('clubs'),
        Q('spades'), J('hearts'), n(2, 'clubs'),
      ]);
      expect(result.rank).toBe(3);
      expect(result.rankName).toBe('Two Pair');
    });

    it('picks best two pair from 3 pairs', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), K('diamonds'), K('clubs'),
        Q('spades'), Q('hearts'), n(2, 'clubs'),
      ]);
      expect(result.rank).toBe(3);
      const cardRanks = result.cards.map((c) => c.rank);
      expect(cardRanks.filter((r) => r === 'A')).toHaveLength(2);
      expect(cardRanks.filter((r) => r === 'K')).toHaveLength(2);
    });
  });

  describe('One Pair (rank 2)', () => {
    it('identifies one pair of aces', () => {
      const result = evaluateHand([
        A('spades'), A('hearts'), K('diamonds'), Q('clubs'),
        J('spades'), n(9, 'hearts'), n(2, 'clubs'),
      ]);
      expect(result.rank).toBe(2);
      expect(result.rankName).toBe('One Pair');
    });
  });

  describe('High Card (rank 1)', () => {
    it('identifies high card hand', () => {
      const result = evaluateHand([
        A('spades'), K('hearts'), Q('diamonds'), J('clubs'),
        n(9, 'spades'), n(7, 'hearts'), n(2, 'clubs'),
      ]);
      expect(result.rank).toBe(1);
      expect(result.rankName).toBe('High Card');
    });
  });
});

// ── compareHands ─────────────────────────────────────────────────────────────

describe('compareHands', () => {
  it('higher rank beats lower rank', () => {
    const flush = evaluateHand([
      A('hearts'), T('hearts'), n(8, 'hearts'), n(6, 'hearts'), n(4, 'hearts'),
      K('spades'), Q('clubs'),
    ]);
    const straight = evaluateHand([
      A('spades'), K('hearts'), Q('diamonds'), J('clubs'), T('spades'),
      n(2, 'hearts'), n(3, 'clubs'),
    ]);
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });

  it('same rank: higher card wins (AA vs KK)', () => {
    const aaPair = evaluateHand([
      A('spades'), A('hearts'), K('diamonds'), Q('clubs'), J('spades'),
      n(9, 'hearts'), n(2, 'clubs'),
    ]);
    const kkPair = evaluateHand([
      K('spades'), K('hearts'), A('diamonds'), Q('clubs'), J('spades'),
      n(9, 'hearts'), n(2, 'clubs'),
    ]);
    expect(compareHands(aaPair, kkPair)).toBeGreaterThan(0);
  });

  it('kicker breaks pairing tie', () => {
    const pairAK = evaluateHand([
      A('spades'), A('hearts'), K('diamonds'), n(3, 'clubs'), n(2, 'spades'),
      n(7, 'hearts'), n(5, 'clubs'),
    ]);
    const pairAQ = evaluateHand([
      A('spades'), A('hearts'), Q('diamonds'), n(3, 'clubs'), n(2, 'spades'),
      n(7, 'hearts'), n(5, 'clubs'),
    ]);
    expect(compareHands(pairAK, pairAQ)).toBeGreaterThan(0);
  });

  it('identical hands return 0 (split pot)', () => {
    const hand1 = evaluateHand([
      A('spades'), K('hearts'), Q('diamonds'), J('clubs'), T('spades'),
      n(2, 'hearts'), n(3, 'clubs'),
    ]);
    const hand2 = evaluateHand([
      A('hearts'), K('diamonds'), Q('clubs'), J('spades'), T('hearts'),
      n(5, 'spades'), n(8, 'clubs'),
    ]);
    // Both are A-high straights, should tie
    expect(compareHands(hand1, hand2)).toBe(0);
  });

  it('rank ordering: 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 > 1', () => {
    const royalFlush = evaluateHand([A('s'), K('s'), Q('s'), J('s'), T('s'), n(2, 'h'), n(3, 'h')]);
    const straightFlush = evaluateHand([n(9, 's'), n(8, 's'), n(7, 's'), n(6, 's'), n(5, 's'), A('h'), n(2, 'h')]);
    const quads = evaluateHand([A('s'), A('h'), A('d'), A('c'), K('s'), Q('h'), J('c')]);
    const fullHouse = evaluateHand([A('s'), A('h'), A('d'), K('c'), K('s'), Q('h'), J('c')]);
    const flush = evaluateHand([A('h'), T('h'), n(8, 'h'), n(6, 'h'), n(4, 'h'), K('s'), Q('c')]);
    const straight = evaluateHand([A('s'), K('h'), Q('d'), J('c'), T('s'), n(2, 'h'), n(3, 'c')]);
    const trips = evaluateHand([A('s'), A('h'), A('d'), K('c'), Q('s'), J('h'), n(2, 'c')]);
    const twoPair = evaluateHand([A('s'), A('h'), K('d'), K('c'), Q('s'), J('h'), n(2, 'c')]);
    const onePair = evaluateHand([A('s'), A('h'), K('d'), Q('c'), J('s'), n(9, 'h'), n(2, 'c')]);
    const highCard = evaluateHand([A('s'), K('h'), Q('d'), J('c'), n(9, 's'), n(7, 'h'), n(2, 'c')]);

    const ordered = [royalFlush, straightFlush, quads, fullHouse, flush, straight, trips, twoPair, onePair, highCard];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(compareHands(ordered[i]!, ordered[i + 1]!)).toBeGreaterThan(0);
    }
  });
});

// ── getBestHand ───────────────────────────────────────────────────────────────

describe('getBestHand', () => {
  it('finds best hand from hole + community cards', () => {
    const holeCards: [Card, Card] = [A('spades'), A('hearts')];
    const community = [A('diamonds'), A('clubs'), K('spades'), Q('hearts'), J('clubs')];
    const result = getBestHand(holeCards, community);
    expect(result.rank).toBe(8); // Four of a Kind
  });

  it('uses community cards when they are better', () => {
    const holeCards: [Card, Card] = [n(2, 'spades'), n(3, 'hearts')];
    const community = [A('diamonds'), K('clubs'), Q('spades'), J('hearts'), T('clubs')];
    const result = getBestHand(holeCards, community);
    expect(result.rank).toBe(5); // A-K-Q-J-10 Straight
  });
});
