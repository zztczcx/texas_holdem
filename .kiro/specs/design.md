# Design Specification — Texas Hold'em Online

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel Edge                         │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Next.js    │    │  Server     │    │  API        │ │
│  │  App Router │    │  Actions    │    │  Routes     │ │
│  │  (RSC)      │    │  (mutations)│    │  (webhooks) │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│         │                 │                   │        │
│         └─────────────────┼───────────────────┘        │
│                           │                            │
│                    ┌──────▼──────┐                     │
│                    │  Vercel KV  │                     │
│                    │  (Redis)    │                     │
│                    └──────┬──────┘                     │
└───────────────────────────│─────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │    Pusher     │
                    │  (WebSocket   │
                    │   Fan-out)    │
                    └───────┬───────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
       [Client 1]       [Client 2]       [Client 3]
       (Browser)        (Browser)        (Browser)
```

### Flow
1. Client loads Next.js page (Server Component renders initial state)
2. Client subscribes to Pusher channel `presence-table-{tableId}`
3. Player action → Client calls Server Action
4. Server Action: validates → updates KV → publishes Pusher event
5. All clients receive Pusher event → update local state

---

## 2. Data Models

### `Table` (stored in KV as `table:{tableId}`)

```typescript
interface Table {
  id: string;                    // nanoid(6)
  hostPlayerId: string;          // UUID of creator
  state: TableState;             // 'waiting' | 'playing' | 'ended'
  settings: GameSettings;
  players: Record<string, Player>;
  gameState: GameState | null;   // null when waiting
  createdAt: number;             // Unix timestamp
  updatedAt: number;
}

type TableState = 'waiting' | 'playing' | 'ended';
```

### `GameSettings`

```typescript
interface GameSettings {
  startingChips: number;         // Default: 1000
  smallBlind: number;            // Default: 10
  bigBlind: number;              // Default: 20 (auto: 2× small)
  maxRaises: number;             // 0 = unlimited
  ante: number;                  // Default: 0
  turnTimerSeconds: number;      // 0 = disabled
  maxPlayers: number;            // 2–9
  allowBuyBack: boolean;
  buyBackAmount: number;
}
```

### `Player`

```typescript
interface Player {
  id: string;                    // UUID (from cookie)
  name: string;                  // Display name
  seatIndex: number;             // 0–8
  chips: number;
  status: PlayerStatus;
  sessionId: string;             // For reconnection
  joinedAt: number;
}

type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sitOut' | 'disconnected';
```

### `GameState` (embedded in Table)

```typescript
interface GameState {
  stage: GameStage;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  currentSeatIndex: number;       // Whose turn it is
  pot: number;
  sidePots: SidePot[];
  communityCards: Card[];         // 0–5 cards
  deck: Card[];                   // Remaining deck (server-only)
  playerHands: Record<string, PlayerHand>; // PlayerId → hand
  currentBet: number;            // Current betting amount to call
  raiseCount: number;            // Current round raise count
  minimumRaise: number;
  bettingRound: BettingRound;    // Tracks current round's bets
  lastAction: PlayerAction | null;
  handNumber: number;
}

type GameStage = 
  | 'waiting'
  | 'pre-flop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'end';
```

### `Card`

```typescript
interface Card {
  suit: Suit;
  rank: Rank;
}

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
```

### `PlayerHand` (ONLY sent to owning player)

```typescript
interface PlayerHand {
  holeCards: readonly [Card, Card];
  bestHand?: HandResult;          // Populated at showdown
}
```

### `HandResult`

```typescript
interface HandResult {
  rank: HandRank;
  rankName: string;               // "Full House", "Two Pair", etc.
  cards: readonly Card[];         // 5 best cards
  kickers: readonly Card[];
}

type HandRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
// 1=High Card, 10=Royal Flush
```

### `PlayerAction`

```typescript
interface PlayerAction {
  type: ActionType;
  playerId: string;
  amount?: number;               // For raise/bet
  timestamp: number;
}

type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allIn';
```

### `SidePot`

```typescript
interface SidePot {
  amount: number;
  eligiblePlayerIds: readonly string[];
}
```

### `BettingRound` (transient, within GameState)

```typescript
interface BettingRound {
  bets: Record<string, number>;   // PlayerId → amount bet this round
  actedPlayers: Set<string>;
}
```

---

## 3. API Design

### Server Actions (in `src/app/actions.ts`)

```typescript
// Create a new table
createTable(settings: GameSettings, hostName: string): Promise<{ tableId: string }>

// Join an existing table
joinTable(tableId: string, playerName: string): Promise<{ playerId: string }>

// Start the game (host only)
startGame(tableId: string, playerId: string): Promise<void>

// Player action during gameplay
performAction(tableId: string, playerId: string, action: PlayerAction): Promise<void>

// Buy back (if allowed)
buyBack(tableId: string, playerId: string): Promise<void>

// Kick a player (host only)
kickPlayer(tableId: string, hostId: string, targetPlayerId: string): Promise<void>
```

### API Routes (in `src/app/api/`)

```
GET  /api/table/[tableId]         → Public table info (no hole cards)
GET  /api/table/[tableId]/state   → Game state for current player (filtered)
POST /api/pusher/auth             → Pusher presence channel auth
```

---

## 4. State Filtering (Security)

The server **never** sends hole cards to players who don't own them.

### Public Game State (sent to all)
- Community cards
- Pot amount, side pots
- Player chip counts, current bets, status
- Current stage, dealer/blind positions
- Last action taken
- Number of hole cards each player holds (as `cardCount: 2`) — not the actual cards

### Private Game State (sent per-player)
- Player's own hole cards
- Their own `HandResult` at showdown

### Showdown Reveal
- At showdown, all remaining players' hole cards are sent to all clients
- Cards revealed one-by-one with animation

---

## 5. Pusher Events

### Channel: `presence-table-{tableId}`

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state-update` | `PublicGameState` | After any state change |
| `game:player-hand` | `{ playerId, holeCards }` | Sent to owning player only |
| `game:action` | `PlayerAction` | Action taken (for animation) |
| `game:showdown` | `ShowdownResult` | All hands revealed |
| `game:hand-end` | `HandEndResult` | Winner, chips awarded |
| `table:player-joined` | `Player` | New player joined |
| `table:player-left` | `{ playerId }` | Player disconnected |
| `table:settings-updated` | `GameSettings` | Host changed settings |
| `table:game-started` | `void` | Host started game |

---

## 6. KV Data Structure (Vercel KV / Redis)

```
table:{tableId}          → JSON (Table object)
table:{tableId}:lock     → NX lock for atomic updates (10s TTL)
player-session:{uuid}    → { tableId, playerId } (reconnection)
```

TTL: Tables expire after 3 hours of inactivity.

---

## 7. File Structure

```
src/
├── app/
│   ├── (home)/
│   │   ├── page.tsx                 # Landing/lobby page
│   │   └── layout.tsx
│   ├── (game)/
│   │   └── table/
│   │       └── [tableId]/
│   │           ├── page.tsx         # Game table page
│   │           ├── loading.tsx
│   │           └── not-found.tsx
│   ├── api/
│   │   ├── table/
│   │   │   └── [tableId]/
│   │   │       ├── route.ts         # GET table info
│   │   │       └── state/
│   │   │           └── route.ts     # GET filtered game state
│   │   └── pusher/
│   │       └── auth/
│   │           └── route.ts         # Pusher auth
│   ├── actions.ts                   # All Server Actions
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Root → redirect to (home)
│   └── globals.css
│
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── slider.tsx
│   │   └── modal.tsx
│   ├── game/
│   │   ├── playing-card.tsx         # Single card component
│   │   ├── card-back.tsx
│   │   ├── poker-table.tsx          # Oval table SVG layout
│   │   ├── player-seat.tsx          # Individual player seat
│   │   ├── community-cards.tsx      # Flop/turn/river display
│   │   ├── pot-display.tsx          # Pot amount
│   │   ├── action-bar.tsx           # Fold/Check/Call/Raise buttons
│   │   ├── raise-slider.tsx         # Raise amount selector
│   │   ├── chip-stack.tsx           # Visual chip display
│   │   └── hand-result.tsx          # Showdown hand description
│   └── layout/
│       ├── header.tsx
│       └── page-container.tsx
│
├── lib/
│   ├── game/
│   │   ├── deck.ts                  # Card deck utilities
│   │   ├── hand-evaluator.ts        # Hand ranking logic
│   │   ├── game-state.ts            # State machine + reducer
│   │   └── betting.ts               # Betting validation + logic
│   ├── db/
│   │   └── kv.ts                    # Vercel KV client + helpers
│   ├── pusher/
│   │   ├── server.ts                # Pusher server client
│   │   └── client.ts                # Pusher browser client
│   └── utils/
│       ├── cn.ts                    # clsx + tailwind-merge
│       ├── nanoid.ts                # Table ID generation
│       └── validate.ts              # Zod schemas
│
├── types/
│   ├── game.ts                      # All game types
│   └── api.ts                       # API request/response types
│
└── hooks/
    ├── use-game-state.ts             # Subscribe to Pusher + merge state
    ├── use-player-session.ts         # Player UUID from cookie
    └── use-table.ts                  # Table metadata hook
```

---

## 8. Core Game Engine

### `deck.ts`
```typescript
function createDeck(): Card[]
function shuffle(deck: readonly Card[]): Card[]
function dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] }
```

### `hand-evaluator.ts`
```typescript
function evaluateHand(cards: readonly Card[]): HandResult
function compareHands(a: HandResult, b: HandResult): -1 | 0 | 1
function getBestHand(holeCards: readonly Card[], communityCards: readonly Card[]): HandResult
```

### `game-state.ts`
```typescript
function createGameState(settings: GameSettings, players: Player[]): GameState
function applyAction(state: GameState, action: PlayerAction): GameState
function getGameStateAfterDeal(state: GameState): GameState  // Pre-flop → Flop etc.
function isHandComplete(state: GameState): boolean
function determineWinners(state: GameState): WinnerResult[]
```

### `betting.ts`
```typescript
function getValidActions(state: GameState, playerId: string): ActionType[]
function getCallAmount(state: GameState, playerId: string): number
function getMinRaise(state: GameState): number
function getMaxRaise(state: GameState, playerId: string): number
function applyBet(state: GameState, action: PlayerAction): GameState
function isBettingRoundComplete(state: GameState): boolean
```

---

## 9. State Machine Transitions

```
waiting → pre-flop     (host starts game)
pre-flop → flop        (betting round complete)
flop → turn            (betting round complete)
turn → river           (betting round complete)
river → showdown       (2+ players remain)
river → end            (all-but-one folded)
showdown → end         (winners determined)
end → pre-flop         (next hand starts, dealer rotates)
end → waiting          (only 1 player has chips)
```

### Betting Round Complete when:
- All active (non-folded, non-all-in) players have acted AND
- All active players have matched the current bet OR gone all-in

---

## 10. Security Considerations

- Server Actions use Zod for input validation
- `playerId` verified against session cookie, not trusted from client
- Game state mutations wrapped in KV atomic lock to prevent race conditions
- Hole cards stripped from `PublicGameState` before sending
- Pusher presence channel requires auth (`/api/pusher/auth`)
- Rate limiting: `@upstash/ratelimit` on Server Actions (10 req/s per player)
- CSP headers: restrict script sources
- Player names: max 20 chars, HTML-escaped before render
