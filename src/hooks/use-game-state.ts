'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher/client';
import type { PlayerHandPayload } from '@/lib/pusher/server';
import type { GameState, Player, PlayerAction, HandEndResult } from '@/types/game';

type FilteredGameState = Omit<GameState, 'deck'> & { deck: null };

// Shape of the game:state-update Pusher event (new format includes players)
interface TableStateUpdatePayload {
  gameState: FilteredGameState;
  players: Record<string, Player>;
}

// Shape of the /api/table/{tableId} polling response
interface PollResponse {
  players: Record<string, Player>;
  gameState: FilteredGameState | null;
}

export interface GameStateData {
  gameState: FilteredGameState | null;
  livePlayers: Record<string, Player>;
  myHoleCards: PlayerHandPayload['holeCards'] | null;
  lastAction: PlayerAction | null;
  handEndResult: HandEndResult | null;
  isConnected: boolean;
  /** Immediately fetch the latest game state from the server (Pusher fallback). */
  refresh: () => Promise<void>;
}

/**
 * Subscribe to Pusher channels and maintain live game state.
 *
 * @param tableId  - The table to subscribe to
 * @param playerId - The current player's ID (or null if spectating)
 * @param initialState - Optional server-rendered initial game state
 * @param initialPlayers - Optional server-rendered initial players
 */
export function useGameState(
  tableId: string | null,
  playerId: string | null,
  initialState?: FilteredGameState | null,
  initialPlayers?: Record<string, Player>,
): GameStateData {
  const [gameState, setGameState] = useState<FilteredGameState | null>(initialState ?? null);
  const [livePlayers, setLivePlayers] = useState<Record<string, Player>>(initialPlayers ?? {});
  const [myHoleCards, setMyHoleCards] = useState<PlayerHandPayload['holeCards'] | null>(null);
  const [lastAction, setLastAction] = useState<PlayerAction | null>(null);
  const [handEndResult, setHandEndResult] = useState<HandEndResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ref so Pusher callbacks always see the latest hole cards without stale closure issues
  const holeCardsRef = useRef<PlayerHandPayload['holeCards'] | null>(null);

  // Seed hole cards from the server-rendered initial state.
  // Without this, the first game:state-update (which strips hole cards for security)
  // would overwrite the server-rendered cards before the private-channel event arrives.
  useEffect(() => {
    if (playerId && initialState && !holeCardsRef.current) {
      const hand = initialState.playerHands[playerId];
      if (hand?.holeCards) {
        holeCardsRef.current = hand.holeCards;
        setMyHoleCards(hand.holeCards);
      }
    }
    // Only run once on mount — deps intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fetch the latest game state from the server (HTTP polling fallback).
   * Updates both gameState and livePlayers. Used when Pusher events are delayed
   * or not delivered (transient network issues, subscription auth pending, etc.).
   */
  const refreshFromServer = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await fetch(`/api/table/${tableId}`);
      if (!res.ok) return;
      const data = (await res.json()) as PollResponse;

      if (data.players && Object.keys(data.players).length > 0) {
        setLivePlayers(data.players);
      }

      if (data.gameState) {
        const state = data.gameState;
        // Server includes our own hole cards in the response (filtered by session).
        // Update the ref so subsequent Pusher merges stay consistent.
        const serverCards = playerId ? state.playerHands[playerId]?.holeCards : null;
        if (serverCards) {
          holeCardsRef.current = serverCards;
          setMyHoleCards(serverCards);
        }

        setGameState(() => {
          const cards = holeCardsRef.current;
          if (cards && playerId) {
            return {
              ...state,
              playerHands: {
                ...state.playerHands,
                [playerId]: {
                  ...(state.playerHands[playerId] ?? {}),
                  holeCards: cards,
                },
              },
            };
          }
          return state;
        });
      }
    } catch {
      // Silent — Pusher is the primary mechanism; polling is a fallback
    }
  }, [tableId, playerId]);

  // Polling fallback for observers: refresh every 3 seconds when Pusher events
  // are not delivered (auth delay, transient drops). 3s is acceptable for poker.
  useEffect(() => {
    const id = setInterval(() => void refreshFromServer(), 3_000);
    return () => clearInterval(id);
  }, [refreshFromServer]);

  const subscribe = useCallback(() => {
    if (!tableId) return;

    const pusher = getPusherClient();
    const tableChannelName = `presence-table-${tableId}`;

    const tableChannel: Channel = pusher.subscribe(tableChannelName);

    tableChannel.bind('pusher:subscription_succeeded', () => {
      setIsConnected(true);
    });

    tableChannel.bind('pusher:subscription_error', () => {
      setIsConnected(false);
    });

    tableChannel.bind('game:state-update', (payload: TableStateUpdatePayload) => {
      const { gameState: state, players } = payload;

      // Update live players when provided
      if (players && Object.keys(players).length > 0) {
        setLivePlayers(players);
      }

      // Re-inject the current player's hole cards — public broadcasts intentionally
      // strip them to preserve security; the private channel is the source of truth.
      setGameState(() => {
        const cards = holeCardsRef.current;
        if (cards && playerId) {
          return {
            ...state,
            playerHands: {
              ...state.playerHands,
              [playerId]: {
                ...(state.playerHands[playerId] ?? {}),
                holeCards: cards,
              },
            },
          };
        }
        return state;
      });
    });

    tableChannel.bind('game:action', (action: PlayerAction) => {
      setLastAction(action);
    });

    tableChannel.bind('game:hand-end', (result: HandEndResult) => {
      setHandEndResult(result);
      // Clear stale hole cards; new hand will deliver fresh ones via private channel
      holeCardsRef.current = null;
      setMyHoleCards(null);
    });

    tableChannel.bind('table:game-started', () => {
      setHandEndResult(null);
      setLastAction(null);
      // Clear hole cards on start — private channel delivers them right after
      holeCardsRef.current = null;
      setMyHoleCards(null);
    });

    let privateChannel: Channel | null = null;

    // Subscribe to private channel for hole cards (own player only)
    if (playerId) {
      const privateChannelName = `private-player-${playerId}`;
      privateChannel = pusher.subscribe(privateChannelName);

      privateChannel.bind('game:player-hand', (payload: PlayerHandPayload) => {
        if (payload.playerId === playerId) {
          holeCardsRef.current = payload.holeCards;
          setMyHoleCards(payload.holeCards);
          // Immediately merge into the current game state so the table re-renders
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              playerHands: {
                ...prev.playerHands,
                [playerId]: {
                  ...(prev.playerHands[playerId] ?? {}),
                  holeCards: payload.holeCards,
                },
              },
            };
          });
        }
      });
    }

    return () => {
      tableChannel.unbind_all();
      pusher.unsubscribe(tableChannelName);
      if (playerId && privateChannel) {
        privateChannel.unbind_all();
        pusher.unsubscribe(`private-player-${playerId}`);
      }
      setIsConnected(false);
    };
  }, [tableId, playerId]);

  useEffect(() => {
    const cleanup = subscribe();
    return cleanup ?? undefined;
  }, [subscribe]);

  return { gameState, livePlayers, myHoleCards, lastAction, handEndResult, isConnected, refresh: refreshFromServer };
}
