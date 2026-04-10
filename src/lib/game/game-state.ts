import type {
  GameSettings,
  GameStage,
  GameState,
  HandEndResult,
  Player,
  PlayerAction,
  PlayerHand,
  SidePot,
  WinnerResult,
} from '../../types/game';
import { createDeck, dealCards, shuffle } from './deck';
import { applyBet } from './betting';
import { getBestHand, compareHands } from './hand-evaluator';

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: ReadonlyMap<GameStage, readonly GameStage[]> = new Map(
  [
    ['waiting', ['pre-flop']],
    ['pre-flop', ['flop', 'showdown', 'end']],
    ['flop', ['turn', 'showdown', 'end']],
    ['turn', ['river', 'showdown', 'end']],
    ['river', ['showdown', 'end']],
    ['showdown', ['end']],
    ['end', []],
  ] as [GameStage, GameStage[]][],
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidTransition(from: GameStage, to: GameStage): boolean {
  return VALID_TRANSITIONS.get(from)?.includes(to) ?? false;
}

function emptyBettingRound() {
  return { bets: {} as Record<string, number>, actedPlayers: new Set<string>() };
}

/**
 * Return active (non-folded, non-disconnected, non-sitOut) players sorted by seat index.
 */
function getActivePlayers(
  players: Record<string, Player>,
): Player[] {
  return Object.values(players)
    .filter((p) => p.status !== 'folded' && p.status !== 'disconnected' && p.status !== 'sitOut')
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Find the next seat index in a clockwise direction that belongs to an active player.
 */
function nextActiveSeat(
  currentSeat: number,
  players: Record<string, Player>,
): number {
  const active = getActivePlayers(players);
  if (active.length === 0) return currentSeat;
  const seats = active.map((p) => p.seatIndex);
  const next = seats.find((s) => s > currentSeat) ?? seats[0]!;
  return next;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create the initial GameState for a new hand.
 *
 * @param players     Current table players (must have ≥ 2 active)
 * @param settings    Table settings (blinds, antes…)
 * @param dealerSeat  Seat index of the dealer button
 * @param handNumber  Incrementing hand counter
 * @param rng         Optional deterministic RNG for testing
 */
export function createGameState(
  players: Record<string, Player>,
  settings: GameSettings,
  dealerSeat: number,
  handNumber: number,
  rng: () => number = Math.random,
): GameState {
  const active = getActivePlayers(players);
  if (active.length < 2) {
    throw new Error('At least 2 active players are required to start a game');
  }

  const deck = shuffle(createDeck(), rng);

  // Assign blind positions
  const sbSeat = nextActiveSeat(dealerSeat, players);
  const bbSeat = nextActiveSeat(sbSeat, players);

  // Collect antes if configured
  let pot = 0;
  const anteBets: Record<string, number> = {};
  if (settings.ante > 0) {
    for (const p of active) {
      const ante = Math.min(settings.ante, p.chips);
      anteBets[p.id] = ante;
      pot += ante;
    }
  }

  // Post blinds
  const sbPlayer = active.find((p) => p.seatIndex === sbSeat)!;
  const bbPlayer = active.find((p) => p.seatIndex === bbSeat)!;

  const sbAmount = Math.min(settings.smallBlind, sbPlayer.chips);
  const bbAmount = Math.min(settings.bigBlind, bbPlayer.chips);
  pot += sbAmount + bbAmount;

  // Deal hole cards (2 per player)
  let remaining = deck;
  const playerHands: Record<string, PlayerHand> = {};

  for (const p of active) {
    const [dealt, rest] = dealCards(remaining, 2);
    remaining = rest;
    playerHands[p.id] = {
      holeCards: [dealt[0]!, dealt[1]!],
    };
  }

  // First to act pre-flop: player after BB
  const firstToAct = nextActiveSeat(bbSeat, players);

  return {
    stage: 'pre-flop',
    dealerSeatIndex: dealerSeat,
    smallBlindSeatIndex: sbSeat,
    bigBlindSeatIndex: bbSeat,
    currentSeatIndex: firstToAct,
    pot,
    sidePots: [],
    communityCards: [],
    deck: remaining,
    playerHands,
    currentBet: bbAmount,
    raiseCount: 0,
    minimumRaise: bbAmount,
    bettingRound: {
      bets: {
        ...anteBets,
        [sbPlayer.id]: (anteBets[sbPlayer.id] ?? 0) + sbAmount,
        [bbPlayer.id]: (anteBets[bbPlayer.id] ?? 0) + bbAmount,
      },
      actedPlayers: new Set<string>(), // nobody has acted yet; BB gets check option
    },
    lastAction: null,
    handNumber,
  };
}

/**
 * Transition the game stage forward (deal community cards, etc.).
 * Returns a new GameState — never mutates the input.
 *
 * Throws if the transition is invalid.
 */
export function advanceStage(
  state: GameState,
  targetStage: GameStage,
): GameState {
  if (!isValidTransition(state.stage, targetStage)) {
    throw new Error(
      `Invalid stage transition: ${state.stage} → ${targetStage}`,
    );
  }

  let newDeck = state.deck;
  let newCommunity = state.communityCards;

  if (targetStage === 'flop') {
    const [cards, rest] = dealCards(newDeck, 3);
    newCommunity = cards;
    newDeck = rest;
  } else if (targetStage === 'turn' || targetStage === 'river') {
    const [cards, rest] = dealCards(newDeck, 1);
    newCommunity = [...newCommunity, ...cards];
    newDeck = rest;
  }

  return {
    ...state,
    stage: targetStage,
    communityCards: newCommunity,
    deck: newDeck,
    currentBet: 0,
    raiseCount: 0,
    bettingRound: emptyBettingRound(),
  };
}

/**
 * Apply a player action (fold, check, call, raise, allIn) to the game state.
 * Returns a new GameState.
 *
 * Throws if the action is invalid.
 */
export function applyAction(
  state: GameState,
  player: Player,
  action: PlayerAction,
): GameState {
  const stage = state.stage;
  if (
    stage === 'waiting' ||
    stage === 'showdown' ||
    stage === 'end'
  ) {
    throw new Error(
      `Actions cannot be applied during stage "${stage}"`,
    );
  }

  return applyBet(state, player, action);
}

/**
 * Determine the winner(s) of a hand.
 * Returns a list of WinnerResult objects (multiple entries for split pots).
 */
export function determineWinners(
  state: GameState,
  players: Record<string, Player>,
): readonly WinnerResult[] {
  const active = Object.values(players).filter(
    (p) => p.status !== 'folded' && p.status !== 'disconnected',
  );

  if (active.length === 0) return [];

  // Evaluate hands for all active players
  const evaluated = active
    .map((p) => {
      const hand = state.playerHands[p.id];
      if (!hand) return null;
      const result = getBestHand(hand.holeCards, state.communityCards);
      return { player: p, hand: result };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (evaluated.length === 0) return [];

  // Handle side pots
  if (state.sidePots.length > 0) {
    return distributeSidePots(state.sidePots, evaluated);
  }

  // Single pot — find winner(s)
  const best = evaluated.reduce((acc, curr) =>
    compareHands(curr.hand, acc.hand) > 0 ? curr : acc,
  );

  const winners = evaluated.filter(
    (e) => compareHands(e.hand, best.hand) === 0,
  );

  const share = Math.floor(state.pot / winners.length);
  return winners.map((w) => ({
    playerId: w.player.id,
    amount: share,
    hand: w.hand,
  }));
}

function distributeSidePots(
  sidePots: readonly SidePot[],
  evaluated: { player: Player; hand: ReturnType<typeof getBestHand> }[],
): readonly WinnerResult[] {
  const results: WinnerResult[] = [];

  for (let idx = 0; idx < sidePots.length; idx++) {
    const pot = sidePots[idx]!;
    const eligible = evaluated.filter((e) =>
      pot.eligiblePlayerIds.includes(e.player.id),
    );
    if (eligible.length === 0) continue;

    const best = eligible.reduce((acc, curr) =>
      compareHands(curr.hand, acc.hand) > 0 ? curr : acc,
    );

    const potWinners = eligible.filter(
      (e) => compareHands(e.hand, best.hand) === 0,
    );

    const share = Math.floor(pot.amount / potWinners.length);
    for (const w of potWinners) {
      results.push({
        playerId: w.player.id,
        amount: share,
        hand: w.hand,
        sidePotIndex: idx,
      });
    }
  }

  return results;
}

/**
 * Compute the HandEndResult — chip awards and updated chip counts.
 */
export function computeHandEnd(
  state: GameState,
  players: Record<string, Player>,
  winners: readonly WinnerResult[],
): HandEndResult {
  const playerChips: Record<string, number> = {};

  for (const player of Object.values(players)) {
    playerChips[player.id] = player.chips;
  }

  for (const winner of winners) {
    playerChips[winner.playerId] = (playerChips[winner.playerId] ?? 0) + winner.amount;
  }

  return {
    winners,
    playerChips,
    handNumber: state.handNumber,
    pot: state.pot,
    communityCards: state.communityCards,
    playerHands: state.playerHands,
  };
}
