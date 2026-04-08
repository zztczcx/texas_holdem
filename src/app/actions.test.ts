import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Table, Player, GameSettings } from '@/types/game';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetTable = vi.fn<() => Promise<Table | null>>();
const mockSetTable = vi.fn<(t: Table) => Promise<void>>();
const mockAcquireLock = vi.fn<() => Promise<string | null>>();
const mockReleaseLock = vi.fn<() => Promise<void>>();
const mockSetSession = vi.fn<() => Promise<void>>();
const mockGetOrCreateSessionId = vi.fn<() => Promise<string>>();
const mockGenerateTableId = vi.fn<() => string>();
const mockUuidv4 = vi.fn<() => string>();

vi.mock('@/lib/db/kv', () => ({
  getTable: (...args: unknown[]) => mockGetTable(...(args as [])),
  setTable: (...args: unknown[]) => mockSetTable(...(args as [Table])),
  acquireLock: (...args: unknown[]) => mockAcquireLock(...(args as [])),
  releaseLock: (...args: unknown[]) => mockReleaseLock(...(args as [])),
  setSession: (...args: unknown[]) => mockSetSession(...(args as [])),
}));

vi.mock('@/lib/utils/session', () => ({
  getOrCreateSessionId: (...args: unknown[]) => mockGetOrCreateSessionId(...(args as [])),
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
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

function makePlayer(id: string, name: string, seat = 0): Player {
  return {
    id,
    name,
    seatIndex: seat,
    chips: 1000,
    status: 'active',
    sessionId: `session-${id}`,
    joinedAt: 0,
  };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  const host = makePlayer('host-1', 'Alice', 0);
  return {
    id: 'table-abc',
    hostPlayerId: 'host-1',
    state: 'waiting',
    settings: makeSettings(),
    players: { 'host-1': host },
    gameState: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// ── createTable ───────────────────────────────────────────────────────────────

describe('createTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateSessionId.mockResolvedValue('session-xyz');
    mockGenerateTableId.mockReturnValue('table-abc');
    mockUuidv4.mockReturnValue('player-uuid');
    mockSetTable.mockResolvedValue(undefined);
    mockSetSession.mockResolvedValue(undefined);
  });

  it('returns tableId on success', async () => {
    const { createTable } = await import('@/app/actions');
    const result = await createTable(makeSettings(), 'Alice');
    expect(result.error).toBeUndefined();
    expect(result.data?.tableId).toBe('table-abc');
  });

  it('calls setTable with the new table', async () => {
    const { createTable } = await import('@/app/actions');
    await createTable(makeSettings(), 'Alice');
    expect(mockSetTable).toHaveBeenCalledOnce();
    const saved = mockSetTable.mock.calls[0]![0] as Table;
    expect(saved.hostPlayerId).toBe('player-uuid');
    expect(Object.values(saved.players)[0]!.name).toBe('Alice');
  });

  it('returns error for invalid hostName (too short)', async () => {
    const { createTable } = await import('@/app/actions');
    const result = await createTable(makeSettings(), '');
    expect(result.error).toBeDefined();
    expect(mockSetTable).not.toHaveBeenCalled();
  });

  it('returns error for invalid settings (negative blind)', async () => {
    const { createTable } = await import('@/app/actions');
    const result = await createTable(makeSettings({ smallBlind: -1 }), 'Alice');
    expect(result.error).toBeDefined();
  });
});

// ── joinTable ─────────────────────────────────────────────────────────────────

describe('joinTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateSessionId.mockResolvedValue('session-xyz');
    mockUuidv4.mockReturnValue('new-player-uuid');
    mockAcquireLock.mockResolvedValue('lock-token');
    mockReleaseLock.mockResolvedValue(undefined);
    mockSetTable.mockResolvedValue(undefined);
    mockSetSession.mockResolvedValue(undefined);
  });

  it('returns playerId when joining a waiting table', async () => {
    mockGetTable.mockResolvedValue(makeTable());
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('abc123', 'Bob');
    expect(result.error).toBeUndefined();
    expect(result.data?.playerId).toBe('new-player-uuid');
  });

  it('saves the updated table with the new player', async () => {
    mockGetTable.mockResolvedValue(makeTable());
    const { joinTable } = await import('@/app/actions');
    await joinTable('abc123', 'Bob');
    expect(mockSetTable).toHaveBeenCalledOnce();
    const saved = mockSetTable.mock.calls[0]![0] as Table;
    expect(Object.values(saved.players)).toHaveLength(2);
    expect(Object.values(saved.players).some((p) => p.name === 'Bob')).toBe(true);
  });

  it('returns error when table is not found', async () => {
    mockGetTable.mockResolvedValue(null);
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('table-xyz', 'Bob');
    expect(result.error).toBeDefined();
  });

  it('returns error when table is full', async () => {
    const players = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        `p${i}`,
        makePlayer(`p${i}`, `Player${i}`, i),
      ]),
    );
    mockGetTable.mockResolvedValue(makeTable({ players }));
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('abc123', 'Latejoiner');
    expect(result.error).toMatch(/full/i);
  });

  it('returns error when table is playing', async () => {
    mockGetTable.mockResolvedValue(makeTable({ state: 'playing' }));
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('abc123', 'Latecomer');
    expect(result.error).toBeDefined();
  });

  it('returns error when lock cannot be acquired', async () => {
    mockAcquireLock.mockResolvedValue(null);
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('abc123', 'Bob');
    expect(result.error).toMatch(/busy/i);
  });

  it('returns error for invalid player name', async () => {
    mockGetTable.mockResolvedValue(makeTable());
    const { joinTable } = await import('@/app/actions');
    const result = await joinTable('abc123', '');
    expect(result.error).toBeDefined();
    expect(mockSetTable).not.toHaveBeenCalled();
  });
});
