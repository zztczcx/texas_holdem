import Pusher from 'pusher-js';

// ── Singleton pattern ─────────────────────────────────────────────────────────

let _pusherClient: Pusher | null = null;

/**
 * Get the singleton Pusher browser client.
 * Must be called only in browser environments (Client Components).
 */
export function getPusherClient(): Pusher {
  if (typeof window === 'undefined') {
    throw new Error('getPusherClient() must be called in a browser environment');
  }

  if (!_pusherClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      throw new Error(
        'NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER must be set',
      );
    }

    _pusherClient = new Pusher(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
    });
  }

  return _pusherClient;
}

/**
 * Disconnect and reset the Pusher client.
 * Call on unmount or page cleanup.
 */
export function disconnectPusher(): void {
  if (_pusherClient) {
    _pusherClient.disconnect();
    _pusherClient = null;
  }
}
