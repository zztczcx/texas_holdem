import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter for server actions.
 * 30 requests per 10 seconds per identifier.
 * Falls back to a no-op limiter when Redis env vars are not set.
 */
let _ratelimit: Ratelimit | null = null;

export function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Redis environment variables are required for rate limiting. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local',
      );
    }

    _ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(30, '10 s'),
      prefix: 'ratelimit:poker',
    });
  }
  return _ratelimit;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const rl = getRatelimit();
  const { success } = await rl.limit(identifier);
  return success;
}
