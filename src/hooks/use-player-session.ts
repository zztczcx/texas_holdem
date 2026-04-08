'use client';

import { useState } from 'react';

let _sessionId: string | null = null;

function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return Object.fromEntries(
    document.cookie.split('; ').map((c) => {
      const [k, ...rest] = c.split('=');
      return [k ?? '', decodeURIComponent(rest.join('='))];
    }),
  );
}

/**
 * Returns the current player's session ID from browser cookies.
 * The server sets non-httpOnly `player_id` and `session_id` cookies
 * alongside the httpOnly session cookie so client code can read identity.
 */
export function usePlayerSession(): { playerId: string | null; sessionId: string | null } {
  const [playerId] = useState<string | null>(() => {
    const cookies = parseCookies();
    return cookies['player_id'] ?? null;
  });

  const [sessionId] = useState<string | null>(() => {
    const cookies = parseCookies();
    const id = cookies['session_id'] ?? null;
    _sessionId = id;
    return id;
  });

  return { playerId, sessionId };
}

/** Synchronously get the cached session ID (after first render). */
export function getCachedSessionId(): string | null {
  return _sessionId;
}
