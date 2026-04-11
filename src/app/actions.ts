'use server';

import { v4 as uuidv4 } from 'uuid';
import {
  CreateTableSchema,
  JoinTableSchema,
  StartGameSchema,
  PlayerActionSchema,
  BuyBackSchema,
  KickPlayerSchema,
  ResetGameSchema,
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
import { createGameState, determineWinners, computeHandEnd, applyAction, advanceStage } from '../lib/game/game-state';
import { assertIsHost, assertPlayerInTable, buildGameSyncSnapshot, buildPublicTable } from '../lib/game/state-filter';
import {
  publishPlayerJoined,
  publishGameStarted,
  publishPlayerHand,
  publishAction as publishPusherAction,
  publishStateUpdate,
  publishHandEnd,
  publishPlayerLeft,
  publishTableUpdated,
} from '../lib/pusher/server';
import type {
  GameSettings,
  GameState,
  GameSyncSnapshot,
  HandEndEventPayload,
  HandEndResult,
  Player,
  PlayerAction,
  Table,
  TableState,
} from '../types/game';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deduct initial blind/ante bets from players' chips.
 * Called right after createGameState() because the game state records blind
 * commitments in bettingRound.bets, but does not mutate player chip counts.
 */
function deductInitialBets(
  players: Record<string, Player>,
  gameState: GameState,
): Record<string, Player> {
  const updated = { ...players };
  for (const [pid, bet] of Object.entries(gameState.bettingRound.bets)) {
    const p = updated[pid];
    if (p && bet > 0) {
      updated[pid] = { ...p, chips: Math.max(0, p.chips - bet) };
    }
  }
  return updated;
}

function updateTable(
  table: Table,
  updates: Partial<Pick<Table, 'state' | 'players' | 'gameState'>>,
): Table {
  return {
    ...table,
    ...updates,
    revision: table.revision + 1,
    updatedAt: Date.now(),
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActionResult<T = void> {
  data?: T;
  error?: string;
}

export interface PerformActionResultData {
  snapshot: GameSyncSnapshot;
  handEndResult?: HandEndEventPayload;
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
      revision: 0,
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

    const updatedTable = updateTable(table, {
      players: { ...table.players, [playerId]: player },
    });

    await setTable(updatedTable);
    await setSession(sessionId, { tableId, playerId });

    await publishTableUpdated(tableId, buildPublicTable(updatedTable, null)).catch(() => null);
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

    // Deduct blind/ante commitments from player chip counts immediately
    const playersWithBlindsDeducted = deductInitialBets(table.players, gameState);

    const updatedTable = updateTable(table, {
      state: 'playing',
      players: playersWithBlindsDeducted,
      gameState,
    });

    await setTable(updatedTable);

    await publishTableUpdated(tableId, buildPublicTable(updatedTable, null)).catch(() => null);
    // Notify all players that game started
    await publishGameStarted(tableId, updatedTable.revision).catch(() => null);

    // Send each player their private hole cards
    for (const [pid, hand] of Object.entries(gameState.playerHands)) {
      await publishPlayerHand(pid, {
        playerId: pid,
        revision: updatedTable.revision,
        handNumber: gameState.handNumber,
        holeCards: hand.holeCards,
      }).catch(() => null);
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
): Promise<ActionResult<PerformActionResultData>> {
  const parsed = PlayerActionSchema.safeParse({ tableId, playerId, action });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  let lockReleased = false;
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

    let newGameState: GameState;
    try {
      newGameState = applyAction(table.gameState, player, parsed.data.action);
    } catch (e) {
      return { error: (e as Error).message };
    }

    // ── Update player status and chips based on action ──────────────────────
    const newPlayers: Record<string, Player> = { ...table.players };
    const betBefore = table.gameState.bettingRound.bets[player.id] ?? 0;
    const betAfter = newGameState.bettingRound.bets[player.id] ?? 0;
    const betPaid = betAfter - betBefore;

    switch (parsed.data.action.type) {
      case 'fold':
        newPlayers[player.id] = { ...player, status: 'folded' };
        break;
      case 'allIn':
        newPlayers[player.id] = { ...player, chips: 0, status: 'allIn' };
        break;
      case 'call':
      case 'raise': {
        if (betPaid > 0) {
          const remaining = Math.max(0, player.chips - betPaid);
          // If calling/raising goes all-in (0 chips left), mark status as allIn so
          // the game correctly skips them in subsequent streets.
          newPlayers[player.id] = {
            ...player,
            chips: remaining,
            status: remaining === 0 ? 'allIn' : player.status,
          };
        }
        break;
      }
    }

    // ── Derive active player sets ───────────────────────────────────────────
    const allPlayers = Object.values(newPlayers);

    const activePlayers = allPlayers
      .filter((p) => p.status !== 'folded' && p.status !== 'disconnected' && p.status !== 'sitOut')
      .sort((a, b) => a.seatIndex - b.seatIndex);

    // Players who can still place bets (active + not all-in)
    const canActPlayers = activePlayers.filter((p) => p.status !== 'allIn');

    // Next seat clockwise from fromSeat within a player pool
    function nextSeatIn(fromSeat: number, pool: Player[]): number {
      if (pool.length === 0) return fromSeat;
      const seats = pool.map((p) => p.seatIndex);
      return seats.find((s) => s > fromSeat) ?? seats[0]!;
    }

    // First to act post-flop: first player who can still bet (not allIn)
    // Falls back to activePlayers when everyone is allIn (run-out scenario).
    function firstToActPostFlop(): number {
      const pool = canActPlayers.length > 0 ? canActPlayers : activePlayers;
      return nextSeatIn(newGameState.dealerSeatIndex, pool);
    }

    // ── Determine round / stage outcome ─────────────────────────────────────
    const instantWin = activePlayers.length === 1;

    // Round complete when all can-act players have acted with equal bets
    const everyoneActed =
      canActPlayers.length === 0 ||
      canActPlayers.every((p) => newGameState.bettingRound.actedPlayers.has(p.id));

    const roundComplete = instantWin || everyoneActed;

    const NEXT_STAGE: Partial<Record<string, string>> = {
      'pre-flop': 'flop',
      'flop': 'turn',
      'turn': 'river',
      'river': 'showdown',
    };

    if (roundComplete) {
      let nextStage = instantWin
        ? 'showdown'
        : (NEXT_STAGE[newGameState.stage] ?? 'showdown');

      newGameState = advanceStage(newGameState, nextStage as typeof newGameState.stage);

      if (nextStage !== 'showdown') {
        // Post-flop: first active player after dealer acts first
        newGameState = { ...newGameState, currentSeatIndex: firstToActPostFlop() };
      }

      // Auto-deal remaining streets when 0 or 1 players can act —
      // a single remaining player can't bet against anyone.
      while (nextStage !== 'showdown' && canActPlayers.length <= 1) {
        const autoNext = NEXT_STAGE[newGameState.stage] ?? 'showdown';
        newGameState = advanceStage(newGameState, autoNext as typeof newGameState.stage);
        nextStage = autoNext;
        if (autoNext !== 'showdown') {
          newGameState = { ...newGameState, currentSeatIndex: firstToActPostFlop() };
        }
      }

      // ── Showdown / hand end ─────────────────────────────────────────────
      if (newGameState.stage === 'showdown') {
        const winners = determineWinners(newGameState, newPlayers);
        const handEnd = computeHandEnd(newGameState, newPlayers, winners);

        // Award winnings — bets already deducted incrementally above
        const withWinnings: Record<string, Player> = {};
        for (const [id, p] of Object.entries(newPlayers)) {
          withWinnings[id] = { ...p, status: 'active' };
        }
        for (const winner of winners) {
          const p = withWinnings[winner.playerId];
          if (p) withWinnings[winner.playerId] = { ...p, chips: p.chips + winner.amount };
        }

        // Remove bust players (0 chips, no buy-back)
        const surviving: Record<string, Player> = {};
        for (const [id, p] of Object.entries(withWinnings)) {
          if (p.chips > 0 || table.settings.allowBuyBack) {
            surviving[id] = p;
          }
        }

        const remaining = Object.values(surviving).filter((p) => p.chips > 0);
        const nextTableState: TableState = remaining.length < 2 ? 'ended' : 'playing';

        // Start next hand if game continues
        let nextGameState = null;
        if (nextTableState === 'playing' && remaining.length >= 2) {
          const newDealerSeat = nextSeatIn(
            newGameState.dealerSeatIndex,
            Object.values(surviving).filter((p) => p.chips > 0),
          );
          nextGameState = createGameState(
            surviving,
            table.settings,
            newDealerSeat,
            newGameState.handNumber + 1,
          );
          // Deduct blind/ante commitments for the new hand
          for (const [pid, bet] of Object.entries(nextGameState.bettingRound.bets)) {
            const p = surviving[pid];
            if (p && bet > 0) {
              surviving[pid] = { ...p, chips: Math.max(0, p.chips - bet) };
            }
          }
        }

        const finalTable = updateTable(table, {
          state: nextTableState,
          players: surviving,
          gameState: nextGameState,
        });
        const actorSnapshot = buildGameSyncSnapshot(finalTable, parsed.data.playerId);
        const publicSnapshot = buildGameSyncSnapshot(finalTable, null);
        const handEndPayload: HandEndEventPayload = {
          revision: finalTable.revision,
          result: handEnd,
        };

        await setTable(finalTable);
        // Release lock BEFORE slow Pusher network calls so concurrent requests aren't blocked
        await releaseLock(lock);
        lockReleased = true;

        await publishPusherAction(tableId, parsed.data.action).catch(() => null);
        await publishHandEnd(tableId, handEndPayload).catch(() => null);
        await publishStateUpdate(tableId, publicSnapshot).catch(() => null);

        // Publish next hand hole cards for the same revision.
        if (nextGameState) {
          for (const p of Object.values(surviving)) {
            const hand = nextGameState.playerHands[p.id];
            if (hand) {
              await publishPlayerHand(p.id, {
                playerId: p.id,
                revision: finalTable.revision,
                handNumber: nextGameState.handNumber,
                holeCards: hand.holeCards,
              }).catch(() => null);
            }
          }
        }

        return {
          data: {
            snapshot: actorSnapshot,
            handEndResult: handEndPayload,
          },
        };
      }
    } else {
      // Advance turn to next player who can act
      const nextPool = canActPlayers.length > 0 ? canActPlayers : activePlayers;
      newGameState = { ...newGameState, currentSeatIndex: nextSeatIn(player.seatIndex, nextPool) };
    }

    const updatedTable = updateTable(table, {
      gameState: newGameState,
      players: newPlayers,
    });
    const actorSnapshot = buildGameSyncSnapshot(updatedTable, parsed.data.playerId);
    const publicSnapshot = buildGameSyncSnapshot(updatedTable, null);

    await setTable(updatedTable);
    // Release lock BEFORE Pusher calls
    await releaseLock(lock);
    lockReleased = true;

    await publishPusherAction(tableId, parsed.data.action).catch(() => null);
    await publishStateUpdate(tableId, publicSnapshot).catch(() => null);

    return { data: { snapshot: actorSnapshot } };
  } catch (e) {
    console.error('performAction error:', e);
    return { error: 'Failed to perform action. Please try again.' };
  } finally {
    if (!lockReleased) await releaseLock(lock);
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

    const updatedTable = updateTable(table, {
      players: { ...table.players, [player.id]: updatedPlayer },
    });

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

    const updatedTable = updateTable(table, {
      players: remainingPlayers,
    });

    await setTable(updatedTable);
    await publishTableUpdated(tableId, buildPublicTable(updatedTable, null)).catch(() => null);
    await publishPlayerLeft(tableId, kickedId).catch(() => null);
    return {};
  } catch {
    return { error: 'Failed to kick player. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── endHand (internal helper) ─────────────────────────────────────────────────

/**
 * Finalize a hand: determine winners, award chips, reset for next hand.
 *
 * NOTE: performAction now handles hand finalization atomically when the river
 * betting round completes. This function is kept as a safety fallback for any
 * hands that reach showdown stage without having been finalized (e.g. legacy
 * state in Redis). When performAction has already finalized the hand the table
 * will no longer be at stage 'showdown', so this returns immediately.
 */
export async function endHand(tableId: string): Promise<ActionResult<HandEndResult>> {
  const lock = await acquireLock(tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(tableId);
    if (!table) return { error: 'Table not found.' };

    // If the hand was already finalized by performAction (stage advanced past showdown
    // or gameState reset to next hand / null), acknowledge success without re-running.
    if (!table.gameState || table.gameState.stage !== 'showdown') {
      return {};
    }

    const winners = determineWinners(table.gameState, table.players);
    const handEnd = computeHandEnd(table.gameState, table.players, winners);

    // Award winnings only — bets were already deducted incrementally in performAction
    const withWinnings: Record<string, Player> = {};
    for (const [id, p] of Object.entries(table.players)) {
      withWinnings[id] = { ...p, status: 'active' };
    }
    for (const winner of winners) {
      const p = withWinnings[winner.playerId];
      if (p) withWinnings[winner.playerId] = { ...p, chips: p.chips + winner.amount };
    }

    // Remove bust players (0 chips, no buy-back)
    const surviving: Record<string, Player> = {};
    for (const [id, p] of Object.entries(withWinnings)) {
      if (p.chips > 0 || table.settings.allowBuyBack) {
        surviving[id] = p;
      }
    }

    const remaining = Object.values(surviving).filter((p) => p.chips > 0);
    const tableState: typeof table.state = remaining.length < 2 ? 'ended' : 'playing';

    const updatedTable = updateTable(table, {
      state: tableState,
      players: surviving,
      gameState: null,
    });

    await setTable(updatedTable);
    await publishHandEnd(tableId, {
      revision: updatedTable.revision,
      result: handEnd,
    }).catch(() => null);
    await publishStateUpdate(tableId, buildGameSyncSnapshot(updatedTable, null)).catch(() => null);
    return { data: handEnd };
  } catch {
    return { error: 'Failed to end hand. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}

// ── resetGame ─────────────────────────────────────────────────────────────────

/**
 * Reset all players' chips to startingChips and bring the table back to the
 * 'waiting' lobby so a fresh game can be started.
 * Only the host may trigger this.
 */
export async function resetGame(tableId: string, hostPlayerId: string): Promise<ActionResult> {
  const parsed = ResetGameSchema.safeParse({ tableId, hostPlayerId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lock = await acquireLock(parsed.data.tableId).catch(() => null);
  if (!lock) return { error: 'Table is busy — please try again shortly.' };

  try {
    const table = await getTable(parsed.data.tableId);
    if (!table) return { error: 'Table not found.' };

    try {
      assertIsHost(table, parsed.data.hostPlayerId);
    } catch (e) {
      return { error: (e as Error).message };
    }

    if (table.state !== 'ended') {
      return { error: 'Game is still in progress.' };
    }

    const resetPlayers: Record<string, Player> = {};
    for (const [id, player] of Object.entries(table.players)) {
      resetPlayers[id] = { ...player, chips: table.settings.startingChips, status: 'active' };
    }

    const updatedTable = updateTable(table, {
      state: 'waiting',
      players: resetPlayers,
      gameState: null,
    });

    await setTable(updatedTable);
    await publishTableUpdated(updatedTable.id, buildPublicTable(updatedTable, null)).catch(() => null);

    return {};
  } catch {
    return { error: 'Failed to reset game. Please try again.' };
  } finally {
    await releaseLock(lock);
  }
}
