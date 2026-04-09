'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher/client';
import type { PlayerHandPayload } from '@/lib/pusher/server';
import type { GameState, PlayerAction, HandEndResult } from '@/types/game';

type FilteredGameState = Omit<GameState, 'deck'> & { deck: null };

export interface GameStateData {
  gameState: FilteredGameState | null;
  myHoleCards: PlayerHandPayload['holeCards'] | null;
  lastAction: PlayerAction | null;
  handEndResult: HandEndResult | null;
  isConnected: boolean;
}

/**
 * Subscribe to Pusher channels and maintain live game state.
 *
 * @param tableId  - The table to subscribe to
 * @param playerId - The current player's ID (or null if spectating)
 * @param initialState - Optional server-rendered initial game state
 */
export function useGameState(
  tableId: string | null,
  playerId: string | null,
  initialState?: FilteredGameState | null,
): GameStateData {
  const [gameState, setGameState] = useState<FilteredGameState | null>(initialState ?? null);
  const [myHoleCards, setMyHoleCards] = useState<PlayerHandPayload['holeCards'] | null>(null);
  const [lastAction, setLastAction] = useState<PlayerAction | null>(null);
  const [handEndResult, setHandEndResult] = useState<HandEndResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ref so Pusher callbacks always see the latest hole cards without stale closure issues
  const holeCardsRef = useRef<PlayerHandPayload['holeCards'] | null>(null);

  const subscribe = useCallback(() => {
    if (!tableId) return;

    const pusher = getPusherClient();
    const tableChannelName = `presence-table-${tableId}`;

    // Subscribe to the public presence channel for game state broadcasts
    const tableChannel: Channel = pusher.subscribe(tableChannelName);

    tableChannel.bind('pusher:subscription_succeeded', () => {
      setIsConnected(true);
    });

    tableChannel.bind('pusher:subscription_error', () => {
      setIsConnected(false);
    });

    tableChannel.bind('game:state-update', (state: FilteredGameState) => {
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

    tableChannel.bind('game:started', () => {
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

  return { gameState, myHoleCards, lastAction, handEndResult, isConnected };
}
