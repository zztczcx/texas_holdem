import type { Card, Rank, Suit } from '../../types/game';

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Return a full, ordered 52-card deck.
 */
export function createDeck(): readonly Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Accepts an RNG function for deterministic tests.
 * @param deck   Source deck (not mutated)
 * @param rng    Random number generator returning a value in [0, 1)
 */
export function shuffle(deck: readonly Card[], rng: () => number = Math.random): readonly Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Deal `n` cards from the top of the deck.
 * Returns [dealtCards, remainingDeck] — never mutates the input.
 */
export function dealCards(
  deck: readonly Card[],
  n: number,
): [readonly Card[], readonly Card[]] {
  if (n < 0) {
    throw new RangeError(`Cannot deal a negative number of cards: ${n}`);
  }
  if (n > deck.length) {
    throw new RangeError(
      `Cannot deal ${n} cards from a deck of ${deck.length}`,
    );
  }
  return [deck.slice(0, n), deck.slice(n)];
}
