# Texas Hold'em — GitHub Copilot Instructions

> **AI Agent Notice**: Before writing any Next.js code, read the bundled docs at
> `node_modules/next/dist/docs/` — your training data may be outdated.
> See `AGENTS.md` at the root for the canonical rule.

---

## Project Overview

An online multiplayer Texas Hold'em poker game built with **Next.js 16 (App Router)** and **TypeScript**, deployed to **Vercel**. Players can host or join tables using a share link or table number.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Real-time | WebSockets (via Pusher or Ably, or Vercel KV + polling for MVP) |
| State (server) | Vercel KV / Redis |
| State (client) | React Context + `useReducer` or Zustand |
| Auth | NextAuth.js v5 (or anonymous sessions with UUID) |
| Deployment | Vercel |
| Testing | Vitest + React Testing Library |
| Linting | ESLint (next/core-web-vitals + typescript-eslint) |

---

## TypeScript Rules

- Enable **`strict: true`** in `tsconfig.json` — never disable strict mode
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use explicit return types on exported functions and React components
- Never use `any` — use `unknown` and narrow with type guards
- Use `satisfies` operator for type-safe object literals
- Prefer readonly arrays (`readonly T[]`) for immutable data
- Use `as const` for constant objects and tuples
- Use `zod` for runtime validation at API boundaries

---

## Next.js App Router Rules

### File Conventions
- Pages: `src/app/**page.tsx`
- Layouts: `src/app/**/layout.tsx`
- API Routes: `src/app/api/**/route.ts`
- Server Actions: `src/app/**/actions.ts` (use `"use server"` directive)
- Client Components: Add `"use client"` directive only when needed (event handlers, browser APIs, React state/effects)
- All components default to **Server Components** unless interactivity requires `"use client"`

### Data Fetching
- Use `fetch` with `cache` options in Server Components — never `useEffect` for initial data
- Use `Server Actions` for mutations — not client-side fetch to API routes for forms
- Tag cache entries with `revalidateTag` for granular cache invalidation
- Stream long operations with React `Suspense` boundaries and `loading.tsx`

### Routing
- Collocate route segments with their components: `src/app/(game)/table/[tableId]/page.tsx`
- Use Route Groups `(folder)` to organize without affecting URL structure
- Use `generateStaticParams` for statically-known dynamic routes
- Prefer `<Link>` over `router.push` for navigation

### Metadata
- Export `metadata` or `generateMetadata` from every `page.tsx` and `layout.tsx`

---

## Component Architecture

```
src/
├── app/                    # Next.js App Router pages & layouts
│   ├── (home)/             # Landing / lobby pages
│   ├── (game)/             # Game table pages  
│   │   └── table/[tableId]/
│   └── api/                # API route handlers
├── components/
│   ├── ui/                 # Pure presentational components (cards, buttons, inputs)
│   ├── game/               # Game domain components (table, hand, player-seat, chips)
│   └── layout/             # Header, footer, navigation
├── lib/
│   ├── game/               # Core poker engine (pure functions, no React)
│   │   ├── deck.ts         # Card shuffling and deck management
│   │   ├── hand-evaluator.ts # Hand ranking logic
│   │   ├── game-state.ts   # Game state machine
│   │   └── betting.ts      # Betting round logic
│   ├── db/                 # Database/KV access layer
│   └── utils/              # Shared utilities
├── types/                  # Shared TypeScript types
│   ├── game.ts             # GameState, Player, Card, etc.
│   └── api.ts              # API request/response types
└── hooks/                  # Custom React hooks (client-side only)
```

---

## Design System (Pinterest-Inspired)

Refer to `docs/references/DESIGN.md` for the full design system.

### Core Principles
- **Warm canvas**: Background `#1a1a2e` (dark poker table green variant) with warm overlays
- **Accent color**: Deep green `#2d6a4f` (poker table felt) as primary, gold `#d4af37` for chips/wins
- **Typography**: System font stack — `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- **Border radius**: 16px buttons/inputs, 20px cards, 50% for circular elements (chips, avatars)
- **Spacing unit**: 8px base

### Color Tokens
```css
--color-felt: #2d6a4f;         /* Poker table primary */
--color-felt-dark: #1a3d2b;    /* Deep felt */
--color-gold: #d4af37;         /* Chips, wins, highlights */
--color-card-bg: #ffffff;      /* Card face */
--color-card-back: #1e3a5f;    /* Card back */
--color-text-primary: #f0ede8; /* Warm white text */
--color-text-muted: #a89f96;   /* Secondary text */
--color-danger: #e63946;       /* Fold, danger actions */
--color-success: #2d9e6b;      /* Win, pot award */
```

---

## Game Domain Rules

All core poker logic lives in `src/lib/game/` as **pure functions** (no side effects, no React, no I/O):

- `deck.ts` — `createDeck()`, `shuffle(deck)`, `dealCards(deck, n)`
- `hand-evaluator.ts` — `evaluateHand(cards)` → `HandResult`
- `game-state.ts` — `GameState` type, `createGame()`, `applyAction(state, action)` (pure reducer)
- `betting.ts` — `getValidActions(state, playerId)`, `applyBet(state, amount)`

### Game State Machine
Stages: `waiting → pre-flop → flop → turn → river → showdown → end`

---

## Real-Time Architecture

- Each table has a unique `tableId` (nanoid)
- Game state is persisted in **Vercel KV** (Redis)
- State changes broadcast via **Pusher** channels: `presence-table-{tableId}`
- Server Actions mutate state atomically; client subscribes to Pusher for live updates

---

## Security Rules (OWASP)

- Validate ALL inputs at API boundaries with `zod`
- Use CSRF protection (built-in with Next.js Server Actions)
- Never expose private hole cards in API responses to other players
- Use environment variables for all secrets — never hardcode
- Rate limit API routes with `@upstash/ratelimit`
- Sanitize user-generated content (player names, chat) with `DOMPurify`
- Use `Content-Security-Policy` headers in `next.config.ts`

---

## Code Style

- **No default exports** for components — use named exports: `export function PlayerSeat()`
- Use `cn()` (from `clsx` + `tailwind-merge`) for conditional class names
- Co-locate tests next to source files: `component.test.tsx` beside `component.tsx`
- File names: `kebab-case` for files/folders, `PascalCase` for component names
- Never use `var` — use `const` (preferred) or `let`
- Arrow functions for callbacks, `function` declarations for named functions/components
- No `React.FC` — use typed function declarations: `function MyComponent({ prop }: Props)`

---

## Commit Convention

```
feat: add [feature]
fix: resolve [bug]
spec: add [spec name] specification
chore: [tooling/config change]
```

---

## References

- Next.js docs: `node_modules/next/dist/docs/`
- Game rules: `docs/references/texas-holdem-rules.md`
- Design system: `docs/references/DESIGN.md`
- Kiro spec: `.kiro/specs/`
- Wikipedia: `docs/references/wikipedia-texas-holdem.md`
- CardzMania rules: `docs/references/cardzmania-rules.md`
