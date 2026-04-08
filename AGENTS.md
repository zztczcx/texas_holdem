<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Project: Texas Hold'em Online

Before writing any code for this project:

1. **Read the project instructions**: `.github/copilot-instructions.md`
2. **Read the spec**: `.kiro/specs/` (requirements, design, tasks)
3. **Read the design system**: `docs/references/DESIGN.md`
4. **Read game rules**: `docs/references/texas-holdem-rules.md`

### Key conventions
- All game logic lives in `src/lib/game/` as pure functions — no React, no I/O
- Game types in `src/types/game.ts` — import from there, don't redefine
- Named exports only — no default exports for components
- Use `cn()` from `src/lib/utils/cn.ts` for conditional Tailwind classes
- Validate all inputs at API boundaries with Zod (`src/lib/utils/validate.ts`)
- NEVER include hole cards in responses sent to other players (security critical)

### Quick file locations
- Server Actions: `src/app/actions.ts`
- KV helpers: `src/lib/db/kv.ts`
- Pusher server: `src/lib/pusher/server.ts`
- Pusher client: `src/lib/pusher/client.ts`
- Game engine: `src/lib/game/`

---

## Autonomous Execution Protocol

**Run stages continuously without waiting for human input.**

1. Check `.kiro/specs/tasks.md` — find the first stage with unchecked `[ ]` items
2. Mark the stage in-progress on your todo list
3. Read all referenced docs for the stage before writing code
4. Verify `npm run build` is clean before starting
5. After completing a stage, run the mandatory checklist:
   - `npx tsc --noEmit` — zero errors
   - `npm run lint` — zero errors
   - `npm test -- --run` — all pass
6. Mark all stage tasks `[x]` in `.kiro/specs/tasks.md`
7. Run `git add -A && git commit -m "<type>: <description>"`
8. Immediately proceed to the next `not-started` stage — do NOT stop

**Never ask for confirmation between stages. Never skip the git commit.**
