// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useTable } from './use-table';
import type { PublicTable, Player } from '@/types/game';

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

function makePlayer(id: string, seatIndex: number): Player {
  return {
    id,
    name: id === 'host-1' ? 'Alice' : 'Bob',
    seatIndex,
    chips: 1000,
    status: 'active',
    sessionId: `session-${id}`,
    joinedAt: 0,
  };
}

function makeTable(revision: number, players: Record<string, Player>): PublicTable {
  return {
    id: 'abc123',
    hostPlayerId: 'host-1',
    state: 'waiting',
    revision,
    settings: {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      maxRaises: 4,
      ante: 0,
      turnTimerSeconds: 0,
      maxPlayers: 6,
      allowBuyBack: false,
      buyBackAmount: 0,
    },
    players,
    gameState: null,
    createdAt: 0,
    updatedAt: revision,
  };
}

describe('useTable', () => {
  it('refreshes immediately when the table subscription succeeds', async () => {
    const initialTable = makeTable(1, {
      'host-1': makePlayer('host-1', 0),
    });
    const refreshedTable = makeTable(2, {
      'host-1': makePlayer('host-1', 0),
      'p2': makePlayer('p2', 1),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => refreshedTable,
    } as Response);

    const { result } = renderHook(() => useTable('abc123', initialTable));

    await waitFor(() => {
      expect(mockPusher.hasChannel('presence-table-abc123')).toBe(true);
    });

    act(() => {
      mockPusher.channel('presence-table-abc123').emit('pusher:subscription_succeeded');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/table/abc123', { cache: 'no-store' });
    });

    await waitFor(() => {
      expect(result.current.table?.revision).toBe(2);
    });

    expect(Object.keys(result.current.table?.players ?? {})).toHaveLength(2);
  });

  it('applies newer table updates and ignores stale ones', async () => {
    const initialTable = makeTable(3, {
      'host-1': makePlayer('host-1', 0),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => initialTable,
    } as Response);

    const { result } = renderHook(() => useTable('abc123', initialTable));

    await waitFor(() => {
      expect(mockPusher.hasChannel('presence-table-abc123')).toBe(true);
    });

    const tableChannel = mockPusher.channel('presence-table-abc123');

    act(() => {
      tableChannel.emit('table:updated', makeTable(5, {
        'host-1': makePlayer('host-1', 0),
        'p2': makePlayer('p2', 1),
      }));
    });

    await waitFor(() => {
      expect(result.current.table?.revision).toBe(5);
    });

    act(() => {
      tableChannel.emit('table:updated', makeTable(4, {
        'host-1': makePlayer('host-1', 0),
      }));
    });

    expect(result.current.table?.revision).toBe(5);
    expect(Object.keys(result.current.table?.players ?? {})).toHaveLength(2);
  });
});