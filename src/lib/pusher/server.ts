import Pusher from 'pusher';
import type {
  GameState,
  GameSyncSnapshot,
  HandEndEventPayload,
  Player,
  PlayerAction,
  PlayerHandEventPayload,
  PublicTable,
} from '../../types/game';

// ── Client singleton ──────────────────────────────────────────────────────────

let _pusher: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (!_pusher) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      throw new Error(
        'Pusher environment variables are required: ' +
          'PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER',
      );
    }

    _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  }
  return _pusher;
}

// ── Channel name helper ───────────────────────────────────────────────────────

export function tableChannel(tableId: string): string {
  return `presence-table-${tableId}`;
}

export function lobbyChannel(tableId: string): string {
  return `table-${tableId}`;
}

// ── Event payloads ────────────────────────────────────────────────────────────

export type TableStateUpdatePayload = GameSyncSnapshot;
export type PlayerHandPayload = PlayerHandEventPayload;
export type HandEndPayload = HandEndEventPayload;
export type TableUpdatedPayload = PublicTable;

export interface ShowdownPayload {
  hands: Record<string, GameState['playerHands'][string]>;
}

export interface PlayerJoinedPayload {
  player: Player;
}

export interface PlayerLeftPayload {
  playerId: string;
}

// ── Publish helpers ───────────────────────────────────────────────────────────

/**
 * Broadcast the filtered public game state + player data to all in the channel.
 * Sending players here (status, chips) avoids clients relying on stale server-render data.
 */
export async function publishStateUpdate(
  tableId: string,
  snapshot: GameSyncSnapshot,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'game:state-update', snapshot);
}

/**
 * Send a player's private hole cards to them via a user-specific channel.
 * We use a private channel named `private-player-{playerId}` so only that
 * player receives their own cards.
 */
export async function publishPlayerHand(
  playerId: string,
  payload: PlayerHandEventPayload,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(`private-player-${playerId}`, 'game:player-hand', payload);
}

/**
 * Broadcast a player action (for animation and audit trail).
 */
export async function publishAction(
  tableId: string,
  action: PlayerAction,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'game:action', action);
}

/**
 * Broadcast showdown — all remaining hole cards revealed.
 */
export async function publishShowdown(
  tableId: string,
  payload: ShowdownPayload,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'game:showdown', payload);
}

/**
 * Broadcast hand end results (winner, chip changes).
 */
export async function publishHandEnd(
  tableId: string,
  payload: HandEndEventPayload,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'game:hand-end', payload);
}

/**
 * Broadcast the latest public table snapshot for lobby updates.
 */
export async function publishTableUpdated(
  tableId: string,
  table: PublicTable,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(lobbyChannel(tableId), 'table:updated', table);
}

/**
 * Broadcast that a player joined the table.
 */
export async function publishPlayerJoined(
  tableId: string,
  player: Player,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'table:player-joined', { player });
}

/**
 * Broadcast that a player left the table.
 */
export async function publishPlayerLeft(
  tableId: string,
  playerId: string,
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'table:player-left', { playerId });
}

/**
 * Broadcast that the game has started.
 */
export async function publishGameStarted(tableId: string, revision: number): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(tableChannel(tableId), 'table:game-started', { revision });
}
