# Texas Hold'em Online — Kiro Spec

## Spec Index

| Document | Description |
|----------|-------------|
| [requirements.md](./requirements.md) | User stories, acceptance criteria, functional requirements |
| [design.md](./design.md) | System architecture, data models, API design |
| [tasks.md](./tasks.md) | Implementation tasks broken into stages |

## Project Summary

Online multiplayer Texas Hold'em poker built with Next.js 16 and deployed on Vercel.

- Players host a table and share a link or 6-digit code
- Pre-game settings: starting chips, blind amounts, raise limits, timer
- Real-time gameplay via Pusher (WebSockets)
- Persistent state in Vercel KV (Redis)
- Anonymous sessions (no sign-up required for MVP)
- Pinterest-inspired warm design system adapted for dark poker aesthetics

## Development Stages

| Stage | Focus | Status |
|-------|-------|--------|
| 1 | Project setup, copilot instructions, spec | ✅ Done |
| 2 | Core game engine (pure functions) | 🔲 Next |
| 3 | Game state & API (KV + Server Actions) | 🔲 |
| 4 | Real-time (Pusher integration) | 🔲 |
| 5 | UI — Lobby & table creation | 🔲 |
| 6 | UI — Game table & gameplay | 🔲 |
| 7 | UI — Player management & chat | 🔲 |
| 8 | Testing & polish | 🔲 |
| 9 | Deployment & production config | 🔲 |
