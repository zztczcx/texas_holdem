'use server';

import { v4 as uuidv4 } from 'uuid';
import {
  CreateTableSchema,
  JoinTableSchema,
  StartGameSchema,
  PlayerActionSchema,
  BuyBackSchema,
  KickPlayerSchema,
} from '../lib/utils/validate';
import {
  getTable,
  setTable,
  acquireLock,
  releaseLock,
  setSession,
} from '../lib/db/kv';
import { getOrCreateSessionId } from '../lib/utils/session';
import { generateTableId } from '../lib/utils/nanoid';
import { createGameState, determineWinners, computeHandEnd, applyAction } from '../lib/game/game-state';
import { assertIsHost, assertPlayerInTable, applyWinnings, filterGameStateForPlayer } from '../lib/game/state-filter';
import {
  publishPlayerJoined,
  publishGameStarted,
  publishPlayerHand,
  publishAction as publishPusherAction,
  publishStateUpdate,
  publishHandEnd,
  publishPlayerLeft,
} from '../lib/pusher/server';
import type { GameSettings, Player, PlayerAction, Table } from '../types/game';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActionResult<T = void> {
  data?: T;
  error?: string;
}

// ── createTable ───────────────────────────────────────────────────────────────

export async function createTable(
  settings: GameSettings,
  hostName: string,
): Promise<ActionResult<{ tableId: string }>> {
  const parsed = CreateTableSchema.safeParse({ settings, hostName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const sessionId = await getOrCreateSessionId();
    const tableId = generateTableId();
    const playerId = uuidv4();
    const now = Date.now();

    const host: Player = {
      id: playerId,
      name: parsed.data.hostName,
      seatIndex: 0,
      chips: parsed.data.settings.startingChips,
      status: 'active',
      sessionId,
      joinedAt: now,
    };

    const table: Table = {
      id: tableId,
      hostPlayerId: playerId,
      state: 'waiting',
      settings: parsed.data.settings,
      players: { [playerId]: host },
      gameState: null,
      createdAt: now,
      updatedAt: now,
    };

    await setTable(table);
    await setSession(sessionId, { tableId, playerId });

    return { data: { tableId } };
  } catch {
    return { error: 'Failed to create table. Please try again.' };
  }
}

// ── joinTable ─────────────────────────────────────────────────────────────────

export async function joinTable(
  tableId: string,
  playerName: string,
): Promise<ActionResult<{ playerId: string }>> {
  const parsed = JoinTableSchema.safeParse({ tableId, playerName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) {
    return { error: 'Table is busy — please try again shortly.' };
  }

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };
    if (table.state !== 'waiting') return { error: 'Game already in progress.' };

    const currentPlayers = Object.values(table.players);
    if (currentPlayers.length >= table.settings.maxPlayers) {
      return { error: 'Table is full.' };
    }

    const sessionId = await getOrCreateSessionId();
    const playerId = uuidv4();
    const now = Date.now();

    // Find the next available seat
    const occupiedSeats = new Set(currentPlayers.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (occupiedSeats.has(seatIndex)) seatIndex++;

    const player: Player = {
      id: playerId,
      name: parsed.data.playerName,
      seatIndex,
      chips: table.settings.startingChips,
      status: 'active',
      sessionId,
      joinedAt: now,
    };

    const updatedTable: Table = {
      ...table,
      players: { ...table.players, [playerId]: player },
      updatedAt: now,
    };

    await setTable(updatedTable);
    await setSession(sessionId, { tableId, playerId });

    // Notify other players that someone joined
    await publishPlayerJoined(tableId, player).catch(() => null);

    return { data: { playerId } };
  } catch {
    return { error: 'Failed to join table. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── startGame ─────────────────────────────────────────────────────────────────

export async function startGame(
  tableId: string,
  playerId: string,
): Promise<ActionResult> {
  const parsed = StartGameSchema.safeParse({ tableId, playerId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };

    try {
      assertIsHost(table, parsed.data.playerId);
    } catch (e) {
      return { error: (e as Error).message };
    }

    if (table.state !== 'waiting') return { error: 'Game already in progress.' };

    const activePlayers = Object.values(table.players).filter(
      (p) => p.status === 'active',
    );
    if (activePlayers.length < 2) {
      return { error: 'At least 2 players are required to start.' };
    }

    const dealerSeat = activePlayers[0]!.seatIndex;
    const gameState = createGameState(
      table.players,
      table.settings,
      dealerSeat,
      1,
    );

    const updatedTable: Table = {
      ...table,
      state: 'playing',
      gameState,
      updatedAt: Date.now(),
    };

    await setTable(updatedTable);

    // Notify all players that game started
    await publishGameStarted(tableId).catch(() => null);

    // Send each player their private hole cards
    for (const [pid, hand] of Object.entries(gameState.playerHands)) {
      await publishPlayerHand(pid, { playerId: pid, holeCards: hand.holeCards }).catch(() => null);
    }

    return {};
  } catch {
    return { error: 'Failed to start game. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── performAction ─────────────────────────────────────────────────────────────

export async function performAction(
  tableId: string,
  playerId: string,
  action: PlayerAction,
): Promise<ActionResult> {
  const parsed = PlayerActionSchema.safeParse({ tableId, playerId, action });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };
    if (table.state !== 'playing' || !table.gameState) {
      return { error: 'Game is not in progress.' };
    }

    let player: Player;
    try {
      player = assertPlayerInTable(table, parsed.data.playerId);
    } catch (e) {
      return { error: (e as Error).message };
    }

    let newGameState;
    try {
      newGameState = applyAction(table.gameState, player, parsed.data.action);
    } catch (e) {
      return { error: (e as Error).message };
    }

    const updatedTable: Table = {
      ...table,
      gameState: newGameState,
      updatedAt: Date.now(),
    };

    await setTable(updatedTable);

    // Broadcast the action and updated (filtered) state to all players
    await publishPusherAction(tableId, parsed.data.action).catch(() => null);
    // Broadcast a generic public state (no hole cards) to all
    const publicState = filterGameStateForPlayer(newGameState, null);
    await publishStateUpdate(tableId, publicState).catch(() => null);

    return {};
  } catch {
    return { error: 'Failed to perform action. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── buyBack ───────────────────────────────────────────────────────────────────

export async function buyBack(
  tableId: string,
  playerId: string,
): Promise<ActionResult> {
  const parsed = BuyBackSchema.safeParse({ tableId, playerId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };
    if (!table.settings.allowBuyBack) return { error: 'Buy-backs are not allowed at this table.' };

    let player: Player;
    try {
      player = assertPlayerInTable(table, parsed.data.playerId);
    } catch (e) {
      return { error: (e as Error).message };
    }

    if (player.chips > 0) return { error: 'Player still has chips.' };

    const updatedPlayer: Player = {
      ...player,
      chips: table.settings.buyBackAmount,
      status: 'active',
    };

    const updatedTable: Table = {
      ...table,
      players: { ...table.players, [player.id]: updatedPlayer },
      updatedAt: Date.now(),
    };

    await setTable(updatedTable);
    return {};
  } catch {
    return { error: 'Failed to process buy-back. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── kickPlayer ────────────────────────────────────────────────────────────────

export async function kickPlayer(
  tableId: string,
  hostId: string,
  targetPlayerId: string,
): Promise<ActionResult> {
  const parsed = KickPlayerSchema.safeParse({ tableId, hostId, targetPlayerId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };

    try {
      assertIsHost(table, parsed.data.hostId);
    } catch (e) {
      return { error: (e as Error).message };
    }

    if (parsed.data.targetPlayerId === parsed.data.hostId) {
      return { error: 'Cannot kick yourself.' };
    }

    if (!table.players[parsed.data.targetPlayerId]) {
      return { error: 'Player not found in this table.' };
    }

    const kickedId = parsed.data.targetPlayerId;

    const remainingPlayers = Object.fromEntries(
      Object.entries(table.players).filter(([id]) => id !== kickedId),
    );

    const updatedTable: Table = {
      ...table,
      players: remainingPlayers,
      updatedAt: Date.now(),
    };

    await setTable(updatedTable);
    await publishPlayerLeft(tableId, kickedId).catch(() => null);
    return {};
  } catch {
    return { error: 'Failed to kick player. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

import type { HandEndResult } from '../types/game';

// ── endHand (internal helper) ─────────────────────────────────────────────────

/**
 * Finalize a hand: determine winners, award chips, reset for next hand.
 * Called internally after all betting is complete.
 */
export async function endHand(tableId: string): Promise<ActionResult<HandEndResult>> {
  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table || !table.gameState) return { error: 'No active game found.' };

    const winners = determineWinners(table.gameState, table.players);
    const handEnd = computeHandEnd(table.gameState, table.players, winners);

    // Apply winnings (deduct round bets, award pot winnings)
    const bets = table.gameState.bettingRound.bets;
    const updatedPlayers = applyWinnings(table.players, bets, winners);

    // Remove players with 0 chips who can't buy back
    const activePlayers: typeof updatedPlayers = {};
    for (const [id, player] of Object.entries(updatedPlayers)) {
      if (player.chips > 0 || table.settings.allowBuyBack) {
        activePlayers[id] = { ...player, status: 'active' };
      }
    }

    // Check if game should end (fewer than 2 players remaining)
    const remaining = Object.values(activePlayers).filter((p) => p.chips > 0);
    const tableState = remaining.length < 2 ? 'ended' : 'playing';

    const updatedTable: Table = {
      ...table,
      state: tableState,
      players: activePlayers,
      gameState: tableState === 'ended' ? null : null, // Reset for next hand
      updatedAt: Date.now(),
    };

    await setTable(updatedTable);
    await publishHandEnd(tableId, handEnd).catch(() => null);
    return { data: handEnd };
  } catch {
    return { error: 'Failed to end hand. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}
