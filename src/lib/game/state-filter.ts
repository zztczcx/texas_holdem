import type {
  FilteredGameState,
  GameSyncSnapshot,
  GameState,
  Player,
  PublicTable,
  Table,
  WinnerResult,
} from '../../types/game';

/**
 * Build a game state safe to send to a specific player (or the public).
 *
 * - Community cards, pot, stage, and player metadata: always included
 * - Hole cards: only included for the requesting player
 * - Other players' hole cards: NEVER included (security critical)
 */
export function filterGameStateForPlayer(
  state: GameState,
  requestingPlayerId: string | null,
): FilteredGameState {
  const filteredHands: Record<string, { holeCards: null | typeof state.playerHands[string]['holeCards']; bestHand?: typeof state.playerHands[string]['bestHand'] }> = {};

  for (const [playerId, hand] of Object.entries(state.playerHands)) {
    if (playerId === requestingPlayerId) {
      // Requesting player sees their own cards
      filteredHands[playerId] = hand;
    } else if (state.stage === 'showdown') {
      // At showdown, all remaining hands are revealed
      filteredHands[playerId] = hand;
    } else {
      // Other players: hide hole cards
      filteredHands[playerId] = { holeCards: null, bestHand: hand.bestHand };
    }
  }

  return {
    ...state,
    deck: null,               // Never send the deck to clients
    playerHands: filteredHands as GameState['playerHands'],
  };
}

/**
 * Build a public view of the table (no hole cards, no deck).
 */
export function buildPublicTable(
  table: Table,
  requestingPlayerId: string | null,
): PublicTable {
  return {
    ...table,
    gameState: table.gameState
      ? filterGameStateForPlayer(table.gameState, requestingPlayerId)
      : null,
  };
}

/**
 * Build the authoritative in-game snapshot sent to subscribed clients.
 */
export function buildGameSyncSnapshot(
  table: Table,
  requestingPlayerId: string | null,
): GameSyncSnapshot {
  return {
    tableId: table.id,
    tableState: table.state,
    revision: table.revision,
    updatedAt: table.updatedAt,
    players: table.players,
    gameState: table.gameState
      ? filterGameStateForPlayer(table.gameState, requestingPlayerId)
      : null,
  };
}

/**
 * Validate that a player is the host of a table.
 */
export function assertIsHost(table: Table, playerId: string): void {
  if (table.hostPlayerId !== playerId) {
    throw new Error('Only the host can perform this action');
  }
}

/**
 * Validate that a player exists in the table.
 */
export function assertPlayerInTable(table: Table, playerId: string): Player {
  const player = table.players[playerId];
  if (!player) {
    throw new Error('Player not found in this table');
  }
  return player;
}

/**
 * Calculate updated chip counts after a hand ends.
 */
export function applyWinnings(
  players: Record<string, Player>,
  bets: Record<string, number>,
  winners: readonly WinnerResult[],
): Record<string, Player> {
  const updated: Record<string, Player> = { ...players };

  // Deduct bets from all players
  for (const [playerId, betAmount] of Object.entries(bets)) {
    const player = updated[playerId];
    if (player) {
      updated[playerId] = { ...player, chips: player.chips - betAmount };
    }
  }

  // Award winnings to winners
  for (const winner of winners) {
    const player = updated[winner.playerId];
    if (player) {
      updated[winner.playerId] = { ...player, chips: player.chips + winner.amount };
    }
  }

  return updated;
}
