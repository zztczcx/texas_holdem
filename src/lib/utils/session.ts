import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE = 'poker_session';
const COOKIE_MAX_AGE = 3 * 60 * 60; // 3 hours in seconds

/**
 * Get the current player's session ID from the cookie, creating one if absent.
 * This is a server-side function — call only in Server Components or Server Actions.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE);
  if (existing?.value) {
    return existing.value;
  }

  const sessionId = uuidv4();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  return sessionId;
}

/**
 * Read the session ID from the cookie without creating one.
 * Returns null if no session exists.
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}
