import type { Card, HandRank, HandResult, Rank } from '../../types/game';

// ── Rank ordering ────────────────────────────────────────────────────────────

const RANK_ORDER: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank); // 0–12
}

// Sort cards descending by rank value
function sortDesc(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Group cards by rank → Map<rank value, cards[]> */
function groupByRank(cards: readonly Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of cards) {
    const v = rankValue(card.rank);
    const group = map.get(v) ?? [];
    group.push(card);
    map.set(v, group);
  }
  return map;
}

/** Group cards by suit → Map<suit, cards[]> */
function groupBySuit(cards: readonly Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    const group = map.get(card.suit) ?? [];
    group.push(card);
    map.set(card.suit, group);
  }
  return map;
}

/** Return the 5-card straight starting at `topRankValue` descending, or null. */
function findStraight(cards: readonly Card[]): Card[] | null {
  // Get unique rank values present, descending
  const uniqueValues = [...new Set(cards.map((c) => rankValue(c.rank)))].sort(
    (a, b) => b - a,
  );

  // Include Ace as low (value -1) for A-2-3-4-5 wheel
  const values = uniqueValues[0] === 12 ? [...uniqueValues, -1] : uniqueValues;

  for (let i = 0; i <= values.length - 5; i++) {
    const top = values[i]!;
    const straight: number[] = [top, top - 1, top - 2, top - 3, top - 4];
    if (straight.every((v, idx) => values[i + idx] === v || (v === -1 && uniqueValues.includes(12)))) {
      // Verify the sequence is truly consecutive
      const consecutive = straight.every((v, idx) => values[i + idx] === v);
      if (!consecutive) {
        // Handle wheel: last needed value is -1 (Ace as 1)
        const isWheel =
          top === 3 &&
          straight.every(
            (v) => v === -1 || uniqueValues.includes(v),
          );
        if (!isWheel) continue;
      }
      // Pick one card per rank in the straight
      return straight.map((v) => {
        const realValue = v === -1 ? 12 : v; // Ace
        const byRank = cards.filter((c) => rankValue(c.rank) === realValue);
        return byRank[0]!;
      });
    }
  }
  return null;
}

// ── Hand classification ──────────────────────────────────────────────────────

interface ClassifyResult {
  rank: HandRank;
  rankName: string;
  primaryCards: Card[];  // cards that make the hand (sorted)
  kickers: Card[];       // remaining cards for tiebreaks
}

function classify(sevenCards: readonly Card[]): ClassifyResult {
  const rankGroups = groupByRank(sevenCards);
  const suitGroups = groupBySuit(sevenCards);

  // Sort groups by group size desc, then rank value desc
  const groups = [...rankGroups.entries()]
    .map(([value, cards]) => ({ value, cards }))
    .sort((a, b) => b.cards.length - a.cards.length || b.value - a.value);

  // Check for flush suit (5+ cards of same suit)
  const flushSuit = [...suitGroups.entries()].find(([, c]) => c.length >= 5);
  const flushCards = flushSuit
    ? sortDesc(flushSuit[1]).slice(0, 5)
    : null;

  // Straight flush / royal flush
  if (flushCards) {
    const sf = findStraight(flushSuit![1]);
    if (sf) {
      const topValue = rankValue(sf[0]!.rank);
      // Royal flush: A-K-Q-J-10
      const isRoyal = topValue === 12 && rankValue(sf[4]!.rank) === 8;
      return {
        rank: isRoyal ? 10 : 9,
        rankName: isRoyal ? 'Royal Flush' : 'Straight Flush',
        primaryCards: sf,
        kickers: [],
      };
    }
  }

  // Four of a kind
  if (groups[0] && groups[0].cards.length === 4) {
    const quad = groups[0].cards;
    const kicker = sortDesc(sevenCards.filter((c) => !quad.includes(c))).slice(
      0,
      1,
    );
    return {
      rank: 8,
      rankName: 'Four of a Kind',
      primaryCards: quad,
      kickers: kicker,
    };
  }

  // Full house
  const trips = groups.find((g) => g.cards.length >= 3);
  const pairForFH = groups.find(
    (g) => g.cards.length >= 2 && g !== trips,
  );
  if (trips && pairForFH) {
    return {
      rank: 7,
      rankName: 'Full House',
      primaryCards: [...trips.cards.slice(0, 3), ...pairForFH.cards.slice(0, 2)],
      kickers: [],
    };
  }

  // Flush
  if (flushCards) {
    return {
      rank: 6,
      rankName: 'Flush',
      primaryCards: flushCards,
      kickers: [],
    };
  }

  // Straight
  const straight = findStraight(sevenCards);
  if (straight) {
    return {
      rank: 5,
      rankName: 'Straight',
      primaryCards: straight,
      kickers: [],
    };
  }

  // Three of a kind
  if (trips && !pairForFH) {
    const tripsCards = trips.cards.slice(0, 3);
    const kickers = sortDesc(
      sevenCards.filter((c) => !tripsCards.includes(c)),
    ).slice(0, 2);
    return {
      rank: 4,
      rankName: 'Three of a Kind',
      primaryCards: tripsCards,
      kickers,
    };
  }

  // Two pair
  const pairs = groups.filter((g) => g.cards.length >= 2);
  if (pairs.length >= 2) {
    const topPair = pairs[0]!.cards.slice(0, 2);
    const secondPair = pairs[1]!.cards.slice(0, 2);
    const used = [...topPair, ...secondPair];
    const kicker = sortDesc(sevenCards.filter((c) => !used.includes(c))).slice(
      0,
      1,
    );
    return {
      rank: 3,
      rankName: 'Two Pair',
      primaryCards: used,
      kickers: kicker,
    };
  }

  // One pair
  if (pairs.length === 1) {
    const pair = pairs[0]!.cards.slice(0, 2);
    const kickers = sortDesc(sevenCards.filter((c) => !pair.includes(c))).slice(
      0,
      3,
    );
    return {
      rank: 2,
      rankName: 'One Pair',
      primaryCards: pair,
      kickers,
    };
  }

  // High card
  const sorted = sortDesc(sevenCards);
  return {
    rank: 1,
    rankName: 'High Card',
    primaryCards: sorted.slice(0, 1),
    kickers: sorted.slice(1, 5),
  };
}

// ── Numeric value for comparison ─────────────────────────────────────────────

/**
 * Encode a hand result as a single comparable number.
 * Format (base-13): rank * 13^5 + card values packed in descending priority.
 */
function computeValue(rank: HandRank, primaryCards: Card[], kickers: Card[]): number {
  const allCards = [...primaryCards, ...kickers];
  // Use a value encoding: rank * 14^5 + sum of card values * positional weights
  let value = (rank - 1) * 14 ** 7;
  const allValues = allCards.map((c) => rankValue(c.rank));
  for (let i = 0; i < 7; i++) {
    value += (allValues[i] ?? 0) * 14 ** (6 - i);
  }
  return value;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate the best 5-card hand from up to 7 cards (hole + community).
 */
export function evaluateHand(cards: readonly Card[]): HandResult {
  if (cards.length < 2 || cards.length > 7) {
    throw new RangeError(`evaluateHand requires 2–7 cards, got ${cards.length}`);
  }

  const { rank, rankName, primaryCards, kickers } = classify(cards);
  const value = computeValue(rank, primaryCards, kickers);

  return {
    rank,
    rankName,
    cards: [...primaryCards, ...kickers].slice(0, 5) as readonly Card[],
    kickers,
    value,
  };
}

/**
 * Compare two HandResults.
 * Returns positive if a wins, negative if b wins, 0 for a tie.
 */
export function compareHands(a: HandResult, b: HandResult): number {
  return a.value - b.value;
}

/**
 * Given hole cards and community cards, return the best possible HandResult.
 */
export function getBestHand(
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[],
): HandResult {
  return evaluateHand([...holeCards, ...communityCards]);
}
