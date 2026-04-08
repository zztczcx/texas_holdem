---
description: "Security and validation rules for Server Actions and API route handlers"
applyTo: ["src/app/actions.ts", "src/app/api/**"]
---

# Server Security Instructions

These files are **trust boundaries** — code here is called directly from the network.
Every rule below is mandatory. There are no exceptions.

## Input Validation

**Validate ALL inputs with Zod before touching them.**

```ts
import { z } from "zod";

const schema = z.object({ tableId: z.string().nanoid(), amount: z.number().int().positive() });
const parsed = schema.safeParse(rawInput);
if (!parsed.success) return { error: "Invalid input" };
```

Never pass raw `FormData`, query params, or request body to game logic.
Use `src/lib/utils/validate.ts` helpers for shared schemas.

## Hole Card Security (CRITICAL)

**NEVER include a player's hole cards in a response sent to any other player.**

When building the game state object for a client:
1. Fetch the full `GameState` from KV
2. Call a filter function that replaces other players' `holeCards` with `null` (or omits them)
3. Only then serialize to JSON and return

Violating this rule leaks private information and breaks the game.

## Atomic State Mutations

All game state mutations must use an **atomic lock** pattern to prevent race conditions:

```ts
import { acquireLock, releaseLock } from "@/lib/db/kv";

const lock = await acquireLock(tableId);
try {
  const state = await getGameState(tableId);
  const next = applyAction(state, action);
  await saveGameState(tableId, next);
} finally {
  await releaseLock(lock);
}
```

Never read-modify-write without a lock.

## Rate Limiting

All public API routes and Server Actions that mutate state must be rate-limited:

```ts
import { ratelimit } from "@/lib/utils/ratelimit";

const { success } = await ratelimit.limit(playerId);
if (!success) return { error: "Too many requests" };
```

## Environment Variables

Never hardcode secrets, API keys, or KV URLs.
Access them only via `process.env.VARIABLE_NAME` and document them in `.env.example`.

## Error Responses

- Return `{ error: string }` for expected failures — never throw to the client
- Log unexpected errors server-side; return a generic message to the client
- Never leak stack traces, internal IDs, or database errors in responses

## CSRF

Server Actions have built-in CSRF protection in Next.js — do not bypass it.
For custom API routes, verify the `Origin` header matches the expected host.
