# Requirements Specification — Texas Hold'em Online

## 1. Overview

### Problem Statement
Friends want to play Texas Hold'em poker online together without installing anything or creating accounts. They need a shareable link to join, configurable game settings, and a smooth real-time experience.

### Scope
MVP: No-limit Texas Hold'em, 2–9 players, anonymous sessions, private tables only.

---

## 2. User Personas

| Persona | Description | Goals |
|---------|-------------|-------|
| **Host** | Creates and configures the table | Set rules, invite friends, start/end game |
| **Player** | Joins via shared link | Play without friction, see real-time state |
| **Spectator** | Watches without playing (future) | Observe game, no betting |

---

## 3. Functional Requirements

### FR-1: Table Management

**FR-1.1 Create Table**
- User can create a new table from the lobby
- System generates a unique 6-character alphanumeric table code (e.g., `A3K9PX`)
- System generates a shareable URL: `/table/[tableId]`
- Creator automatically becomes the **Host**
- Table is in `waiting` state until the host starts the game

**FR-1.2 Join Table**
- User can join via the shareable URL
- User can join by entering table code on the lobby page
- User enters a display name (1–20 characters, no HTML/scripts)
- If table is in-game, user can spectate (MVP: shows "game in progress")
- Table must not exceed max player count (2–9 players)

**FR-1.3 Player Lobby**
- Host sees all connected players with names and ready status
- Host can kick a player before the game starts
- Host configures game settings (see FR-2)
- Host clicks "Start Game" to begin
- All players see a "Waiting for host to start..." state

**FR-1.4 Reconnection**
- If a player disconnects and rejoins within 5 minutes, they retain their seat
- If reconnection fails, player is marked "away" and auto-folds until they return

### FR-2: Game Configuration (Pre-Game Settings)

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| `startingChips` | number | 500, 1000, 2000, 5000, custom | 1000 |
| `smallBlind` | number | 5, 10, 25, 50, custom | 10 |
| `bigBlind` | number | auto (2× small blind) | 20 |
| `maxRaises` | number | 1, 2, 3, unlimited | unlimited |
| `ante` | number | 0, 1, 2, 5, custom | 0 |
| `turnTimerSeconds` | number | 0 (off), 7, 15, 30, 60 | 30 |
| `maxPlayers` | number | 2–9 | 9 |
| `allowBuyBack` | boolean | true/false | true |
| `buyBackAmount` | number | equal to starting chips | 1000 |

**FR-2.1 Validation**
- `bigBlind` must be ≥ 2 × `smallBlind`
- `startingChips` must be > `bigBlind × 10`
- Custom amounts must be positive integers

### FR-3: Core Gameplay

**FR-3.1 Hand Flow**
1. System auto-assigns dealer button, small blind, big blind positions
2. System deals 2 hole cards to each active player
3. Pre-flop betting round (starting UTG — left of big blind)
4. Flop: 3 community cards revealed, betting round
5. Turn: 1 community card revealed, betting round
6. River: 1 community card revealed, final betting round
7. Showdown (if 2+ players remain): hands revealed, winner determined
8. Pot awarded, dealer button rotates clockwise

**FR-3.2 Player Actions**
Each player's turn offers valid actions only:
- **Fold**: Remove from hand
- **Check**: Pass (only if no bet pending)
- **Call**: Match current bet
- **Raise**: Increase bet (min raise = previous raise size)
- **All-In**: Bet entire chip stack

**FR-3.3 Betting Rules (No-Limit)**
- Minimum bet = big blind
- Minimum raise = size of previous raise (or big blind if first raise)
- Max raise = player's chip stack (all-in)
- Re-raise limit: configurable (or unlimited)
- If `maxRaises > 0`, cap raise count per betting round

**FR-3.4 Blinds & Antes**
- Small blind posted automatically
- Big blind posted automatically
- Ante posted by all active players before deal (if configured)

**FR-3.5 All-In & Side Pots**
- When a player all-ins with fewer chips than the current bet, a side pot is created
- All-in player eligible for main pot only
- Side pot contested by remaining active players

**FR-3.6 Showdown**
- Hands evaluated using best 5 of 7 cards (2 hole + 5 community)
- Winning hand type displayed (e.g., "Full House, Kings over Jacks")
- Split pot if hands are equal value
- Extra chips from odd split go to first player left of button

**FR-3.7 Turn Timer**
- When enabled, each player has `turnTimerSeconds` to act
- Warning animation at 5 seconds remaining
- Auto-fold (or auto-check if no bet pending) when timer expires

### FR-4: Hand Rankings (Card Logic)

System must correctly evaluate and rank:
1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight (including A-2-3-4-5 "wheel")
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

Tie-breaking with kickers must be correct.

### FR-5: Session & Identity

**FR-5.1 Anonymous Sessions**
- No account required for MVP
- Player identity stored in browser cookie/localStorage (UUID)
- Display name chosen at table join

**FR-5.2 Security**
- Hole cards NEVER sent to players who don't own them
- Each player only receives their own hole card data
- Server validates all actions against game state before applying

### FR-6: Real-Time Communication

**FR-6.1 State Updates**
- All clients receive game state updates immediately after each action
- Updates delivered via Pusher presence channels (`presence-table-{tableId}`)
- Client maintains optimistic UI state where appropriate

**FR-6.2 Presence**
- Players shown as online/offline in the lobby and at the table
- Host notified when players join or leave

### FR-7: UI / UX Requirements

**FR-7.1 Lobby Page**
- Prominent "Create Table" and "Join Table" CTAs
- Input for table code (join flow)
- Recent tables stored in localStorage (optional)

**FR-7.2 Pre-Game Lobby (Table Setup)**
- Player list with avatars and names
- Settings form (host only can edit)
- Shareable link + copy button
- "Start Game" button (host only, active when ≥ 2 players joined)

**FR-7.3 Game Table**
- Oval felt table with player seats around perimeter
- Community cards in center, pot displayed
- Each player seat: avatar, name, chip count, current bet, turn indicator
- Deal animation when cards are dealt
- Action buttons: Fold, Check/Call, Raise (with amount slider)
- Hand result display at showdown with winning hand highlighted

**FR-7.4 Responsive Design**
- Playable on desktop (primary) and tablet
- Mobile: simplified layout, action buttons at bottom

**FR-7.5 Accessibility**
- Card suits use both color AND symbol (accessible to colorblind users)
- All interactive elements keyboard-navigable
- ARIA labels on game state elements

---

## 4. Non-Functional Requirements

### Performance
- Initial page load < 2s (Vercel Edge)
- Game state updates delivered < 200ms after action
- Support 50 concurrent tables (MVP)

### Security (OWASP)
- All server actions validate input with Zod
- Rate limiting on table creation (10/hour/IP) and actions (60/minute/player)
- No hole card data leakage — strict server-side filtering
- CSRF protection via Next.js Server Actions
- CSP headers configured
- Player names sanitized (XSS prevention)

### Reliability
- Game state persisted in Vercel KV — survives server restarts
- Reconnection window: 5 minutes
- If all players disconnect, table expires after 30 minutes

### Scalability
- Stateless server (all state in KV)
- Pusher handles WebSocket fan-out

---

## 5. Out of Scope (MVP)

- Real money gambling
- Tournament mode (blind escalation)
- Accounts / leaderboards
- Mobile native app
- Spectator mode
- AI/bot players
- Limit or pot-limit betting structures (only no-limit)
- Hand history download
- Player statistics
