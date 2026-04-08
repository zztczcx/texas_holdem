# Implementation Tasks — Texas Hold'em Online

> Kiro-style task breakdown. Each stage is committed separately.

---

## Stage 1: Project Setup & Spec ✅ COMPLETE

- [x] Initialize git repository
- [x] Scaffold Next.js 16 project (TypeScript, Tailwind v4, ESLint, App Router)
- [x] Create `.github/copilot-instructions.md`
- [x] Update `AGENTS.md` with project-specific Next.js agent rules
- [x] Create `docs/references/DESIGN.md` (Pinterest-inspired poker design system)
- [x] Create `docs/references/texas-holdem-rules.md`
- [x] Create `docs/references/cardzmania-rules.md`
- [x] Create `.kiro/specs/requirements.md`
- [x] Create `.kiro/specs/design.md`
- [x] Create `.kiro/specs/tasks.md`
- [x] Initial git commit

---

## Stage 2: Core Game Engine (Pure Functions)

> Goal: Implement all game logic as pure TypeScript functions with unit tests.
> No React, no I/O, no side effects.

### Tasks

- [x] `src/types/game.ts` — Define all game types (Card, Suit, Rank, GameState, Player, etc.)
- [x] `src/types/api.ts` — Define API request/response types and Zod schemas
- [x] `src/lib/game/deck.ts` — `createDeck()`, `shuffle()`, `dealCards()`
- [x] `src/lib/game/hand-evaluator.ts` — `evaluateHand()`, `compareHands()`, `getBestHand()`
  - High Card, Pair, Two Pair, Three of a Kind
  - Straight (including A-2-3-4-5 wheel)
  - Flush, Full House, Four of a Kind
  - Straight Flush, Royal Flush
  - Kicker comparison
- [x] `src/lib/game/betting.ts` — `getValidActions()`, `getCallAmount()`, `applyBet()`
- [x] `src/lib/game/game-state.ts` — `createGameState()`, `applyAction()`, `determineWinners()`
- [x] `src/lib/utils/cn.ts` — `clsx` + `tailwind-merge` helper
- [x] `src/lib/utils/nanoid.ts` — Table ID generation (6-char)

### Unit Tests
- [x] `deck.test.ts` — shuffle distribution, deal correctness
- [x] `hand-evaluator.test.ts` — all hand ranks, kicker tiebreaks, split pots
- [x] `betting.test.ts` — valid actions, all-in side pots, raise limits
- [x] `game-state.test.ts` — full hand simulation

### Commit
```
feat: add core poker game engine with unit tests
```

---

## Stage 3: Persistence & Server Actions

> Goal: Implement table creation, joining, and game state persistence in Vercel KV.

### Tasks

- [x] Configure `@vercel/kv` (or `ioredis` with env vars)
- [x] `src/lib/db/kv.ts` — KV client, `getTable()`, `setTable()`, `acquireLock()`
- [x] `src/lib/utils/validate.ts` — Zod schemas for all Server Action inputs
- [x] `src/app/actions.ts` — Implement all Server Actions:
  - `createTable(settings, hostName)`
  - `joinTable(tableId, playerName)`
  - `startGame(tableId, playerId)`
  - `performAction(tableId, playerId, action)`
  - `buyBack(tableId, playerId)`
  - `kickPlayer(tableId, hostId, targetPlayerId)`
- [x] `src/app/api/table/[tableId]/route.ts` — GET public table info
- [x] `src/app/api/table/[tableId]/state/route.ts` — GET filtered game state
- [x] Session cookie management (`src/lib/utils/session.ts`)
- [x] Rate limiting setup (`@upstash/ratelimit`)

### Environment Variables (add to `.env.local`)
```
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

### Commit
```
feat: add KV persistence and server actions for game management
```

---

## Stage 4: Real-Time with Pusher

> Goal: Connect game actions to real-time updates via Pusher presence channels.

### Tasks

- [x] Create Pusher account, configure app
- [x] `src/lib/pusher/server.ts` — Pusher server client
- [x] `src/lib/pusher/client.ts` — Pusher browser client (singleton)
- [x] `src/app/api/pusher/auth/route.ts` — Presence channel auth
- [x] Integrate Pusher events into Server Actions (publish after KV update)
- [x] `src/hooks/use-game-state.ts` — Subscribe to Pusher, merge with React state
- [x] `src/hooks/use-player-session.ts` — UUID from cookie
- [x] `src/hooks/use-table.ts` — Table metadata (polling fallback)

### Pusher Events to implement
- `game:state-update`, `game:player-hand`, `game:action`
- `game:showdown`, `game:hand-end`
- `table:player-joined`, `table:player-left`
- `table:settings-updated`, `table:game-started`

### Environment Variables
```
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

### Commit
```
feat: add Pusher real-time integration for live game updates
```

---

## Stage 5: UI — Lobby & Table Creation

> Goal: Build the landing page and table setup flow.

### Tasks

**Design tokens & globals**
- [x] Update `src/app/globals.css` with CSS custom properties (all color tokens)
- [x] Update `tailwind.config.ts` with custom colors, fonts, border-radius scale
- [x] Install `clsx`, `tailwind-merge`

**UI Components**
- [x] `src/components/ui/button.tsx` — Primary, Secondary, Danger, Gold variants
- [x] `src/components/ui/input.tsx` — Dark themed input
- [x] `src/components/ui/badge.tsx` — Status badges
- [x] `src/components/ui/modal.tsx` — Dialog with backdrop
- [x] `src/components/ui/slider.tsx` — Raise amount slider
- [x] `src/components/layout/header.tsx` — Logo + nav
- [x] `src/components/layout/page-container.tsx`

**Pages**
- [x] `src/app/(home)/page.tsx` — Landing page
  - Hero: "Play Texas Hold'em with Friends"
  - "Create Table" button → opens settings modal
  - "Join Table" input + button
- [x] `src/app/(home)/layout.tsx`
- [x] `src/app/(game)/table/[tableId]/page.tsx` — Pre-game lobby view
  - Player list (waiting state)
  - Settings form (host editable)
  - Share link + copy button
  - "Start Game" button (host only)
  - Loading state for non-host players

### Commit
```
feat: add lobby page and table creation UI
```

---

## Stage 6: UI — Game Table & Gameplay

> Goal: Build the main poker table UI with full game interaction.

### Tasks

**Game Components**
- [ ] `src/components/game/playing-card.tsx` — Face-up card (suit symbol + rank)
- [ ] `src/components/game/card-back.tsx` — Face-down card with pattern
- [ ] `src/components/game/poker-table.tsx` — Oval felt table with seat positions
- [ ] `src/components/game/player-seat.tsx`
  - Avatar circle (initials or icon)
  - Name, chip count, current-round bet
  - Dealer button (D), SB, BB labels
  - Turn indicator ring (animated timer)
  - Folded state (cards face down)
  - All-in indicator
- [ ] `src/components/game/community-cards.tsx` — 5-slot community card display
- [ ] `src/components/game/pot-display.tsx` — Pot + side pots
- [ ] `src/components/game/action-bar.tsx` — Action buttons for active player
- [ ] `src/components/game/raise-slider.tsx` — Slider with min/max/all-in shortcuts
- [ ] `src/components/game/chip-stack.tsx` — Visual chip representation
- [ ] `src/components/game/hand-result.tsx` — "Full House, Kings over Jacks"

**Game Table Page (full game state)**
- [ ] Update `src/app/(game)/table/[tableId]/page.tsx` with:
  - Game table layout (poker-table component)
  - Real-time Pusher subscription via hooks
  - Conditional render: lobby vs. game state

**Animations (CSS/Framer Motion)**
- [ ] Card deal animation (cards slide from deck position)
- [ ] Chip movement on bet/win
- [ ] Timer ring countdown
- [ ] Pot award animation

### Commit
```
feat: add game table UI with player seats, cards, and action controls
```

---

## Stage 7: Showdown, Results & Polish

> Goal: Complete the gameplay loop with showdown reveal and game end.

### Tasks

- [ ] Showdown reveal sequence (flip cards one by one with delay)
- [ ] Hand result display for each player at showdown
- [ ] Winner highlight + chip award animation
- [ ] "Next Hand" button / auto-advance (5-second countdown)
- [ ] Player elimination UI (out of chips notification)
- [ ] Buy-back modal (if enabled)
- [ ] Game end screen (final standings, chip counts, winner celebration)
- [ ] Turn timer — visual ring, auto-action on expiry
- [ ] Reconnection handling UI (grayed-out seat, "reconnecting..." indicator)
- [ ] Sit-out feature
- [ ] Toast notifications (player joined/left, game started, etc.)

### Commit
```
feat: add showdown, game end flow, and gameplay polish
```

---

## Stage 8: Testing & Quality

> Goal: Ensure correctness and catch regressions.

### Tasks

- [ ] Install `vitest` + `@testing-library/react`
- [ ] Configure `vitest.config.ts`
- [ ] Unit tests: game engine (Stage 2 tests formalized)
- [ ] Integration tests: Server Actions with KV mock
- [ ] Component tests: `playing-card`, `action-bar`, `player-seat`
- [ ] E2E: Playwright — full game flow (2-player game from lobby to showdown)
- [ ] Accessibility audit: keyboard navigation, color contrast
- [ ] Performance: Lighthouse audit, bundle size check

### Commit
```
test: add unit, integration, and e2e tests
```

---

## Stage 9: Production & Deployment

> Goal: Deploy to Vercel with all env vars and production hardening.

### Tasks

- [ ] `next.config.ts` — CSP headers, security headers
- [ ] `.env.example` — Document all required env vars
- [ ] Vercel project setup (KV store + Pusher env vars)
- [ ] `vercel.json` — Region config if needed
- [ ] Final `README.md` with setup instructions
- [ ] Domain setup (optional)
- [ ] Monitor initial deployment

### Environment Checklist
```
KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN
PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  (for rate limiting)
```

### Commit
```
chore: production configuration and deployment setup
```

---

## Task Dependencies

```
Stage 1 (Setup)
    ↓
Stage 2 (Game Engine) ← pure functions, no dependencies
    ↓
Stage 3 (Persistence) ← depends on types from Stage 2
    ↓
Stage 4 (Real-time)   ← depends on Stage 3
    ↓
Stage 5 (Lobby UI)    ← can start alongside Stage 3
    ↓
Stage 6 (Game UI)     ← depends on Stage 4, 5
    ↓
Stage 7 (Polish)      ← depends on Stage 6
    ↓
Stage 8 (Testing)     ← depends on Stage 7
    ↓
Stage 9 (Deploy)      ← depends on Stage 8
```
