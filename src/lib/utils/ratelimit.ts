import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function makeRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis environment variables are required for rate limiting. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local',
    );
  }

  return new Redis({ url, token });
}

// Singleton limiters (lazily created)
let _createJoin: Ratelimit | null = null;
let _action: Ratelimit | null = null;
let _api: Ratelimit | null = null;

/** 10 create/join requests per minute per IP — tight to deter account farming */
export function getCreateJoinRatelimit(): Ratelimit {
  if (!_createJoin) {
    _createJoin = new Ratelimit({
      redis: makeRedis(),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'ratelimit:poker:createjoin',
    });
  }
  return _createJoin;
}

/** 60 game-action requests per minute per player ID */
export function getActionRatelimit(): Ratelimit {
  if (!_action) {
    _action = new Ratelimit({
      redis: makeRedis(),
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'ratelimit:poker:action',
    });
  }
  return _action;
}

/** 120 API poll requests per minute per IP */
export function getApiRatelimit(): Ratelimit {
  if (!_api) {
    _api = new Ratelimit({
      redis: makeRedis(),
      limiter: Ratelimit.slidingWindow(120, '60 s'),
      prefix: 'ratelimit:poker:api',
    });
  }
  return _api;
}

// ── Backwards-compatible helpers ──────────────────────────────────────────────

/** @deprecated Use the tiered helpers above. */
export function getRatelimit(): Ratelimit {
  return getActionRatelimit();
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const rl = getActionRatelimit();
  const { success } = await rl.limit(identifier);
  return success;
}
