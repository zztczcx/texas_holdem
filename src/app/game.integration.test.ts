/**
 * Integration test: full two-player game using REAL Upstash Redis.
 *
 * What is mocked:
 *   - getOrCreateSessionId   → returns a controlled test session cookie
 *   - All Pusher publish functions → no-op (we can't subscribe in tests)
 *   - uuid.v4 / generateTableId  → deterministic IDs per test run
 *
 * What is REAL:
 *   - Upstash Redis (reads, writes, locks, sessions)
 *   - All game-engine logic (createGameState, applyAction, determineWinners…)
 *   - All server-action orchestration (createTable, joinTable, startGame,
 *     performAction) — the same code path that runs in production
 *
 * Run:
 *   npx vitest run --config vitest.integration.config.ts
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { Redis } from '@upstash/redis';
import type { Table, GameSettings } from '@/types/game';

// ── Stable mock references (must be initialised before vi.mock hoisting) ──────

const mockGetOrCreateSessionId = vi.fn<() => Promise<string>>();
const mockGenerateTableId = vi.fn<() => string>();
const mockUuidv4 = vi.fn<() => string>();

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

// Pusher publish calls are fire-and-forget — stub them out so tests don't
// require a Pusher connection.
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

// ── ID generation (unique per test run to avoid Redis key collisions) ─────────

/** Generate a random 6-char alphanumeric table ID */
function randomTableId(): string {
  return randomBytes(3).toString('hex'); // e.g. "a3f9c2"
}



// ── Settings fixture ──────────────────────────────────────────────────────────

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

// ── Redis client for assertions + cleanup ─────────────────────────────────────

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set in .env.local');
  }
  return new Redis({ url, token });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Integration: full two-player game against real Redis', () => {
  let redis: Redis;
  let tableId: string;
  let aliceId: string;
  let bobId: string;
  const aliceSession = 'int-session-alice';
  const bobSession = 'int-session-bob';

  // Generate fresh IDs per suite run so parallel runs don't collide

  beforeAll(() => {
    redis = getRedis();
  });

  afterAll(async () => {
    // Delete all keys created during the test to keep Redis clean
    const keys = [
      `table:${tableId}`,
      `player-session:${aliceSession}`,
      `player-session:${bobSession}`,
    ];
    for (const key of keys) {
      await redis.del(key).catch(() => null);
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    tableId = randomTableId();
    aliceId = crypto.randomUUID();
    bobId = crypto.randomUUID();

    const uuidQueue = [aliceId, bobId];
    mockGenerateTableId.mockReturnValue(tableId);
    mockUuidv4.mockImplementation(() => uuidQueue.shift() ?? crypto.randomUUID());
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
  });

  // ── Step 1: create table ────────────────────────────────────────────────────

  it('step 1 — Alice creates a table (writes to real Redis)', async () => {
    const { createTable } = await import('@/app/actions');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);

    const result = await createTable(makeSettings(), 'Alice');

    expect(result.error).toBeUndefined();
    expect(result.data?.tableId).toBe(tableId);

    // Verify the table was actually persisted in Redis
    const raw = await redis.get<Table>(`table:${tableId}`);
    expect(raw).not.toBeNull();
    expect((raw as Table).hostPlayerId).toBe(aliceId);
    expect((raw as Table).state).toBe('waiting');
  });

  // ── Step 2: join table ──────────────────────────────────────────────────────

  it('step 2 — Bob joins (Redis updated with second player)', async () => {
    // Ensure Alice's table exists first
    const { createTable, joinTable } = await import('@/app/actions');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');

    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    const joinResult = await joinTable(tableId, 'Bob');
    expect(joinResult.error).toBeUndefined();
    expect(joinResult.data?.playerId).toBe(bobId);

    const raw = await redis.get<Table>(`table:${tableId}`);
    const table = raw as Table;
    const names = Object.values(table.players).map((p) => p.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
    expect(Object.keys(table.players)).toHaveLength(2);
  });

  // ── Step 3: start game ──────────────────────────────────────────────────────

  it('step 3 — startGame creates valid game state in Redis', async () => {
    const { createTable, joinTable, startGame } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    const startResult = await startGame(tableId, aliceId);
    expect(startResult.error).toBeUndefined();

    const raw = await redis.get<Table>(`table:${tableId}`);
    const table = raw as Table;
    expect(table.state).toBe('playing');
    expect(table.gameState).not.toBeNull();
    expect(table.gameState!.stage).toBe('pre-flop');

    // Blinds posted correctly
    expect(table.gameState!.pot).toBe(30); // SB 10 + BB 20

    // Each player has exactly 2 hole cards
    for (const pid of Object.keys(table.players)) {
      expect(table.gameState!.playerHands[pid]?.holeCards).toHaveLength(2);
    }

    // Blind amounts deducted from chips
    const sbPlayer = Object.values(table.players).find(
      (p) => p.seatIndex === table.gameState!.smallBlindSeatIndex,
    )!;
    const bbPlayer = Object.values(table.players).find(
      (p) => p.seatIndex === table.gameState!.bigBlindSeatIndex,
    )!;
    expect(sbPlayer.chips).toBe(990);
    expect(bbPlayer.chips).toBe(980);
  });

  // ── Step 4: perform action — call ──────────────────────────────────────────

  it('step 4 — SB can call the BB (real Redis round-trip)', async () => {
    const { createTable, joinTable, startGame, performAction } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await startGame(tableId, aliceId);

    // Determine who acts first
    const rawBefore = await redis.get<Table>(`table:${tableId}`);
    const tableBefore = rawBefore as Table;
    const gs = tableBefore.gameState!;
    const firstActorId = Object.values(tableBefore.players).find(
      (p) => p.seatIndex === gs.currentSeatIndex,
    )!.id;
    const previousRevision = tableBefore.revision;

    // First actor calls
    const callResult = await performAction(tableId, firstActorId, {
      type: 'call',
      playerId: firstActorId,
      timestamp: Date.now(),
    });

    // If this throws "invalid action", the diagnostic message will show why
    expect(callResult.error).toBeUndefined();
    expect(callResult.data?.snapshot.revision).toBe(previousRevision + 1);

    const rawAfter = await redis.get<Table>(`table:${tableId}`);
    const tableAfter = rawAfter as Table;
    const gsAfter = tableAfter.gameState!;

    expect(tableAfter.revision).toBe(callResult.data?.snapshot.revision);
    expect(callResult.data?.snapshot.players[firstActorId]?.id).toBe(firstActorId);

    // Either still pre-flop (BB option) or already at flop
    expect(['pre-flop', 'flop']).toContain(gsAfter.stage);

    // Pot grew by the call amount (10 more from SB)
    expect(gsAfter.pot).toBeGreaterThanOrEqual(40);
  });

  // ── Full hand: call + check + check through all streets ─────────────────────

  it('full hand — all streets, showdown, chip conservation', async () => {
    const { createTable, joinTable, startGame, performAction } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await startGame(tableId, aliceId);

    /** Read fresh table from Redis and act on the current player */
    async function actOnCurrent(type: 'call' | 'check'): Promise<boolean> {
      const raw = await redis.get<Table>(`table:${tableId}`);
      const t = raw as Table;
      if (!t.gameState) return false; // hand ended
      const stage = t.gameState.stage;
      if (stage === 'showdown' || stage === 'end') return false;

      const actor = Object.values(t.players).find(
        (p) => p.seatIndex === t.gameState!.currentSeatIndex,
      );
      if (!actor) return false;

      const result = await performAction(tableId, actor.id, {
        type,
        playerId: actor.id,
        timestamp: Date.now(),
      });
      if (result.error) throw new Error(`Action "${type}" failed: ${result.error}`);
      return true;
    }

    // Pre-flop: first player calls, then BB checks (option)
    await actOnCurrent('call');
    // Check if BB option needed
    const rawMid = await redis.get<Table>(`table:${tableId}`);
    const tMid = rawMid as Table;
    if (tMid.gameState?.stage === 'pre-flop') {
      await actOnCurrent('check');
    }

    // Flop, turn, river: both players check
    for (const street of ['flop', 'turn', 'river'] as const) {
      const rawStreet = await redis.get<Table>(`table:${tableId}`);
      const tStreet = rawStreet as Table;
      if (!tStreet.gameState || tStreet.gameState.stage !== street) break;

      await actOnCurrent('check');
      const rawMid2 = await redis.get<Table>(`table:${tableId}`);
      if (rawMid2 && (rawMid2 as Table).gameState?.stage === street) {
        await actOnCurrent('check');
      }
    }

    // After river, game should be in next hand or ended
    const rawFinal = await redis.get<Table>(`table:${tableId}`);
    const tFinal = rawFinal as Table;

    if (tFinal.state === 'playing') {
      // Next hand started — chips + pot should conserve total
      const chips = Object.values(tFinal.players).reduce((s, p) => s + p.chips, 0);
      const pot = tFinal.gameState?.pot ?? 0;
      expect(chips + pot).toBe(2000); // zero-sum
      expect(tFinal.gameState?.handNumber).toBe(2);
      expect(tFinal.gameState?.stage).toBe('pre-flop');
    } else {
      // One player bust → game ended
      expect(tFinal.state).toBe('ended');
      const chips = Object.values(tFinal.players).reduce((s, p) => s + p.chips, 0);
      expect(chips).toBe(2000);
    }
  });

  // ── Fold scenario ────────────────────────────────────────────────────────────

  it('fold — opponent wins the pot, chip totals conserved', async () => {
    const { createTable, joinTable, startGame, performAction } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await startGame(tableId, aliceId);

    const rawBefore = await redis.get<Table>(`table:${tableId}`);
    const tBefore = rawBefore as Table;
    const firstActor = Object.values(tBefore.players).find(
      (p) => p.seatIndex === tBefore.gameState!.currentSeatIndex,
    )!;

    const result = await performAction(tableId, firstActor.id, {
      type: 'fold',
      playerId: firstActor.id,
      timestamp: Date.now(),
    });
    expect(result.error).toBeUndefined();

    const rawAfter = await redis.get<Table>(`table:${tableId}`);
    const tAfter = rawAfter as Table;
    const chips = Object.values(tAfter.players).reduce((s, p) => s + p.chips, 0);
    const pot = tAfter.state === 'playing' ? (tAfter.gameState?.pot ?? 0) : 0;
    expect(chips + pot).toBe(2000);
  });

  // ── All-in scenario ───────────────────────────────────────────────────────────

  it('both all-in — runout to showdown, chip totals conserved', async () => {
    const { createTable, joinTable, startGame, performAction } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await startGame(tableId, aliceId);

    async function allInCurrent(): Promise<boolean> {
      const raw = await redis.get<Table>(`table:${tableId}`);
      const t = raw as Table;
      if (!t.gameState || t.gameState.stage === 'showdown') return false;
      const actor = Object.values(t.players).find(
        (p) => p.seatIndex === t.gameState!.currentSeatIndex && p.status === 'active',
      );
      if (!actor) return false;
      const result = await performAction(tableId, actor.id, {
        type: 'allIn',
        playerId: actor.id,
        timestamp: Date.now(),
      });
      if (result.error) return false;
      return true;
    }

    await allInCurrent();
    const rawMid = await redis.get<Table>(`table:${tableId}`);
    if ((rawMid as Table).state === 'playing' && (rawMid as Table).gameState) {
      await allInCurrent(); // second player calls/all-in
    }

    const rawFinal = await redis.get<Table>(`table:${tableId}`);
    const tFinal = rawFinal as Table;
    const chips = Object.values(tFinal.players).reduce((s, p) => s + p.chips, 0);
    expect(chips).toBe(2000); // all chips awarded, zero-sum
  });

  // ── Non-host cannot start ─────────────────────────────────────────────────────

  it('Bob cannot start the game (not host)', async () => {
    const { createTable, joinTable, startGame } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');

    const result = await startGame(tableId, bobId);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/host/i);
  });

  // ── Wrong-turn enforcement (real Redis) ───────────────────────────────────────

  it('player cannot act when it is not their turn', async () => {
    const { createTable, joinTable, startGame, performAction } = await import('@/app/actions');

    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await createTable(makeSettings(), 'Alice');
    mockGetOrCreateSessionId.mockResolvedValue(bobSession);
    await joinTable(tableId, 'Bob');
    mockGetOrCreateSessionId.mockResolvedValue(aliceSession);
    await startGame(tableId, aliceId);

    const rawBefore = await redis.get<Table>(`table:${tableId}`);
    const tBefore = rawBefore as Table;
    const waitingPlayerId = Object.values(tBefore.players).find(
      (p) => p.seatIndex !== tBefore.gameState!.currentSeatIndex,
    )!.id;

    const result = await performAction(tableId, waitingPlayerId, {
      type: 'check',
      playerId: waitingPlayerId,
      timestamp: Date.now(),
    });
    expect(result.error).toBeDefined();
  });
});
