---
description: "Rules for implementing poker game logic, deck operations, hand evaluation, and betting in the game engine"
applyTo: "src/lib/game/**"
---

# Game Engine Instructions

All code in `src/lib/game/` must be **pure functions** with no side effects.

## Absolute Rules

- **No React imports** — this is plain TypeScript, not a component
- **No I/O** — no `fetch`, no `fs`, no database calls, no `console.log` in production code
- **No mutation** — never mutate input arguments; always return new objects/arrays
- **No `any`** — use `unknown` and narrow with type guards or Zod schemas
- Import all shared types from `src/types/game.ts` — do not redefine them here

## Function Signatures

Every exported function must:
1. Have an explicit return type annotation
2. Accept only serialisable arguments (no class instances, no DOM, no React state)
3. Return `readonly` arrays where the output is a collection
4. Be deterministic — same input always produces same output (use a seeded RNG if randomness is needed, accept it as a parameter)

## Testing Requirement

Every exported function **must** have a co-located unit test in `<module>.test.ts`.
Tests use Vitest (`describe` / `it` / `expect`).
Test all edge cases: empty deck, one-card hand, all-in pot, split pots.

## State Machine

Valid stage transitions only (enforced in `game-state.ts`):
```
waiting → pre-flop → flop → turn → river → showdown → end
```
`applyAction` must throw (or return an error result type) if the action is invalid for the current stage.

## Hand Evaluation

`evaluateHand` must handle all 7-card Texas Hold'em combinations.
Return a `HandResult` with a numeric `rank` that supports direct `>` comparison between two results.

## Deck

`createDeck()` returns a full 52-card deck as `readonly Card[]`.
`shuffle(deck, rng)` accepts an RNG function so tests can use a deterministic seed.
`dealCards(deck, n)` returns `[dealtCards, remainingDeck]` as a tuple — never mutates.
