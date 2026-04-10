'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher/client';
import type {
  FilteredGameState,
  GameSyncSnapshot,
  HandEndEventPayload,
  HandEndResult,
  Player,
  PlayerAction,
  PlayerHandEventPayload,
  TableState,
} from '@/types/game';

export interface GameStateData {
  tableState: TableState;
  revision: number;
  gameState: FilteredGameState | null;
  livePlayers: Record<string, Player>;
  myHoleCards: PlayerHandEventPayload['holeCards'] | null;
  lastAction: PlayerAction | null;
  handEndResult: HandEndResult | null;
  isConnected: boolean;
  /** Immediately fetch the latest game state from the server. */
  refresh: () => Promise<void>;
  applySnapshot: (snapshot: GameSyncSnapshot) => void;
  applyHandEndResult: (payload: HandEndEventPayload) => void;
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
  initialTableState: TableState,
  initialRevision: number,
  initialState?: FilteredGameState | null,
  initialPlayers?: Record<string, Player>,
): GameStateData {
  const [tableState, setTableState] = useState<TableState>(initialTableState);
  const [revision, setRevision] = useState(initialRevision);
  const [gameState, setGameState] = useState<FilteredGameState | null>(initialState ?? null);
  const [livePlayers, setLivePlayers] = useState<Record<string, Player>>(initialPlayers ?? {});
  const [myHoleCards, setMyHoleCards] = useState<PlayerHandEventPayload['holeCards'] | null>(null);
  const [lastAction, setLastAction] = useState<PlayerAction | null>(null);
  const [handEndResult, setHandEndResult] = useState<HandEndResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const revisionRef = useRef(initialRevision);
  const currentHandNumberRef = useRef<number | null>(initialState?.handNumber ?? null);
  const holeCardsRef = useRef<PlayerHandEventPayload['holeCards'] | null>(null);
  const holeCardsHandNumberRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const mergeSnapshotHoleCards = useCallback((state: FilteredGameState | null): FilteredGameState | null => {
    if (!state || !playerId) {
      return state;
    }

    const cards = holeCardsRef.current;
    if (!cards || holeCardsHandNumberRef.current !== state.handNumber) {
      return state;
    }

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
  }, [playerId]);

  const applyHandEndResult = useCallback((payload: HandEndEventPayload) => {
    if (payload.revision < revisionRef.current) {
      return;
    }

    setHandEndResult(payload.result);
  }, []);

  const applySnapshot = useCallback((snapshot: GameSyncSnapshot) => {
    if (!tableId || snapshot.tableId !== tableId) {
      return;
    }

    if (snapshot.revision < revisionRef.current) {
      return;
    }

    revisionRef.current = snapshot.revision;
    setRevision(snapshot.revision);
    setTableState(snapshot.tableState);
    setLivePlayers(snapshot.players);

    const nextHandNumber = snapshot.gameState?.handNumber ?? null;
    currentHandNumberRef.current = nextHandNumber;

    const serverCards = playerId && snapshot.gameState
      ? snapshot.gameState.playerHands[playerId]?.holeCards ?? null
      : null;

    if (serverCards && nextHandNumber !== null) {
      holeCardsRef.current = serverCards;
      holeCardsHandNumberRef.current = nextHandNumber;
      setMyHoleCards(serverCards);
    } else if (nextHandNumber === null || holeCardsHandNumberRef.current !== nextHandNumber) {
      setMyHoleCards(null);
    }

    setGameState(mergeSnapshotHoleCards(snapshot.gameState));
  }, [mergeSnapshotHoleCards, playerId, tableId]);

  const refreshFromServer = useCallback(async () => {
    if (!tableId) return;
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const request = (async () => {
      try {
        const res = await fetch(`/api/table/${tableId}/state`, { cache: 'no-store' });
        if (!res.ok) return;

        const snapshot = (await res.json()) as GameSyncSnapshot;
        applySnapshot(snapshot);
      } catch {
        // Silent — this is a recovery path.
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  }, [applySnapshot, tableId]);

  useEffect(() => {
    if (playerId && initialState && !holeCardsRef.current) {
      const hand = initialState.playerHands[playerId];
      if (hand?.holeCards) {
        holeCardsRef.current = hand.holeCards;
        holeCardsHandNumberRef.current = initialState.handNumber;
        setMyHoleCards(hand.holeCards);
      }
    }
  }, [initialState, playerId]);

  const subscribe = useCallback(() => {
    if (!tableId) return;

    const pusher = getPusherClient();
    const connection = pusher.connection;
    const tableChannelName = `presence-table-${tableId}`;

    const tableChannel: Channel = pusher.subscribe(tableChannelName);

    const handleConnectionStateChange = (states: { previous: string; current: string }) => {
      if (states.current !== 'connected') {
        setIsConnected(false);
        void refreshFromServer();
      }
    };

    connection.bind('state_change', handleConnectionStateChange);

    tableChannel.bind('pusher:subscription_succeeded', () => {
      setIsConnected(true);
      void refreshFromServer();
    });

    tableChannel.bind('pusher:subscription_error', () => {
      setIsConnected(false);
      void refreshFromServer();
    });

    tableChannel.bind('game:state-update', (payload: GameSyncSnapshot) => {
      applySnapshot(payload);

      if (
        playerId &&
        payload.gameState?.stage === 'pre-flop' &&
        holeCardsHandNumberRef.current !== payload.gameState.handNumber
      ) {
        void refreshFromServer();
      }
    });

    tableChannel.bind('game:action', (action: PlayerAction) => {
      setLastAction(action);
    });

    tableChannel.bind('game:hand-end', (payload: HandEndEventPayload) => {
      applyHandEndResult(payload);
    });

    tableChannel.bind('table:game-started', () => {
      setHandEndResult(null);
      setLastAction(null);
    });

    let privateChannel: Channel | null = null;

    // Subscribe to private channel for hole cards (own player only)
    if (playerId) {
      const privateChannelName = `private-player-${playerId}`;
      privateChannel = pusher.subscribe(privateChannelName);

      privateChannel.bind('game:player-hand', (payload: PlayerHandEventPayload) => {
        if (payload.playerId === playerId) {
          if (
            currentHandNumberRef.current !== null &&
            payload.handNumber < currentHandNumberRef.current
          ) {
            return;
          }

          holeCardsRef.current = payload.holeCards;
          holeCardsHandNumberRef.current = payload.handNumber;
          setMyHoleCards(payload.holeCards);

          setGameState((prev) => {
            if (!prev || prev.handNumber !== payload.handNumber) {
              return prev;
            }

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
      connection.unbind('state_change', handleConnectionStateChange);
      tableChannel.unbind_all();
      pusher.unsubscribe(tableChannelName);
      if (playerId && privateChannel) {
        privateChannel.unbind_all();
        pusher.unsubscribe(`private-player-${playerId}`);
      }
      setIsConnected(false);
    };
  }, [
    applyHandEndResult,
    applySnapshot,
    playerId,
    refreshFromServer,
    tableId,
  ]);

  useEffect(() => {
    const cleanup = subscribe();
    return cleanup ?? undefined;
  }, [subscribe]);

  return {
    tableState,
    revision,
    gameState,
    livePlayers,
    myHoleCards,
    lastAction,
    handEndResult,
    isConnected,
    refresh: refreshFromServer,
    applySnapshot,
    applyHandEndResult,
  };
}
