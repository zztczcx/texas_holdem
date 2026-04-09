import { Redis } from '@upstash/redis';
import type { Table } from '../../types/game';

// ── Client ───────────────────────────────────────────────────────────────────

/**
 * Singleton Redis client.
 * Reads KV_REST_API_URL and KV_REST_API_TOKEN from environment.
 * Falls back to a mock client in test/dev if env vars are absent.
 */
function createRedisClient(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    // Return a Redis-compatible no-op for local dev without credentials
    // Real ops will fail gracefully — the app requires env vars in production
    throw new Error(
      'KV_REST_API_URL and KV_REST_API_TOKEN environment variables are required. ' +
        'Copy .env.example to .env.local and fill in the values.',
    );
  }

  return new Redis({ url, token });
}

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = createRedisClient();
  }
  return _redis;
}

// ── Key helpers ───────────────────────────────────────────────────────────────

const TABLE_TTL_SECONDS = 3 * 60 * 60; // 3 hours

function tableKey(tableId: string): string {
  return `table:${tableId}`;
}

function lockKey(tableId: string): string {
  return `table:${tableId}:lock`;
}

function sessionKey(sessionId: string): string {
  return `player-session:${sessionId}`;
}

// ── Serialization helpers ─────────────────────────────────────────────────────
//
// `Set` objects lose their entries when round-tripped through JSON (they become
// `{}`).  We normalize `bettingRound.actedPlayers` to a plain array before
// writing to Redis and reconstruct the `Set` when reading back.

type SerializedTable = Omit<Table, 'gameState'> & {
  gameState: (Omit<NonNullable<Table['gameState']>, 'bettingRound'> & {
    bettingRound: Omit<NonNullable<Table['gameState']>['bettingRound'], 'actedPlayers'> & {
      actedPlayers: string[];
    };
  }) | null;
};

function serializeTable(table: Table): SerializedTable {
  if (!table.gameState) return table as unknown as SerializedTable;
  return {
    ...table,
    gameState: {
      ...table.gameState,
      bettingRound: {
        ...table.gameState.bettingRound,
        actedPlayers: Array.from(table.gameState.bettingRound.actedPlayers),
      },
    },
  };
}

function deserializeTable(data: SerializedTable): Table {
  if (!data.gameState) return data as unknown as Table;
  const actedRaw = data.gameState.bettingRound.actedPlayers;
  // Guard: after a Redis round-trip the value might be an array, an object, or
  // already a Set (in tests).  Handle all three cases.
  const actedSet: Set<string> =
    actedRaw instanceof Set
      ? actedRaw
      : Array.isArray(actedRaw)
        ? new Set<string>(actedRaw)
        : new Set<string>(Object.keys(actedRaw as Record<string, unknown>));

  return {
    ...data,
    gameState: {
      ...data.gameState,
      bettingRound: {
        ...data.gameState.bettingRound,
        actedPlayers: actedSet,
      },
    },
  } as unknown as Table;
}

// ── Table CRUD ────────────────────────────────────────────────────────────────

/**
 * Retrieve a table from KV. Returns null if not found.
 * Revives Set fields (actedPlayers) that JSON round-trips lose.
 */
export async function getTable(tableId: string): Promise<Table | null> {
  const redis = getRedis();
  const data = await redis.get<SerializedTable>(tableKey(tableId));
  if (!data) return null;
  return deserializeTable(data);
}

/**
 * Persist a table to KV with a 3-hour TTL.
 * Serializes Set fields to arrays so JSON can represent them faithfully.
 */
export async function setTable(table: Table): Promise<void> {
  const redis = getRedis();
  await redis.set(tableKey(table.id), serializeTable(table), { ex: TABLE_TTL_SECONDS });
}

/**
 * Delete a table from KV.
 */
export async function deleteTable(tableId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(tableKey(tableId));
}

// ── Optimistic locking ────────────────────────────────────────────────────────

export interface Lock {
  key: string;
  value: string;
}

/**
 * Attempt to acquire a distributed lock for a table.
 * Returns the lock token if acquired, throws if the table is locked.
 *
 * Uses Redis SET NX (set-if-not-exists) with a 10-second TTL.
 */
export async function acquireLock(tableId: string): Promise<Lock> {
  const redis = getRedis();
  const key = lockKey(tableId);
  const value = `${Date.now()}-${Math.random()}`;
  const acquired = await redis.set(key, value, { nx: true, ex: 10 });

  if (!acquired) {
    throw new Error(`Table ${tableId} is locked — concurrent action in progress`);
  }

  return { key, value };
}

/**
 * Release a previously acquired lock.
 * Only releases if the stored value matches (prevents releasing another process's lock).
 */
export async function releaseLock(lock: Lock): Promise<void> {
  const redis = getRedis();
  const current = await redis.get<string>(lock.key);
  if (current === lock.value) {
    await redis.del(lock.key);
  }
}

// ── Session management ────────────────────────────────────────────────────────

export interface PlayerSession {
  tableId: string;
  playerId: string;
}

export async function getSession(sessionId: string): Promise<PlayerSession | null> {
  const redis = getRedis();
  const data = await redis.get<PlayerSession>(sessionKey(sessionId));
  return data ?? null;
}

export async function setSession(sessionId: string, session: PlayerSession): Promise<void> {
  const redis = getRedis();
  await redis.set(sessionKey(sessionId), session, { ex: TABLE_TTL_SECONDS });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(sessionKey(sessionId));
}
