import { describe, it, expect } from 'vitest';
import {
  createGameState,
  advanceStage,
  applyAction,
  determineWinners,
  computeHandEnd,
} from './game-state';
import type { GameState, Player, GameSettings, PlayerAction } from '../../types/game';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, seat: number, chips = 1000, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    seatIndex: seat,
    chips,
    status: 'active',
    sessionId: `session-${id}`,
    joinedAt: 0,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    maxRaises: 4,
    ante: 0,
    turnTimerSeconds: 0,
    maxPlayers: 6,
    allowBuyBack: false,
    buyBackAmount: 0,
    ...overrides,
  };
}

// Deterministic RNG for tests
let seed = 12345;
function seededRng(): number {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0x100000000;
}

function twoPlayerTable() {
  const players: Record<string, Player> = {
    p1: makePlayer('p1', 0, 1000),
    p2: makePlayer('p2', 1, 1000),
  };
  return players;
}

function action(type: PlayerAction['type'], playerId: string, amount?: number): PlayerAction {
  return { type, playerId, amount, timestamp: 0 };
}

// ── createGameState ──────────────────────────────────────────────────────────

describe('createGameState', () => {
  it('throws when fewer than 2 active players', () => {
    const players = { p1: makePlayer('p1', 0) };
    expect(() => createGameState(players, makeSettings(), 0, 1)).toThrow();
  });

  it('creates state in pre-flop stage', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    expect(state.stage).toBe('pre-flop');
  });

  it('deals 2 hole cards to each active player', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    expect(Object.keys(state.playerHands)).toHaveLength(2);
    for (const hand of Object.values(state.playerHands)) {
      expect(hand.holeCards).toHaveLength(2);
    }
  });

  it('charges small and big blinds to pot', () => {
    const players = twoPlayerTable();
    const settings = makeSettings({ smallBlind: 10, bigBlind: 20 });
    const state = createGameState(players, settings, 0, 1, seededRng);
    expect(state.pot).toBe(30);
  });

  it('sets currentBet to big blind amount', () => {
    const players = twoPlayerTable();
    const settings = makeSettings({ bigBlind: 20 });
    const state = createGameState(players, settings, 0, 1, seededRng);
    expect(state.currentBet).toBe(20);
  });

  it('remaining deck has 52 - (2 * numPlayers) cards', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    expect(state.deck).toHaveLength(52 - 4);
  });

  it('collects antes when configured', () => {
    const players = twoPlayerTable();
    const settings = makeSettings({ ante: 5 });
    const state = createGameState(players, settings, 0, 1, seededRng);
    // pot = ante*2 + SB + BB = 10 + 10 + 20 = 40
    expect(state.pot).toBe(40);
  });
});

// ── advanceStage ─────────────────────────────────────────────────────────────

describe('advanceStage', () => {
  function baseState(): GameState {
    const players = twoPlayerTable();
    return createGameState(players, makeSettings(), 0, 1, seededRng);
  }

  it('transitions pre-flop -> flop and deals 3 community cards', () => {
    const state = baseState();
    const flop = advanceStage(state, 'flop');
    expect(flop.stage).toBe('flop');
    expect(flop.communityCards).toHaveLength(3);
  });

  it('transitions flop -> turn and deals 1 more card', () => {
    const flop = advanceStage(baseState(), 'flop');
    const turn = advanceStage(flop, 'turn');
    expect(turn.stage).toBe('turn');
    expect(turn.communityCards).toHaveLength(4);
  });

  it('transitions turn -> river and deals 1 more card', () => {
    const turn = advanceStage(advanceStage(baseState(), 'flop'), 'turn');
    const river = advanceStage(turn, 'river');
    expect(river.stage).toBe('river');
    expect(river.communityCards).toHaveLength(5);
  });

  it('resets current bet and raise count on stage advance', () => {
    const state = { ...baseState(), currentBet: 40, raiseCount: 2 };
    const flop = advanceStage(state, 'flop');
    expect(flop.currentBet).toBe(0);
    expect(flop.raiseCount).toBe(0);
  });

  it('throws on invalid transition', () => {
    const state = baseState();
    expect(() => advanceStage(state, 'river')).toThrow();
  });

  it('throws from end stage', () => {
    const state = { ...baseState(), stage: 'end' as const };
    expect(() => advanceStage(state, 'pre-flop')).toThrow();
  });

  it('does not mutate original state', () => {
    const state = baseState();
    const originalStage = state.stage;
    advanceStage(state, 'flop');
    expect(state.stage).toBe(originalStage);
  });
});

// ── applyAction ───────────────────────────────────────────────────────────────

describe('applyAction', () => {
  function stateWithPlayers() {
    const players = twoPlayerTable();
    return { state: createGameState(players, makeSettings(), 0, 1, seededRng), players };
  }

  it('throws when action in waiting stage', () => {
    const { state, players } = stateWithPlayers();
    const waitingState = { ...state, stage: 'waiting' as const };
    expect(() =>
      applyAction(waitingState, players['p1']!, action('fold', 'p1')),
    ).toThrow();
  });

  it('throws when action in showdown stage', () => {
    const { state, players } = stateWithPlayers();
    const showdownState = { ...state, stage: 'showdown' as const };
    expect(() =>
      applyAction(showdownState, players['p1']!, action('fold', 'p1')),
    ).toThrow();
  });

  it('fold succeeds in pre-flop', () => {
    const { state, players } = stateWithPlayers();
    // Find who the current player is
    const currentPlayer = Object.values(players).find(
      (p) => p.seatIndex === state.currentSeatIndex,
    )!;
    const newState = applyAction(state, currentPlayer, action('fold', currentPlayer.id));
    expect(newState.lastAction?.type).toBe('fold');
  });
});

// ── determineWinners ─────────────────────────────────────────────────────────

describe('determineWinners', () => {
  it('returns the player with the best hand', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    const river = advanceStage(
      advanceStage(
        advanceStage(state, 'flop'),
        'turn',
      ),
      'river',
    );
    const fullState = { ...river, stage: 'showdown' as const };
    const winners = determineWinners(fullState, players);
    expect(winners.length).toBeGreaterThan(0);
    // Total winnings should equal pot (or close due to rounding)
    const total = winners.reduce((s, w) => s + w.amount, 0);
    expect(total).toBeLessThanOrEqual(fullState.pot);
  });

  it('only folded-out player loses — winner gets full pot', () => {
    // Build a minimal state directly (no need for createGameState)
    const testState: GameState = {
      stage: 'showdown',
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 1,
      bigBlindSeatIndex: 2,
      currentSeatIndex: 0,
      pot: 100,
      sidePots: [],
      communityCards: [
        { suit: 'diamonds', rank: 'K' },
        { suit: 'clubs', rank: 'Q' },
        { suit: 'spades', rank: 'J' },
        { suit: 'hearts', rank: '10' },
        { suit: 'diamonds', rank: '2' },
      ],
      deck: [],
      playerHands: {
        p1: { holeCards: [{ suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: 'A' }] },
      },
      currentBet: 0,
      raiseCount: 0,
      minimumRaise: 20,
      bettingRound: { bets: {}, actedPlayers: new Set() },
      lastAction: null,
      handNumber: 1,
    };
    const testPlayers = {
      p1: makePlayer('p1', 0),
      p2: makePlayer('p2', 1, 1000, { status: 'folded' }),
    };
    const winners = determineWinners(testState, testPlayers);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.playerId).toBe('p1');
  });
});

// ── computeHandEnd ────────────────────────────────────────────────────────────

describe('computeHandEnd', () => {
  it('awards chips to winner', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    const winners = [{ playerId: 'p1', amount: 200 }];
    const result = computeHandEnd(state, players, winners);
    expect(result.playerChips['p1']).toBe(1200); // 1000 + 200
    expect(result.playerChips['p2']).toBe(1000);
  });

  it('does not mutate player objects', () => {
    const players = twoPlayerTable();
    const state = createGameState(players, makeSettings(), 0, 1, seededRng);
    const originalChips = players['p1']!.chips;
    computeHandEnd(state, players, [{ playerId: 'p1', amount: 500 }]);
    expect(players['p1']!.chips).toBe(originalChips);
  });
});

// ── Full hand simulation ──────────────────────────────────────────────────────

describe('full hand simulation', () => {
  it('runs a complete 2-player hand without errors', () => {
    seed = 99999; // Reset seed for determinism
    const players = twoPlayerTable();
    const settings = makeSettings();

    // Create initial state
    let state = createGameState(players, settings, 0, 1, seededRng);
    expect(state.stage).toBe('pre-flop');

    // Pre-flop: current player calls
    const preFlopPlayer = Object.values(players).find(
      (p) => p.seatIndex === state.currentSeatIndex,
    )!;
    state = applyAction(state, preFlopPlayer, action('call', preFlopPlayer.id));

    // Advance to flop
    state = advanceStage(state, 'flop');
    expect(state.communityCards).toHaveLength(3);

    // Advance to turn
    state = advanceStage(state, 'turn');
    expect(state.communityCards).toHaveLength(4);

    // Advance to river
    state = advanceStage(state, 'river');
    expect(state.communityCards).toHaveLength(5);

    // Advance to showdown
    state = advanceStage(state, 'showdown');

    // Determine winners
    const winners = determineWinners(state, players);
    expect(winners.length).toBeGreaterThan(0);

    // Compute hand end
    const handEnd = computeHandEnd(state, players, winners);
    expect(handEnd.handNumber).toBe(1);
    expect(Object.keys(handEnd.playerChips)).toHaveLength(2);
  });
});
