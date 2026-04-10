'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher/client';
import type { PublicTable } from '@/types/game';

interface UseTableResult {
  table: PublicTable | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Subscribe to lobby table metadata and resync on subscription / reconnect.
 *
 * @param tableId - The table to load
 * @param initialTable - Optional server-rendered lobby snapshot
 */
export function useTable(
  tableId: string | null,
  initialTable: PublicTable | null = null,
): UseTableResult {
  const [table, setTable] = useState<PublicTable | null>(initialTable);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisionRef = useRef(initialTable?.revision ?? -1);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const applyTable = useCallback((nextTable: PublicTable) => {
    if (nextTable.id !== tableId) {
      return;
    }

    if (nextTable.revision < revisionRef.current) {
      return;
    }

    revisionRef.current = nextTable.revision;
    setTable(nextTable);
    setError(null);
  }, [tableId]);

  const refresh = useCallback(async () => {
    if (!tableId) return;

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    setIsLoading(true);
    setError(null);
    const request = (async () => {
      try {
        const res = await fetch(`/api/table/${tableId}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? 'Failed to load table.');
          return;
        }

        const data = (await res.json()) as PublicTable;
        applyTable(data);
      } catch {
        setError('Network error — could not load table.');
      } finally {
        refreshInFlightRef.current = null;
        setIsLoading(false);
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  }, [applyTable, tableId]);

  useEffect(() => {
    if (!initialTable) {
      void refresh();
    }
  }, [initialTable, refresh]);

  useEffect(() => {
    if (!tableId) return;

    const pusher = getPusherClient();
    const connection = pusher.connection;
    const channelName = `table-${tableId}`;
    const channel: Channel = pusher.subscribe(channelName);

    const handleConnectionStateChange = (states: { previous: string; current: string }) => {
      if (states.current === 'connected') {
        void refresh();
      }
    };

    connection.bind('state_change', handleConnectionStateChange);

    channel.bind('pusher:subscription_succeeded', () => {
      void refresh();
    });

    channel.bind('table:updated', (payload: PublicTable) => {
      applyTable(payload);
    });

    return () => {
      connection.unbind('state_change', handleConnectionStateChange);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [applyTable, refresh, tableId]);

  return { table, isLoading, error, refresh };
}
