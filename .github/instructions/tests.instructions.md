---
description: "Vitest testing conventions for unit and integration tests"
applyTo: ["**/*.test.ts", "**/*.test.tsx"]
---

# Test File Instructions

## Framework

This project uses **Vitest** (not Jest). The API is compatible but import from `vitest`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

## File Naming & Organisation

- Co-locate tests beside source files: `deck.ts` → `deck.test.ts`
- One test file per source module
- Mirror the source file's export structure in the test file

## Structure

```ts
describe("moduleName", () => {
  describe("functionName", () => {
    it("does X when Y", () => { ... });
    it("throws when Z", () => { ... });
  });
});
```

Use `describe` blocks to group by function. Use `it` (not `test`) for individual cases.

## Pure Function Tests (src/lib/game/)

Pure functions must be tested exhaustively — no mocking of the function under test:

- **Deck**: test full 52-card creation, shuffled deck has correct card count, deal removes cards
- **Hand evaluator**: test all hand ranks (royal flush through high card), tie-breaking, 7-card combinations
- **Game state**: test every valid stage transition, test every invalid transition throws, test all player actions
- **Betting**: test valid actions per game state, test all-in, test side-pot creation

Do **not** mock `applyAction`, `evaluateHand`, or any other pure game function — call them directly.

## React Component Tests (src/components/)

Use `@testing-library/react` for component tests:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

Test user interactions, not implementation details.
Do not test Tailwind classes — test visible text, roles, and ARIA attributes.

## Server Action / API Tests

Mock only external dependencies (KV, Pusher). Never mock the function under test.
Test the full validation → logic → response path.

## Coverage Expectations

- Every exported function in `src/lib/game/` must have ≥ 1 test
- Happy path + at least one error/edge case per function
- No snapshot tests — snapshots become stale and misleading

## What NOT to Do

- Do not use `expect(wrapper.html()).toMatchSnapshot()`
- Do not `import React from "react"` in test files (JSX transform is automatic)
- Do not spy on module internals — test only public exports
- Do not write tests that rely on execution order between `it` blocks
