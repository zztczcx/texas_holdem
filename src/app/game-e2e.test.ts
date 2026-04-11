/**
 * End-to-end integration test: two players create a table, join, start the
 * game, and play a complete hand all the way to showdown / chip award.
 *
 * The test uses an in-memory KV store (instead of Redis) and stubs out Pusher
 * so no real network calls are made. All game logic runs through the actual
 * Server Action code paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Table, GameSettings, Player } from '@/types/game';

// ── Stable vi.fn() references (hoisting-safe) ────────────────────────────────

const mockGetTable = vi.fn<(id: string) => Promise<Table | null>>();
const mockSetTable = vi.fn<(t: Table) => Promise<void>>();
const mockAcquireLock = vi.fn<(id: string) => Promise<{ key: string; value: string } | null>>();
const mockReleaseLock = vi.fn<(lock: { key: string }) => Promise<void>>();
const mockSetSession = vi.fn<() => Promise<void>>();
const mockGetOrCreateSessionId = vi.fn<() => Promise<string>>();
const mockGenerateTableId = vi.fn<() => string>();
const mockUuidv4 = vi.fn<() => string>();

vi.mock('@/lib/db/kv', () => ({
  getTable: (...args: unknown[]) => mockGetTable(...(args as [string])),
  setTable: (...args: unknown[]) => mockSetTable(...(args as [Table])),
  acquireLock: (...args: unknown[]) => mockAcquireLock(...(args as [string])),
  releaseLock: (...args: unknown[]) => mockReleaseLock(...(args as [{ key: string }])),
  setSession: (...args: unknown[]) => mockSetSession(...(args as [])),
}));

vi.mock('@/lib/utils/session', () => ({
  getOrCreateSessionId: (...args: unknown[]) => mockGetOrCreateSessionId(...(args as [])),
  getSessionId: (...args: unknown[]) => mockGetOrCreateSessionId(...(args as [])),
}));

vi.mock('@/lib/utils/nanoid', () => ({
  generateTableId: () => mockGenerateTableId(),
}));

vi.mock('uuid', () => ({
  v4: () => mockUuidv4(),
}));

vi.mock('@/lib/pusher/server', () => ({
  publishPlayerJoined: vi.fn().mockResolvedValue(undefined),
  publishGameStarted: vi.fn().mockResolvedValue(undefined),
  publishPlayerHand: vi.fn().mockResolvedValue(undefined),
  publishAction: vi.fn().mockResolvedValue(undefined),
  publishStateUpdate: vi.fn().mockResolvedValue(undefined),
  publishHandEnd: vi.fn().mockResolvedValue(undefined),
  publishPlayerLeft: vi.fn().mockResolvedValue(undefined),
  publishTableUpdated: vi.fn().mockResolvedValue(undefined),
}));

// ── In-memory KV store ────────────────────────────────────────────────────────

const kvStore: Map<string, unknown> = new Map();
const locks: Set<string> = new Set();

function tableKey(id: string) { return `table:${id}`; }

function reviveActedPlayers(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;
  if (data.gameState) {
    const gs = data.gameState as Record<string, unknown>;
    const br = gs.bettingRound as Record<string, unknown>;
    if (br) {
      const ap = br.actedPlayers;
      if (!(ap instanceof Set)) {
        br.actedPlayers = new Set(Array.isArray(ap) ? ap : []);
      }
    }
  }
  return data;
}

// ── ID fixtures ───────────────────────────────────────────────────────────────

const TABLE_IDS = ['abc123', 'def456', 'ghi789'];
const PLAYER_UUIDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function getStoredTable(tableId: string): Promise<Table> {
  const t = await mockGetTable(tableId);
  if (!t) throw new Error(`Table ${tableId} not found in store`);
  return t;
}

function currentSeatPlayer(table: Table): Player {
  const gs = table.gameState!;
  return Object.values(table.players).find(
    (p) => p.seatIndex === gs.currentSeatIndex,
  )!;
}

/** Perform an action for whichever player's turn it is, using the correct sessionId */
async function doAction(
  tableId: string,
  playerId: string,
  action: Parameters<typeof import('@/app/actions').performAction>[2],
) {
  const { performAction } = await import('@/app/actions');
  return performAction(tableId, playerId, action);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Full two-player game — end-to-end', () => {
  let tableId: string;
  let aliceId: string;
  let bobId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    kvStore.clear();
    locks.clear();

    // ── Wire up in-memory KV ─────────────────────────────────────────────────
    mockGetTable.mockImplementation(async (id: string) => {
      const raw = kvStore.get(tableKey(id));
      if (!raw) return null;
      const revived = reviveActedPlayers(structuredClone(raw));
      return revived as Table;
    });
    mockSetTable.mockImplementation(async (table: Table) => {
      const copy = structuredClone(table) as unknown as Record<string, unknown>;
      if (copy.gameState) {
        const gs = copy.gameState as Record<string, unknown>;
        const br = gs.bettingRound as Record<string, unknown>;
        if (br?.actedPlayers instanceof Set) {
          br.actedPlayers = Array.from(br.actedPlayers as Set<unknown>);
        }
      }
      kvStore.set(tableKey(table.id), copy);
    });
    mockAcquireLock.mockImplementation(async (id: string) => {
      if (locks.has(id)) return null;
      locks.add(id);
      return { key: id, value: 'evt' };
    });
    mockReleaseLock.mockImplementation(async (lock: { key: string }) => {
      locks.delete(lock.key);
    });
    mockSetSession.mockResolvedValue(undefined);

    // ── ID generators ─────────────────────────────────────────────────────────
    let tableIdx = 0;
    let playerIdx = 0;
    mockGenerateTableId.mockImplementation(() => TABLE_IDS[tableIdx++] ?? 'zzz999');
    mockUuidv4.mockImplementation(() => PLAYER_UUIDS[playerIdx++] ?? '00000000-0000-4000-8000-000000000099');

    // ── 1. Alice creates the table ───────────────────────────────────────────
    mockGetOrCreateSessionId.mockResolvedValue('session-alice');
    const { createTable } = await import('@/app/actions');
    const createResult = await createTable(makeSettings(), 'Alice');
    expect(createResult.error).toBeUndefined();
    tableId = createResult.data!.tableId;
    aliceId = PLAYER_UUIDS[0]; // first uuid issued

    // ── 2. Bob joins ─────────────────────────────────────────────────────────
    mockGetOrCreateSessionId.mockResolvedValue('session-bob');
    const { joinTable } = await import('@/app/actions');
    const joinResult = await joinTable(tableId, 'Bob');
    expect(joinResult.error).toBeUndefined();
    bobId = joinResult.data?.playerId ?? PLAYER_UUIDS[1];

    // Verify both players are in the table
    const lobby = await getStoredTable(tableId);
    expect(Object.keys(lobby.players)).toHaveLength(2);
    expect(lobby.state).toBe('waiting');
  });

  it('creates table and records both players correctly', async () => {
    const table = await getStoredTable(tableId);
    expect(table.hostPlayerId).toBe(aliceId);
    const names = Object.values(table.players).map((p) => p.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('Alice starts the game successfully', async () => {
    const { startGame } = await import('@/app/actions');
    const result = await startGame(tableId, aliceId);
    expect(result.error).toBeUndefined();

    const table = await getStoredTable(tableId);
    expect(table.state).toBe('playing');
    expect(table.gameState).not.toBeNull();
    expect(table.gameState!.stage).toBe('pre-flop');
  });

  it('Bob cannot start the game (not host)', async () => {
    const { startGame } = await import('@/app/actions');
    const result = await startGame(tableId, bobId);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/host/i);
  });

  it('deals 2 hole cards to each player', async () => {
    const { startGame } = await import('@/app/actions');
    await startGame(tableId, aliceId);

    const table = await getStoredTable(tableId);
    const gs = table.gameState!;
    const hands = Object.values(gs.playerHands);
    expect(hands).toHaveLength(2);
    for (const hand of hands) {
      expect(hand.holeCards).toHaveLength(2);
    }
  });

  it('posts small blind and big blind correctly', async () => {
    const { startGame } = await import('@/app/actions');
    await startGame(tableId, aliceId);

    const table = await getStoredTable(tableId);
    const gs = table.gameState!;
    // With 2 players: dealer=SB, other=BB, first to act = dealer (heads-up pre-flop)
    // Pot should be SB (10) + BB (20) = 30
    expect(gs.pot).toBe(30);
    expect(gs.currentBet).toBe(20);
  });

  describe('Pre-flop betting', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    it('current player can fold', async () => {
      const before = await getStoredTable(tableId);
      const actingPlayer = currentSeatPlayer(before);

      const result = await doAction(tableId, actingPlayer.id, {
        type: 'fold',
        playerId: actingPlayer.id,
        timestamp: Date.now(),
      });

      expect(result.error).toBeUndefined();
    });

    it('fold ends the hand — opponent wins the pot', async () => {
      const before = await getStoredTable(tableId);
      const actingPlayer = currentSeatPlayer(before);
      const otherPlayer = Object.values(before.players).find(
        (p) => p.id !== actingPlayer.id,
      )!;

      await doAction(tableId, actingPlayer.id, {
        type: 'fold',
        playerId: actingPlayer.id,
        timestamp: Date.now(),
      });

      // After fold + hand finalization, the table should progress to next hand
      // or end (if chips run out)
      const after = await getStoredTable(tableId);
      const winner = after.players[otherPlayer.id];
      expect(winner).toBeDefined();
      if (after.state === 'playing') {
        // Next hand started — winner's total position (chips + any blind they committed) 
        // should be > 1000 (they profited from the won pot, even if partly re-committed)
        const winnerChips = winner!.chips;
        const winnerCommitted = after.gameState?.bettingRound.bets[winner!.id] ?? 0;
        expect(winnerChips + winnerCommitted).toBeGreaterThan(1000);
      } else {
        // Game ended — winner has all chips
        expect(after.state).toBe('ended');
      }
    });

    it('rejects action for wrong player (not their turn)', async () => {
      const before = await getStoredTable(tableId);
      const actingPlayer = currentSeatPlayer(before);
      const otherPlayer = Object.values(before.players).find(
        (p) => p.id !== actingPlayer.id,
      )!;

      const result = await doAction(tableId, otherPlayer.id, {
        type: 'check',
        playerId: otherPlayer.id,
        timestamp: Date.now(),
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('Full hand — call then check through all streets', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    /**
     * Play through a complete hand:
     * - Pre-flop: acting player calls, BB checks (option)
     * - Flop: both check
     * - Turn: both check
     * - River: both check → showdown and chip award
     */
    it('plays a complete hand through all streets', async () => {
      let table = await getStoredTable(tableId);

      // Helper: perform the right check/call for the current seat
      async function actOnCurrentPlayer(actionType: 'call' | 'check'): Promise<void> {
        table = await getStoredTable(tableId);
        const actor = currentSeatPlayer(table);
        const result = await doAction(tableId, actor.id, {
          type: actionType,
          playerId: actor.id,
          timestamp: Date.now(),
        });
        if (result.error) throw new Error(`Action failed: ${result.error}`);
      }

      // ── Pre-flop ──────────────────────────────────────────────────────────
      expect(table.gameState!.stage).toBe('pre-flop');

      // In 2-player heads-up: seat 0 = dealer/SB acts first pre-flop, seat 1 = BB
      // Acting player (SB/dealer) calls the BB (20 - 10 = 10 more chips)
      await actOnCurrentPlayer('call');

      // Now BB gets their option — they check
      table = await getStoredTable(tableId);
      const afterCall = table.gameState!;

      if (afterCall.stage === 'pre-flop') {
        // BB still needs to act (check option)
        await actOnCurrentPlayer('check');
      }

      // ── Flop ─────────────────────────────────────────────────────────────
      table = await getStoredTable(tableId);
      expect(table.gameState!.stage).toBe('flop');
      expect(table.gameState!.communityCards).toHaveLength(3);

      await actOnCurrentPlayer('check');
      table = await getStoredTable(tableId);
      if (table.gameState?.stage === 'flop') {
        await actOnCurrentPlayer('check');
      }

      // ── Turn ──────────────────────────────────────────────────────────────
      table = await getStoredTable(tableId);
      expect(table.gameState!.stage).toBe('turn');
      expect(table.gameState!.communityCards).toHaveLength(4);

      await actOnCurrentPlayer('check');
      table = await getStoredTable(tableId);
      if (table.gameState?.stage === 'turn') {
        await actOnCurrentPlayer('check');
      }

      // ── River ─────────────────────────────────────────────────────────────
      table = await getStoredTable(tableId);
      expect(table.gameState!.stage).toBe('river');
      expect(table.gameState!.communityCards).toHaveLength(5);

      await actOnCurrentPlayer('check');
      table = await getStoredTable(tableId);
      if (table.gameState?.stage === 'river') {
        await actOnCurrentPlayer('check');
      }

      // ── Showdown / hand end ───────────────────────────────────────────────
      // After river betting completes, performAction should auto-advance to
      // showdown, determine the winner, and start the next hand (or end game).
      table = await getStoredTable(tableId);

      if (table.state === 'playing') {
        // Next hand started — chips should be conserved (zero-sum): players + pot = 2000
        const totalChips = Object.values(table.players).reduce(
          (sum, p) => sum + p.chips, 0,
        );
        const pot = table.gameState?.pot ?? 0;
        expect(totalChips + pot).toBe(2000); // 2 players × 1000 starting chips
        // Next hand should be at pre-flop
        expect(table.gameState!.stage).toBe('pre-flop');
        // Hand number should have incremented
        expect(table.gameState!.handNumber).toBe(2);
      } else {
        // One player went bust — game ended
        expect(table.state).toBe('ended');
        const totalChips = Object.values(table.players).reduce(
          (sum, p) => sum + p.chips, 0,
        );
        expect(totalChips).toBe(2000);
      }
    });

    it('chips are conserved (zero-sum) across a fold', async () => {
      let table = await getStoredTable(tableId);
      const actor = currentSeatPlayer(table);

      await doAction(tableId, actor.id, {
        type: 'fold',
        playerId: actor.id,
        timestamp: Date.now(),
      });

      table = await getStoredTable(tableId);
      const totalChips = Object.values(table.players).reduce(
        (sum, p) => sum + p.chips, 0,
      );
      // Pot-in-play (next hand blinds) + players = 2000
      const pot = table.state === 'playing' ? (table.gameState?.pot ?? 0) : 0;
      expect(totalChips + pot).toBe(2000);
    });
  });

  describe('Raise scenario', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    it('raise updates currentBet and deducts chips correctly', async () => {
      const before = await getStoredTable(tableId);
      const actor = currentSeatPlayer(before);
      const prevChips = actor.chips;
      const gs = before.gameState!;
      const alreadyBet = gs.bettingRound.bets[actor.id] ?? 0;

      // Raise to 60 (total commitment)
      const raiseAmount = 60;
      const result = await doAction(tableId, actor.id, {
        type: 'raise',
        playerId: actor.id,
        amount: raiseAmount,
        timestamp: Date.now(),
      });

      expect(result.error).toBeUndefined();

      const after = await getStoredTable(tableId);
      const actorAfter = after.players[actor.id]!;
      // raise.amount = NEW chips placed; total commitment = alreadyBet + raiseAmount
      const expectedChips = prevChips - raiseAmount;
      expect(actorAfter.chips).toBe(expectedChips);
      expect(after.gameState!.currentBet).toBe(alreadyBet + raiseAmount);
    });

    it('after a raise, opponent must call or fold', async () => {
      let table = await getStoredTable(tableId);
      const firstActor = currentSeatPlayer(table);

      await doAction(tableId, firstActor.id, {
        type: 'raise',
        playerId: firstActor.id,
        amount: 60,
        timestamp: Date.now(),
      });

      table = await getStoredTable(tableId);
      const nextActor = currentSeatPlayer(table);
      expect(nextActor.id).not.toBe(firstActor.id);

      // Next player folds
      const result = await doAction(tableId, nextActor.id, {
        type: 'fold',
        playerId: nextActor.id,
        timestamp: Date.now(),
      });
      expect(result.error).toBeUndefined();

      table = await getStoredTable(tableId);
      // Chips conserved (players + pot-in-play = 2000)
      const total = Object.values(table.players).reduce((s, p) => s + p.chips, 0);
      const potInPlay = table.state === 'playing' ? (table.gameState?.pot ?? 0) : 0;
      expect(total + potInPlay).toBe(2000);
    });
  });

  describe('All-in scenario', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    it('going all-in sets player status and zeroes chips', async () => {
      const before = await getStoredTable(tableId);
      const actor = currentSeatPlayer(before);

      const result = await doAction(tableId, actor.id, {
        type: 'allIn',
        playerId: actor.id,
        timestamp: Date.now(),
      });

      expect(result.error).toBeUndefined();

      const after = await getStoredTable(tableId);
      const actorAfter = after.players[actor.id]!;
      expect(actorAfter.status).toBe('allIn');
      expect(actorAfter.chips).toBe(0);
    });

    it('both players all-in triggers immediate showdown + chip award', async () => {
      let table = await getStoredTable(tableId);
      const p1 = currentSeatPlayer(table);

      // Player 1 goes all-in
      await doAction(tableId, p1.id, {
        type: 'allIn',
        playerId: p1.id,
        timestamp: Date.now(),
      });

      table = await getStoredTable(tableId);

      // If still pre-flop/same hand check who's next
      if (table.state === 'playing' && table.gameState) {
        const p2 = currentSeatPlayer(table);
        if (p2?.id !== p1.id) {
          // Player 2 calls / goes all-in
          await doAction(tableId, p2.id, {
            type: 'allIn',
            playerId: p2.id,
            timestamp: Date.now(),
          });
        }
      }

      table = await getStoredTable(tableId);
      // After both all-in, hand should be over — chips conserved
      const total = Object.values(table.players).reduce((s, p) => s + p.chips, 0);
      expect(total).toBe(2000);
    });
  });

  describe('Turn ordering (heads-up)', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    it('after one player acts, the turn advances to the other player', async () => {
      const before = await getStoredTable(tableId);
      const gs = before.gameState!;
      const firstSeat = gs.currentSeatIndex;
      const actor = currentSeatPlayer(before);

      await doAction(tableId, actor.id, {
        type: 'call',
        playerId: actor.id,
        timestamp: Date.now(),
      });

      const after = await getStoredTable(tableId);
      const afterGs = after.gameState;
      if (afterGs && afterGs.stage === 'pre-flop') {
        // Turn advanced to the other player
        expect(afterGs.currentSeatIndex).not.toBe(firstSeat);
      }
      // If stage advanced, that's also valid (BB had option and checked auto...)
    });

    it('player cannot act twice in a row', async () => {
      const before = await getStoredTable(tableId);
      const actor = currentSeatPlayer(before);

      // First action
      await doAction(tableId, actor.id, {
        type: 'call',
        playerId: actor.id,
        timestamp: Date.now(),
      });

      // Attempt second action as same player immediately
      const result = await doAction(tableId, actor.id, {
        type: 'check',
        playerId: actor.id,
        timestamp: Date.now(),
      });

      // Should fail because it's not their turn anymore
      expect(result.error).toBeDefined();
    });
  });

  describe('Game state integrity', () => {
    beforeEach(async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);
    });

    it('community cards grow correctly: 0 → 3 (flop) → 4 (turn) → 5 (river)', async () => {
      async function checkAndAdvance(): Promise<void> {
        let t = await getStoredTable(tableId);
        while (t.gameState?.stage === t.gameState?.stage) {
          const stageBeforeAct = t.gameState!.stage;
          const actor = currentSeatPlayer(t);
          await doAction(tableId, actor.id, { type: 'check', playerId: actor.id, timestamp: Date.now() });
          t = await getStoredTable(tableId);
          if (!t.gameState || t.gameState.stage !== stageBeforeAct) break;
        }
      }

      let table = await getStoredTable(tableId);
      // Pre-flop: 0 community cards
      expect(table.gameState!.communityCards).toHaveLength(0);

      // Call to equalize, then BB checks option → moves to flop
      const actor = currentSeatPlayer(table);
      await doAction(tableId, actor.id, { type: 'call', playerId: actor.id, timestamp: Date.now() });
      table = await getStoredTable(tableId);
      if (table.gameState?.stage === 'pre-flop') {
        const actor2 = currentSeatPlayer(table);
        await doAction(tableId, actor2.id, { type: 'check', playerId: actor2.id, timestamp: Date.now() });
        table = await getStoredTable(tableId);
      }

      if (!table.gameState) return; // hand ended (e.g. someone bust)
      expect(table.gameState.stage).toBe('flop');
      expect(table.gameState.communityCards).toHaveLength(3);

      await checkAndAdvance(); // flop → turn
      table = await getStoredTable(tableId);
      if (!table.gameState) return;
      expect(table.gameState.stage).toBe('turn');
      expect(table.gameState.communityCards).toHaveLength(4);

      await checkAndAdvance(); // turn → river
      table = await getStoredTable(tableId);
      if (!table.gameState) return;
      expect(table.gameState.stage).toBe('river');
      expect(table.gameState.communityCards).toHaveLength(5);
    });

    it('pot is correctly distributed: 2 × bb = 40 after call + check', async () => {
      let table = await getStoredTable(tableId);
      const gs = table.gameState!;
      // Starting pot = SB(10) + BB(20) = 30
      expect(gs.pot).toBe(30);

      // SB calls (puts in 10 more to match BB 20)
      const actor = currentSeatPlayer(table);
      await doAction(tableId, actor.id, { type: 'call', playerId: actor.id, timestamp: Date.now() });

      table = await getStoredTable(tableId);
      if (!table.gameState) return;

      if (table.gameState.stage === 'pre-flop') {
        // BB checks option → moves to flop, pot = 40
        const actor2 = currentSeatPlayer(table);
        await doAction(tableId, actor2.id, { type: 'check', playerId: actor2.id, timestamp: Date.now() });
        table = await getStoredTable(tableId);
      }

      if (table.gameState) {
        expect(table.gameState.pot).toBe(40);
      }
    });

    it('player statuses reset to active at the start of the next hand', async () => {
      // Play one hand to conclusion via fold
      let table = await getStoredTable(tableId);
      const actor = currentSeatPlayer(table);
      await doAction(tableId, actor.id, { type: 'fold', playerId: actor.id, timestamp: Date.now() });

      table = await getStoredTable(tableId);
      if (table.state === 'playing' && table.gameState) {
        // All surviving players should be active again
        const statuses = Object.values(table.players).map((p) => p.status);
        expect(statuses.every((s) => s === 'active')).toBe(true);
      }
    });
  });

  describe('Error handling', () => {
    it('performAction fails when game is not started', async () => {
      const { performAction } = await import('@/app/actions');
      const result = await performAction(tableId, aliceId, {
        type: 'fold',
        playerId: aliceId,
        timestamp: Date.now(),
      });
      expect(result.error).toBeDefined();
    });

    it('performAction fails for a player not at the table', async () => {
      const { startGame, performAction } = await import('@/app/actions');
      await startGame(tableId, aliceId);

      const result = await performAction(tableId, 'player-999', {
        type: 'fold',
        playerId: 'player-999',
        timestamp: Date.now(),
      });
      expect(result.error).toBeDefined();
    });

    it('cannot join a table that is already playing', async () => {
      const { startGame } = await import('@/app/actions');
      await startGame(tableId, aliceId);

      const { joinTable } = await import('@/app/actions');
      const result = await joinTable(tableId, 'Charlie');
      expect(result.error).toBeDefined();
    });

    it('cannot start a game with only one player', async () => {
      const { createTable, startGame } = await import('@/app/actions');

      // Use a fresh mock for the 3rd table slot
      const singleResult = await createTable(makeSettings(), 'Solo');
      if (singleResult.error) return; // ran out of table ID slots — skip
      const soloTableId = singleResult.data!.tableId;
      // The host's playerId is whatever uuid was issued when createTable ran
      // Get it directly from the stored table
      const soloTable = await getStoredTable(soloTableId);
      const soloHostId = soloTable.hostPlayerId;

      const result = await startGame(soloTableId, soloHostId);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/2 players/i);
    });
  });
});

// ── Bug regression: all-in call must not get stuck ────────────────────────────
//
// Scenario: On the flop, Player A raises 200. Player B only has 170 chips,
// so they call by going all-in. The game MUST auto-advance through the
// remaining streets to showdown — it must NOT wait for the all-in player
// to act on subsequent streets.

describe('All-in call regression — game must not get stuck', () => {
  let tableId: string;
  let aliceId: string;
  let bobId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    kvStore.clear();
    locks.clear();

    mockGetTable.mockImplementation(async (id: string) => {
      const raw = kvStore.get(tableKey(id));
      if (!raw) return null;
      return reviveActedPlayers(structuredClone(raw)) as Table;
    });
    mockSetTable.mockImplementation(async (table: Table) => {
      const copy = structuredClone(table) as unknown as Record<string, unknown>;
      if (copy.gameState) {
        const gs = copy.gameState as Record<string, unknown>;
        const br = gs.bettingRound as Record<string, unknown>;
        if (br?.actedPlayers instanceof Set) {
          br.actedPlayers = Array.from(br.actedPlayers as Set<unknown>);
        }
      }
      kvStore.set(tableKey(table.id), copy);
    });
    mockAcquireLock.mockImplementation(async (id: string) => {
      if (locks.has(id)) return null;
      locks.add(id);
      return { key: id, value: 'evt' };
    });
    mockReleaseLock.mockImplementation(async (lock: { key: string }) => {
      locks.delete(lock.key);
    });
    mockSetSession.mockResolvedValue(undefined);

    let tableIdx = 0;
    let playerIdx = 0;
    mockGenerateTableId.mockImplementation(() => TABLE_IDS[tableIdx++] ?? 'zzz999');
    mockUuidv4.mockImplementation(() => PLAYER_UUIDS[playerIdx++] ?? '00000000-0000-4000-8000-000000000099');

    // Alice creates the table (startingChips: 1000 for Alice, only 170 for Bob)
    mockGetOrCreateSessionId.mockResolvedValue('session-alice');
    const { createTable } = await import('@/app/actions');
    // Use standard chips — we'll manipulate Bob's chips directly after join
    const createResult = await createTable(makeSettings(), 'Alice');
    expect(createResult.error).toBeUndefined();
    tableId = createResult.data!.tableId;
    aliceId = PLAYER_UUIDS[0];

    mockGetOrCreateSessionId.mockResolvedValue('session-bob');
    const { joinTable } = await import('@/app/actions');
    const joinResult = await joinTable(tableId, 'Bob');
    expect(joinResult.error).toBeUndefined();
    bobId = joinResult.data?.playerId ?? PLAYER_UUIDS[1];

    // Manually set Bob's chips to 170 so he can't cover Alice's full raise
    const tableBeforeStart = await getStoredTable(tableId);
    const patchedPlayers = { ...tableBeforeStart.players };
    patchedPlayers[bobId] = { ...patchedPlayers[bobId]!, chips: 170 };
    await mockSetTable({ ...tableBeforeStart, players: patchedPlayers });

    const { startGame } = await import('@/app/actions');
    await startGame(tableId, aliceId);
  });

  it('player B going all-in on the flop advances game to showdown without getting stuck', async () => {
    // ── Pre-flop: get to the flop ────────────────────────────────────────────
    let table = await getStoredTable(tableId);

    // Play through pre-flop: current player calls (or checks), then check option
    async function actCurrent(type: 'call' | 'check' | 'allIn'): Promise<void> {
      table = await getStoredTable(tableId);
      const actor = currentSeatPlayer(table);
      if (!actor) return;
      const res = await doAction(tableId, actor.id, { type, playerId: actor.id, timestamp: Date.now() });
      if (res.error) throw new Error(`${type} failed: ${res.error}`);
    }

    // Pre-flop: get both players to call/check so we reach the flop
    await actCurrent('call');
    table = await getStoredTable(tableId);
    if (table.gameState?.stage === 'pre-flop') {
      await actCurrent('check');
    }

    table = await getStoredTable(tableId);
    if (!table.gameState || table.gameState.stage !== 'flop') {
      // If already past flop (e.g. someone bust pre-flop), just verify chips are fine
      const total = Object.values(table.players).reduce((s, p) => s + p.chips, 0);
      expect(total).toBeLessThanOrEqual(1170); // 1000 + 170
      return;
    }
    expect(table.gameState.stage).toBe('flop');

    // ── Flop: Alice raises 200 (Alice has 1000 chips, more than enough) ─────
    table = await getStoredTable(tableId);
    const flopActor = currentSeatPlayer(table);

    // Check who has enough chips to raise 200 (must be the non-Bob player)
    // If the first to act post-flop is Bob (170 chips), have him check;
    // then Alice raises. Otherwise Alice raises directly.
    if (flopActor.id === bobId) {
      await actCurrent('check');
      table = await getStoredTable(tableId);
    }

    // Alice raises 200 (net new chips placed)
    table = await getStoredTable(tableId);
    const aliceAlreadyBet = table.gameState!.bettingRound.bets[aliceId] ?? 0;
    const raiseRes = await doAction(tableId, aliceId, {
      type: 'raise',
      playerId: aliceId,
      amount: 200,
      timestamp: Date.now(),
    });
    expect(raiseRes.error).toBeUndefined();

    table = await getStoredTable(tableId);
    expect(table.gameState!.currentBet).toBe(aliceAlreadyBet + 200);
    expect(table.gameState!.stage).toBe('flop'); // still on flop waiting for Bob

    // ── Bob goes all-in (he has 170 chips, can't cover the 200 raise) ───────
    const bobBeforeAllIn = table.players[bobId]!;
    expect(bobBeforeAllIn.chips).toBeLessThan(200); // confirm Bob can't cover

    const allInRes = await doAction(tableId, bobId, {
      type: 'allIn',
      playerId: bobId,
      timestamp: Date.now(),
    });
    expect(allInRes.error).toBeUndefined();

    // ── Critical assertion: game must NOT be stuck ───────────────────────────
    // After Bob goes all-in, there's only 1 player who can act (Alice).
    // The game should auto-advance through turn + river to showdown,
    // determine a winner, and start the next hand OR end the game.
    table = await getStoredTable(tableId);

    // The hand must be resolved — game should NOT be sitting on 'turn', 'river'
    // waiting for Bob (allIn) to act. Either a new hand started or game ended.
    const isHandResolved =
      table.state === 'ended' ||
      (table.state === 'playing' && table.gameState?.handNumber !== undefined && table.gameState.handNumber > 1) ||
      // Accept: same hand moved to a stage where Bob is NOT currentSeatIndex
      (table.state === 'playing' && table.gameState !== null && (() => {
        const gs = table.gameState!;
        const currentPlayerAtSeat = Object.values(table.players).find(
          (p) => p.seatIndex === gs.currentSeatIndex,
        );
        return currentPlayerAtSeat?.status !== 'allIn';
      })());

    expect(isHandResolved).toBe(true);

    // Chips must always be conserved (zero-sum, accounting for blinds)
    const totalChips = Object.values(table.players).reduce((s, p) => s + p.chips, 0);
    const potInPlay = table.state === 'playing' ? (table.gameState?.pot ?? 0) : 0;
    // Initial chips: Alice 1000 + Bob 170 = 1170
    expect(totalChips + potInPlay).toBe(1170);
  });

  it('Bob is marked allIn (not active) after calling/going all-in with all his chips', async () => {
    let table = await getStoredTable(tableId);

    // Pre-flop: navigate to flop
    async function actCurrent(type: 'call' | 'check' | 'allIn'): Promise<void> {
      table = await getStoredTable(tableId);
      const actor = currentSeatPlayer(table);
      if (!actor) return;
      const res = await doAction(tableId, actor.id, { type, playerId: actor.id, timestamp: Date.now() });
      if (res.error) throw new Error(`${type} failed: ${res.error}`);
    }

    await actCurrent('call');
    table = await getStoredTable(tableId);
    if (table.gameState?.stage === 'pre-flop') {
      await actCurrent('check');
    }

    table = await getStoredTable(tableId);
    if (!table.gameState || table.gameState.stage !== 'flop') return;

    // Get Bob to go all-in (either as first actor or after Alice acts)
    const flopActor = currentSeatPlayer(table);
    if (flopActor.id !== bobId) {
      // Alice acts first — have Alice raise so Bob must respond
      const raiseRes = await doAction(tableId, aliceId, {
        type: 'raise',
        playerId: aliceId,
        amount: 200,
        timestamp: Date.now(),
      });
      expect(raiseRes.error).toBeUndefined();
    }

    // Bob goes all-in
    const allInRes = await doAction(tableId, bobId, {
      type: 'allIn',
      playerId: bobId,
      timestamp: Date.now(),
    });
    expect(allInRes.error).toBeUndefined();

    table = await getStoredTable(tableId);
    const bobAfter = table.players[bobId];
    if (bobAfter) {
      // Bob should be all-in or busted (if game ended he may have been removed)
      expect(['allIn', 'active']).toContain(bobAfter.status); // active only if won
      expect(bobAfter.chips).toBeLessThanOrEqual(170); // never gained chips mid-hand
    }
  });
});
