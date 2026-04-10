// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useGameState } from './use-game-state';
import type { Card, FilteredGameState, GameSyncSnapshot, Player } from '@/types/game';

type Handler<T = unknown> = (payload: T) => void;

class MockConnection {
  private handlers = new Map<string, Set<Handler>>();

  bind(eventName: string, handler: Handler): void {
    const handlers = this.handlers.get(eventName) ?? new Set<Handler>();
    handlers.add(handler);
    this.handlers.set(eventName, handlers);
  }

  unbind(eventName: string, handler: Handler): void {
    this.handlers.get(eventName)?.delete(handler);
  }

  emit(eventName: string, payload: unknown): void {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(payload);
    }
  }

  reset(): void {
    this.handlers.clear();
  }
}

class MockChannel {
  private handlers = new Map<string, Set<Handler>>();

  bind(eventName: string, handler: Handler): void {
    const handlers = this.handlers.get(eventName) ?? new Set<Handler>();
    handlers.add(handler);
    this.handlers.set(eventName, handlers);
  }

  unbind(eventName: string, handler?: Handler): void {
    if (!handler) {
      this.handlers.delete(eventName);
      return;
    }

    this.handlers.get(eventName)?.delete(handler);
  }

  unbind_all(): void {
    this.handlers.clear();
  }

  emit(eventName: string, payload?: unknown): void {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(payload);
    }
  }
}

class MockPusher {
  readonly connection = new MockConnection();
  private channels = new Map<string, MockChannel>();

  subscribe(channelName: string): MockChannel {
    const existing = this.channels.get(channelName);
    if (existing) {
      return existing;
    }

    const channel = new MockChannel();
    this.channels.set(channelName, channel);
    return channel;
  }

  unsubscribe(channelName: string): void {
    this.channels.delete(channelName);
  }

  channel(channelName: string): MockChannel {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Unknown channel: ${channelName}`);
    }

    return channel;
  }

  hasChannel(channelName: string): boolean {
    return this.channels.has(channelName);
  }

  reset(): void {
    this.channels.clear();
    this.connection.reset();
  }
}

const mockPusher = new MockPusher();
const mockFetch = vi.fn<typeof fetch>();

vi.mock('@/lib/pusher/client', () => ({
  getPusherClient: () => mockPusher,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockPusher.reset();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

const SELF_CARDS = [
  { rank: 'A', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
] as const satisfies readonly [Card, Card];

const NEXT_HAND_CARDS = [
  { rank: 'Q', suit: 'clubs' },
  { rank: 'J', suit: 'diamonds' },
] as const satisfies readonly [Card, Card];

function makePlayer(id: string, seatIndex: number): Player {
  return {
    id,
    name: id === 'p1' ? 'Alice' : 'Bob',
    seatIndex,
    chips: 1000,
    status: 'active',
    sessionId: `session-${id}`,
    joinedAt: 0,
  };
}

function makeFilteredState(
  handNumber: number,
  stage: FilteredGameState['stage'],
  myCards: readonly [Card, Card] | null,
): FilteredGameState {
  return {
    stage,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 1,
    currentSeatIndex: 0,
    pot: 30,
    sidePots: [],
    communityCards: [],
    deck: null,
    playerHands: {
      p1: { holeCards: myCards },
      p2: { holeCards: null },
    },
    currentBet: 20,
    raiseCount: 0,
    minimumRaise: 20,
    bettingRound: { bets: {}, actedPlayers: new Set<string>() },
    lastAction: null,
    handNumber,
  } as unknown as FilteredGameState;
}

function makeSnapshot(options: {
  revision: number;
  handNumber: number;
  stage: FilteredGameState['stage'];
  myCards?: readonly [Card, Card] | null;
}): GameSyncSnapshot {
  return {
    tableId: 'abc123',
    tableState: 'playing',
    revision: options.revision,
    updatedAt: options.revision,
    players: {
      p1: makePlayer('p1', 0),
      p2: makePlayer('p2', 1),
    },
    gameState: makeFilteredState(
      options.handNumber,
      options.stage,
      options.myCards ?? null,
    ),
  };
}

describe('useGameState', () => {
  it('ignores stale snapshots and preserves hole cards across later revisions in the same hand', async () => {
    const initialSnapshot = makeSnapshot({
      revision: 3,
      handNumber: 7,
      stage: 'flop',
      myCards: SELF_CARDS,
    });

    const { result } = renderHook(() =>
      useGameState(
        'abc123',
        'p1',
        initialSnapshot.tableState,
        initialSnapshot.revision,
        initialSnapshot.gameState,
        initialSnapshot.players,
      ),
    );

    await waitFor(() => {
      expect(mockPusher.hasChannel('presence-table-abc123')).toBe(true);
    });

    const tableChannel = mockPusher.channel('presence-table-abc123');

    act(() => {
      tableChannel.emit('game:state-update', makeSnapshot({
        revision: 5,
        handNumber: 7,
        stage: 'turn',
      }));
    });

    await waitFor(() => {
      expect(result.current.revision).toBe(5);
    });

    expect(result.current.gameState?.stage).toBe('turn');
    expect(result.current.gameState?.playerHands.p1?.holeCards).toEqual(SELF_CARDS);

    act(() => {
      tableChannel.emit('game:state-update', makeSnapshot({
        revision: 4,
        handNumber: 7,
        stage: 'river',
      }));
    });

    expect(result.current.revision).toBe(5);
    expect(result.current.gameState?.stage).toBe('turn');
    expect(result.current.gameState?.playerHands.p1?.holeCards).toEqual(SELF_CARDS);
  });

  it('refreshes immediately when the table subscription succeeds', async () => {
    const initialSnapshot = makeSnapshot({
      revision: 8,
      handNumber: 11,
      stage: 'river',
      myCards: SELF_CARDS,
    });

    const refreshedSnapshot = makeSnapshot({
      revision: 9,
      handNumber: 12,
      stage: 'pre-flop',
      myCards: NEXT_HAND_CARDS,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => refreshedSnapshot,
    } as Response);

    const { result } = renderHook(() =>
      useGameState(
        'abc123',
        'p1',
        initialSnapshot.tableState,
        initialSnapshot.revision,
        initialSnapshot.gameState,
        initialSnapshot.players,
      ),
    );

    await waitFor(() => {
      expect(mockPusher.hasChannel('presence-table-abc123')).toBe(true);
    });

    act(() => {
      mockPusher.channel('presence-table-abc123').emit('pusher:subscription_succeeded');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/table/abc123/state', { cache: 'no-store' });
    });

    await waitFor(() => {
      expect(result.current.revision).toBe(9);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.gameState?.handNumber).toBe(12);
    expect(result.current.gameState?.playerHands.p1?.holeCards).toEqual(NEXT_HAND_CARDS);
  });
});