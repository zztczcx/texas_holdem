# Real-Time Sync Redesign

This update changed the table sync model from polling-assisted consistency to a push-first design with ordered snapshots.

## Why We Changed It

The previous fix solved missed updates by polling every few seconds. That made the app eventually correct, but not truly real-time.

The main problems were:

- Players could wait up to a few seconds before seeing an action, join, or game start.
- Clients had no reliable way to reject stale or out-of-order events.
- Polling masked sync problems instead of fixing them at the source.
- The actor often needed an extra fetch after acting just to see their own update.

The goal of this redesign was to keep the existing Pusher + Upstash Redis architecture, but make it behave like a real-time system instead of a polling system.

## What Changed

### 1. Ordered Snapshots

Every table state now carries a monotonic `revision`.

- `Table.revision` is incremented on each persisted mutation.
- Clients only apply snapshots with a revision newer than or equal to the latest one they already have.
- This prevents stale Pusher events from rolling the UI backward.

### 2. Push-First Sync

The server now publishes authoritative snapshots instead of relying on clients to recover by polling.

- In-game sync uses `GameSyncSnapshot`.
- Lobby sync uses `PublicTable` snapshots over `table:updated`.
- `performAction()` returns the acting player's latest snapshot immediately.

This means the acting player no longer waits for a follow-up refresh just to see their own action.

### 3. One-Shot Resync Instead of Polling Loops

Polling was removed from both lobby and game sync.

Clients now do a one-shot refresh only when it is actually needed:

- after Pusher subscription succeeds
- after reconnect or subscription error
- when a bootstrap gap is detected

There is no repeating background sync loop anymore.

### 4. Better Hole Card Reconciliation

Private hole cards are now reconciled by `handNumber`, not by event timing.

That means:

- cards remain stable across actions within the same hand
- cards are reset correctly when a new hand starts
- a late public event does not incorrectly clear or overwrite private cards

### 5. Lobby Becomes Real-Time Too

The lobby previously depended on interval polling and only had a narrow real-time path for game start.

Now it receives live table updates for:

- player joins
- player leaves
- game start
- latest revisioned table metadata

Anonymous viewers can also subscribe before joining because Pusher auth now creates a viewer session when needed.

## Before vs After

| Area | Before | After |
|------|--------|-------|
| In-game updates | Pusher + repeating polling fallback | Pusher + one-shot resync only when needed |
| Lobby updates | 3s polling + game-start signal | live `table:updated` snapshots |
| Event ordering | implicit, timing-based | explicit, revision-based |
| Actor feedback | action then extra refresh | action returns fresh snapshot immediately |
| Hole card merge | timing-sensitive | hand-aware |

## Benefits

- Faster feedback for actions, joins, and game start
- No built-in 3-second sync delay
- Lower background network traffic
- More predictable client state under reconnects or delayed events
- Cleaner separation between authoritative server state and client rendering
- Easier to test because ordering is part of the contract

## Practical Result

The system is now real-time by default, not eventually-correct-by-polling.

The only remaining timers in the app are UI timers such as turn countdowns, toast dismissal, and showdown countdowns. They are not part of data synchronization.

## Validation

The redesign was validated with:

- TypeScript compile check
- ESLint
- unit and hook tests
- Redis-backed integration tests
- production build