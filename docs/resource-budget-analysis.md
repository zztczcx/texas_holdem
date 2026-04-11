# Resource Budget Analysis

> Last updated: April 2026  
> Status: **On free tier — safe for a small friend group, watch limits if going wider public**

This document tracks the command/message budgets for Upstash Redis and Pusher so we can
revisit the design before costs become a problem.

---

## 1. Upstash Redis

### Free-tier limits

| Metric | Limit |
|--------|-------|
| Commands per month | **500,000** |
| Data size | 256 MB |
| Bandwidth | 10 GB |
| Databases | 1 |

### Redis commands per Server Action

Every action hits Redis for game state (KV) **and** optionally for rate limiting (RL).

| Operation | KV commands | RL commands | Total |
|-----------|------------|-------------|-------|
| `createTable` | 2 (SET table + SET session) | 2 | **4** |
| `joinTable` | 6 (SET NX lock + GET + SET + SET session + GET + DEL lock) | 2 | **8** |
| `startGame` | 5 (lock acquire + GET + SET + lock release) | 2 | **7** |
| `performAction` (mid-hand) | 5 | 2 | **7** |
| `performAction` (hand-end) | 5 | 2 | **7** |
| `buyBack` | 5 | 2 | **7** |
| `kickPlayer` | 5 | 2 | **7** |
| `resetGame` | 5 | 2 | **7** |
| GET `/api/table/[tableId]` | 1 (GET only) | 0 ← removed | **1** |

> **Note on RL command cost:** `@upstash/ratelimit` sliding window runs a Lua EVAL
> that internally executes ZADD + ZREMRANGEBYSCORE + ZCARD + EXPIRE. Upstash bills each
> sub-command within a script, so each `.limit()` call costs approximately **2–3 commands**.
> The table above uses 2 as a conservative estimate. If Upstash counts 3, multiply RL
> columns by 1.5×.

> **Why GET /api has no RL:** The HTTP polling route was intentionally left without rate
> limiting because (a) `use-table.ts` already debounces polls via `refreshInFlightRef`,
> (b) the GET is read-only (no Pusher, no write), and (c) adding RL would burn 2–3 Redis
> commands on every poll for no security gain. Each poll already costs only 1 GET command.

### Commands per typical hand

Assumptions: 6 players, 20 betting actions per hand.

| Event | Commands |
|-------|----------|
| Setup: 1 `createTable` + 5 `joinTable` | 4 + (8 × 5) = **44** |
| `startGame` | **7** |
| 20 `performAction` rounds | 7 × 20 = **140** |
| **Total per hand** | **~191** |

At hand-end, `startGame` for the next hand costs another 7 — so ongoing hands after setup
cost ~147 each.

### Monthly command budget scenarios

| Scenario | Sessions/month | Hands/session | Commands/month | % of 500K |
|----------|---------------|---------------|----------------|-----------|
| 5 friends, weekend only | 8 | 20 hands | 8 × (44 + 20×147) ≈ **24K** | **4.8%** ✅ |
| 10 active users, 3×/week | 12 | 30 hands | 12 × (44 + 30×147) ≈ **53K** | **11%** ✅ |
| 50 concurrent users (8 tables) | 30 | 25 hands | 30 × (44 + 25×147) ≈ **111K** | **22%** ✅ |
| 200 concurrent users (33 tables) | 120 | 25 hands | 120 × (44 + 25×147) ≈ **444K** | **89%** ⚠️ |
| 300+ concurrent users | >150 | 25 hands | >555K | **>111%** ❌ |

**Bottom line for free tier:** Safe up to ~150–180 sessions/month (roughly 30–50 concurrent
active users). Beyond that, upgrade to Pay-as-you-go ($0.20 per 100K commands).

### Rate limiter overhead

The rate limiter adds ~2 commands per action call. Across 20 actions/hand, that's 40 extra
commands — a **~29% overhead** over pure KV usage. If the Redis budget becomes tight:

**Option A — Add `ephemeralCache` (recommended first step):**
```ts
// In ratelimit.ts — add ephemeralCache: new Map() to each Ratelimit constructor
new Ratelimit({
  redis: makeRedis(),
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  ephemeralCache: new Map(),  // ← serves repeat identifiers from memory on warm instances
  prefix: 'ratelimit:poker:action',
});
```
On warm Vercel functions (the common case), this cuts RL Redis calls dramatically for
burst traffic from the same player. The singleton `_action` persists across warm
invocations, so the in-memory cache is reused.

**Option B — Remove `performAction` rate limiter:**
The game engine (`applyAction`) already rejects invalid/out-of-turn actions before any
Redis write occurs. The action rate limiter only defends against a player hammering valid
actions (e.g., spam-calling `performAction` 60×/min). If the UI disables the button while
waiting for the server response (it does, via `isActing` state), this threat is minimal.
Removing `getActionRatelimit()` from `performAction` saves ~40 commands/hand.

**Option C — Upgrade to Pay-as-you-go when sessions exceed ~150/month.**
At 200K commands/month extra, cost is $0.40. Not worth optimizing code for.

---

## 2. Pusher

### Free-tier limits (Sandbox plan)

| Metric | Limit |
|--------|-------|
| Messages per day | **200,000** |
| Concurrent connections | **100** |
| Channels | Unlimited |

### Pusher messages per Server Action

| Action | Messages fired |
|--------|---------------|
| `joinTable` | 2 (`table:updated` + `player:joined`) |
| `startGame` | 2 + N (`table:updated` + `game:started` + hole cards per player) |
| `performAction` (mid-hand) | 2 (`game:action` + `game:state-update`) |
| `performAction` (hand-end) | 2 + N (`game:action` + `game:hand-end` + hole cards for next deal) |
| `kickPlayer` | 2 (`table:updated` + `player:left`) |
| `resetGame` | 2 (`game:hand-end` + `game:state-update`) |

**Critical insight:** A Pusher message is only sent after the game engine validation passes.
An invalid action (wrong turn, bad amount, etc.) returns an error from `applyAction()` and
fires **zero** Pusher messages. The rate limiter allows up to 60 action attempts/min per
player, but the vast majority of rapid/invalid requests are rejected before touching Pusher.

### Messages per typical hand (6 players)

| Phase | Messages |
|-------|----------|
| 5 joins | 2 × 5 = 10 |
| `startGame` | 2 + 6 = 8 |
| 20 `performAction` mid-hand | 2 × 20 = 40 |
| 1 `performAction` hand-end + next deal | 2 + 6 = 8 |
| **Per hand** | **~56** |
| **Per 10-hand session** | ~530 |

### Daily message budget scenarios

| Scenario | Sessions/day | Messages/day | % of 200K |
|----------|-------------|--------------|-----------|
| 5 friends, 1 session | 1 | ~530 | **0.3%** ✅ |
| 8 tables active simultaneously | 8 | ~4,240 | **2.1%** ✅ |
| 30 tables (180 concurrent players) | 30 | ~15,900 | **8%** ✅ |
| 100 tables (600 concurrent players) | 100 | ~53,000 | **27%** ✅ |
| 350+ tables | 350 | ~186K+ | **~93%** ⚠️ |

**Bottom line for Pusher:** Messages are not the bottleneck. **Concurrent connections are.**
Pusher free = 100 concurrent connections. At 6 players/table that's only **16 simultaneous
tables**. Once more than ~16 tables are active at the same moment, new connection attempts
will fail or be queued.

### Rate limits and Pusher: no interaction

The rate limiters (Upstash checks) run **before** any Pusher trigger. They are separate
services. When a request is rate-limited, `checkRateLimit()` returns early without calling
any Pusher `publish*` function. Rate limiting cannot cause excess Pusher usage.

---

## 3. Decision Matrix

| Trigger | Action |
|---------|--------|
| Monthly Redis commands approach 400K | Add `ephemeralCache` to all 3 rate limiters |
| Monthly Redis commands approach 480K | Upgrade to Pay-as-you-go (~$0.40–$1.00/month) |
| Concurrent Pusher connections > 60 | Upgrade Pusher to Starter plan ($19/month, 500 connections) |
| Daily Pusher messages > 150K | (Very unlikely) Upgrade Pusher plan |
| Sessions/month > 300 | Both Redis and Pusher need attention |

---

## 4. Current Design Summary

```
Action call
  └── getRequestIp()           [try/catch — safe in tests]
  └── getXxxRatelimit().limit() → 2 Redis commands (Upstash RL)
  └── acquireLock()            → 1 Redis SET NX
  └── getTable()               → 1 Redis GET
  └── [game engine logic]      → 0 Redis
  └── setTable()               → 1 Redis SET
  └── publish*()               → 1+ Pusher messages
  └── releaseLock()            → 1 Redis GET + 1 Redis DEL
                                 ─────────────────────────
                                 Total: ~7 Redis + ~2 Pusher

GET /api/table/[tableId]       → 1 Redis GET, 0 Pusher, 0 RL
```

The GET route was deliberately **not** rate-limited (removed after initial implementation)
because each poll is already debounced by `refreshInFlightRef` in `use-table.ts` and
adding RL would cost more Redis commands than the endpoint itself uses.
