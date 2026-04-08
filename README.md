# Texas Hold'em Online

Multiplayer Texas Hold'em poker in your browser. No account required — just share a link.

Built with **Next.js 16 App Router**, **TypeScript**, **Pusher** (real-time), and **Upstash Redis** (game state).

---

## Quick Start

### Prerequisites

- Node.js 20+
- [Upstash Redis](https://console.upstash.com/redis) account (free tier works)
- [Pusher Channels](https://dashboard.pusher.com) account (free sandbox works)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars and fill in your credentials
cp .env.example .env.local
# Edit .env.local with your Upstash and Pusher keys

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

---

## How to Play

1. **Create a table** — click "Create Table", enter your name, configure settings
2. **Share the link** — copy the table URL and send it to friends
3. **Start the game** — host clicks "Start Game" when all players have joined
4. **Play** — Fold, Check, Call, or Raise each round

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Real-time | Pusher Channels (presence + private) |
| State | Upstash Redis (3h TTL, atomic locks) |
| Testing | Vitest + Testing Library + Playwright |
| Deployment | Vercel |

---

## Development

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm test -- --run    # unit + integration + component tests (128 tests)
npm run test:e2e     # Playwright E2E (requires running server + real env vars)
npx tsc --noEmit     # TypeScript type check
```

### Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (home)/             # Landing / lobby pages
│   ├── (game)/table/[id]/  # Game table page
│   ├── api/                # REST + Pusher auth endpoints
│   └── actions.ts          # Server Actions (create/join/play)
├── components/
│   ├── ui/                 # Buttons, inputs, modals, toasts
│   ├── game/               # Table, seats, cards, action bar
│   └── layout/             # Header, page wrapper
├── lib/
│   ├── game/               # Pure poker engine (deck, evaluator, state machine)
│   ├── db/                 # Upstash Redis KV helpers
│   └── pusher/             # Pusher server + client singletons
├── hooks/                  # useGameState, usePlayerSession, useTable
└── types/                  # game.ts, api.ts
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables from `.env.example` in the Vercel dashboard
4. Deploy — Vercel auto-builds on every push

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Required:

- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — Upstash Redis
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limiting (can reuse same instance)
- `PUSHER_APP_ID` + `PUSHER_KEY` + `PUSHER_SECRET` + `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY` + `NEXT_PUBLIC_PUSHER_CLUSTER`


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
