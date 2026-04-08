---
description: "Rules for building React UI components — layout, game visuals, and shared UI primitives"
applyTo: "src/components/**"
---

# React Component Instructions

## Default: Server Components

All components in `src/components/` are **React Server Components** by default.
Add `"use client"` **only** when the component needs:
- Browser-only APIs (`window`, `document`, `localStorage`)
- React state (`useState`, `useReducer`)
- React effects (`useEffect`, `useLayoutEffect`)
- Event handlers that require interactivity (`onClick`, `onChange`, etc.)
- Pusher / WebSocket subscriptions

When in doubt, keep it a Server Component and lift client state up one level.

## Exports

- **Named exports only** — never `export default`
- Component name must match file name in PascalCase: `PlayerSeat.tsx` → `export function PlayerSeat`
- Props interface name: `<ComponentName>Props` (e.g. `PlayerSeatProps`)

## Class Names

Always use `cn()` from `src/lib/utils/cn.ts` for conditional Tailwind classes:
```tsx
import { cn } from "@/lib/utils/cn";

<div className={cn("base-classes", isActive && "active-class", className)} />
```
Never use inline `style={{}}` unless animating values that Tailwind cannot express.

## Design Tokens

Use only the CSS custom properties defined in `docs/references/DESIGN.md`:
- Primary: `--color-felt`, `--color-felt-dark`
- Accent: `--color-gold`
- Text: `--color-text-primary`, `--color-text-muted`
- Status: `--color-danger`, `--color-success`

Use `bg-[var(--color-felt)]` Tailwind syntax to reference tokens.

## Component Organisation

| Folder | Purpose |
|--------|---------|
| `src/components/ui/` | Generic, re-usable, domain-agnostic (Button, Input, Badge) |
| `src/components/game/` | Poker-specific (TableFelt, PlayerSeat, CardFace, ChipStack) |
| `src/components/layout/` | Page chrome (Header, Footer, NavigationBar) |

Do not import `game/` components from `ui/`; the dependency flows only downward.

## Accessibility

- All interactive elements must be keyboard-accessible
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`)
- Every image/icon must have `alt` text or `aria-hidden="true"` if decorative

## No Logic in Components

Components render — they do not compute game rules.
All poker logic lives in `src/lib/game/` and is called from Server Components or Server Actions.
Client components receive pre-computed data via props.
