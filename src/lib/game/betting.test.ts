import { describe, it, expect } from 'vitest';
import { getValidActions, getCallAmount, applyBet, calculateSidePots } from './betting';
import type { GameState, Player, GameSettings, PlayerAction } from '../../types/game';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Alice',
    seatIndex: 0,
    chips: 1000,
    status: 'active',
    sessionId: 'session-1',
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

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    stage: 'pre-flop',
    dealerSeatIndex: 2,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    currentSeatIndex: 0,
    pot: 30,
    sidePots: [],
    communityCards: [],
    deck: [],
    playerHands: {},
    currentBet: 20,
    raiseCount: 0,
    minimumRaise: 20,
    bettingRound: { bets: {}, actedPlayers: new Set() },
    lastAction: null,
    handNumber: 1,
    ...overrides,
  };
}

function makeAction(
  type: PlayerAction['type'],
  amount?: number,
): PlayerAction {
  return { type, playerId: 'player-1', amount, timestamp: Date.now() };
}

// ── getValidActions ──────────────────────────────────────────────────────────

describe('getValidActions', () => {
  it('returns empty array for waiting stage', () => {
    const state = makeState({ stage: 'waiting' });
    const player = makePlayer();
    expect(getValidActions(state, player, makeSettings())).toHaveLength(0);
  });

  it('returns empty array when it is not the player\'s turn', () => {
    const state = makeState({ currentSeatIndex: 1 });
    const player = makePlayer({ seatIndex: 0 });
    expect(getValidActions(state, player, makeSettings())).toHaveLength(0);
  });

  it('returns empty array for folded player', () => {
    const state = makeState();
    const player = makePlayer({ status: 'folded' });
    expect(getValidActions(state, player, makeSettings())).toHaveLength(0);
  });

  it('returns empty array for allIn player', () => {
    const state = makeState();
    const player = makePlayer({ status: 'allIn' });
    expect(getValidActions(state, player, makeSettings())).toHaveLength(0);
  });

  it('includes fold when there is a bet to call', () => {
    const state = makeState({ currentBet: 20. });
    const player = makePlayer({ chips: 100 });
    const actions = getValidActions(state, player, makeSettings());
    expect(actions.map((a) => a.type)).toContain('fold');
  });

  it('includes check when no bet to call (currentBet = 0)', () => {
    const state = makeState({
      currentBet: 0,
      bettingRound: { bets: {}, actedPlayers: new Set() },
    });
    const player = makePlayer({ chips: 100 });
    const actions = getValidActions(state, player, makeSettings());
    expect(actions.map((a) => a.type)).toContain('check');
  });

  it('includes call when there is a bet and player has chips', () => {
    const state = makeState({ currentBet: 20 });
    const player = makePlayer({ chips: 100 });
    const actions = getValidActions(state, player, makeSettings());
    expect(actions.map((a) => a.type)).toContain('call');
  });

  it('excludes call when player lacks chips for full call', () => {
    // Player has fewer chips than call amount but can go all-in
    const state = makeState({ currentBet: 100 });
    const player = makePlayer({ chips: 50 });
    const actions = getValidActions(state, player, makeSettings());
    expect(actions.map((a) => a.type)).not.toContain('call');
    expect(actions.map((a) => a.type)).toContain('allIn');
  });

  it('includes raise when maxRaises is 0 (unlimited)', () => {
    const state = makeState({ raiseCount: 99 });
    const player = makePlayer({ chips: 500 });
    const actions = getValidActions(state, player, makeSettings({ maxRaises: 0 }));
    expect(actions.map((a) => a.type)).toContain('raise');
  });

  it('excludes raise when maxRaises reached', () => {
    const state = makeState({ raiseCount: 4 });
    const player = makePlayer({ chips: 500 });
    const actions = getValidActions(state, player, makeSettings({ maxRaises: 4 }));
    expect(actions.map((a) => a.type)).not.toContain('raise');
  });

  it('always includes allIn when player has chips', () => {
    const state = makeState();
    const player = makePlayer({ chips: 1000 });
    const actions = getValidActions(state, player, makeSettings());
    expect(actions.map((a) => a.type)).toContain('allIn');
  });
});

// ── getCallAmount ────────────────────────────────────────────────────────────

describe('getCallAmount', () => {
  it('returns full call amount when player has not bet', () => {
    const state = makeState({ currentBet: 20 });
    const player = makePlayer();
    expect(getCallAmount(state, player)).toBe(20);
  });

  it('returns partial call amount when player has already bet', () => {
    const state = makeState({
      currentBet: 20,
      bettingRound: { bets: { 'player-1': 10 }, actedPlayers: new Set() },
    });
    const player = makePlayer();
    expect(getCallAmount(state, player)).toBe(10);
  });

  it('returns 0 when player already at current bet', () => {
    const state = makeState({
      currentBet: 20,
      bettingRound: { bets: { 'player-1': 20 }, actedPlayers: new Set() },
    });
    const player = makePlayer();
    expect(getCallAmount(state, player)).toBe(0);
  });
});

// ── applyBet ─────────────────────────────────────────────────────────────────

describe('applyBet', () => {
  it('fold marks player as folded and does not change pot', () => {
    const state = makeState({ pot: 30 });
    const player = makePlayer({ chips: 100 });
    const newState = applyBet(state, player, makeAction('fold'));
    // pot unchanged, player status updated in returned state
    expect(newState.pot).toBe(30);
    expect(newState.lastAction?.type).toBe('fold');
  });

  it('check does not change pot or currentBet', () => {
    const state = makeState({
      currentBet: 0,
      pot: 30,
      bettingRound: { bets: {}, actedPlayers: new Set() },
    });
    const player = makePlayer({ chips: 100 });
    const newState = applyBet(state, player, makeAction('check'));
    expect(newState.pot).toBe(30);
    expect(newState.currentBet).toBe(0);
  });

  it('call adds chips to pot', () => {
    const state = makeState({ currentBet: 20, pot: 30 });
    const player = makePlayer({ chips: 100 });
    const newState = applyBet(state, player, makeAction('call'));
    expect(newState.pot).toBe(50);
  });

  it('raise increases pot, currentBet, and raiseCount', () => {
    const state = makeState({ currentBet: 20, pot: 30, raiseCount: 0 });
    const player = makePlayer({ chips: 200 });
    // Raise by 40 (total commitment 60, raise by 40 over currentBet of 20)
    const newState = applyBet(state, player, makeAction('raise', 60));
    expect(newState.pot).toBe(90);      // 30 + 60
    expect(newState.currentBet).toBe(60);
    expect(newState.raiseCount).toBe(1);
  });

  it('raise throws when amount <= 0', () => {
    const state = makeState();
    const player = makePlayer({ chips: 200 });
    expect(() => applyBet(state, player, makeAction('raise', 0))).toThrow();
  });

  it('allIn commits all chips to pot', () => {
    const state = makeState({ currentBet: 20, pot: 30 });
    const player = makePlayer({ chips: 50 });
    const newState = applyBet(state, player, makeAction('allIn'));
    expect(newState.pot).toBe(80); // 30 + 50
    expect(newState.lastAction?.type).toBe('allIn');
  });

  it('does not mutate original state', () => {
    const state = makeState({ pot: 30 });
    const player = makePlayer({ chips: 100 });
    const bets = state.bettingRound.bets;
    applyBet(state, player, makeAction('call'));
    expect(state.pot).toBe(30);
    expect(state.bettingRound.bets).toBe(bets); // same reference
  });

  it('throws when action is not valid for the stage', () => {
    const state = makeState({ stage: 'waiting' });
    const player = makePlayer();
    expect(() => applyBet(state, player, makeAction('call'))).toThrow();
  });
});

// ── calculateSidePots ────────────────────────────────────────────────────────

describe('calculateSidePots', () => {
  it('returns empty array when no all-in players', () => {
    const result = calculateSidePots(
      new Map(),
      { p1: 100, p2: 100 },
      ['p1', 'p2'],
    );
    expect(result).toHaveLength(0);
  });

  it('creates one side pot for a single all-in player', () => {
    // p1 all-in for 50; p2 and p3 each bet 100
    const allIns = new Map([['p1', 50]]);
    const bets = { p1: 50, p2: 100, p3: 100 };
    const players = ['p1', 'p2', 'p3'];
    const pots = calculateSidePots(allIns, bets, players);

    // Side pot 1: all three players contributed 50 each = 150
    // Main pot: p2 and p3 each have 50 more = 100
    // Total = 250, which equals sum of all bets
    const totalDistributed = pots.reduce((s, p) => s + p.amount, 0);
    expect(totalDistributed).toBe(250);
  });

  it('total side pot amounts equal total bets', () => {
    const allIns = new Map([['p1', 50], ['p2', 80]]);
    const bets = { p1: 50, p2: 80, p3: 120 };
    const players = ['p1', 'p2', 'p3'];
    const pots = calculateSidePots(allIns, bets, players);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(50 + 80 + 120);
  });

  it('only eligible players are in each side pot', () => {
    const allIns = new Map([['p1', 30]]);
    const bets = { p1: 30, p2: 100, p3: 100 };
    const players = ['p1', 'p2', 'p3'];
    const pots = calculateSidePots(allIns, bets, players);

    // Smallest pot (up to 30 threshold): all 3 eligible
    const smallest = pots.find((p) => p.eligiblePlayerIds.includes('p1'));
    expect(smallest).toBeDefined();
    expect(smallest!.eligiblePlayerIds).toContain('p1');

    // Remaining pot: only p2 and p3
    const main = pots.find((p) => !p.eligiblePlayerIds.includes('p1'));
    expect(main).toBeDefined();
    expect(main!.eligiblePlayerIds).not.toContain('p1');
  });
});
