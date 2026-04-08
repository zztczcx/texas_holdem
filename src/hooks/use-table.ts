'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Table } from '@/types/game';

interface UseTableResult {
  table: Table | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Poll the public table info endpoint for table metadata.
 * Also responds to Pusher-triggered refreshes when more players join.
 *
 * @param tableId - The table to load
 * @param pollInterval - How often to poll in ms (default: 5000). Set to 0 to disable.
 */
export function useTable(tableId: string | null, pollInterval = 5000): UseTableResult {
  const [table, setTable] = useState<Table | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tableId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/table/${tableId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Failed to load table.');
        return;
      }
      const data = (await res.json()) as Table;
      setTable(data);
    } catch {
      setError('Network error — could not load table.');
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Polling (useful as a fallback when Pusher is not available)
  useEffect(() => {
    if (!pollInterval || !tableId) return;
    const id = setInterval(() => void refresh(), pollInterval);
    return () => clearInterval(id);
  }, [pollInterval, tableId, refresh]);

  return { table, isLoading, error, refresh };
}
