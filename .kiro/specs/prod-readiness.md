# Production Readiness Spec — airtexas.club

> Kiro-style spec for the public launch hardening pass.
> Covers: rich invite links, SEO, security hardening, analytics.

---

## Goals

1. **Rich invite previews** — iMessage, WhatsApp, Telegram, Slack all show host name + table code when someone taps a share link
2. **SEO fundamentals** — correct favicon, sitemap, robots.txt, canonical URLs, structured Open Graph tags
3. **Security hardening** — rate limiting is wired into every Server Action and API route; CSP stays tight
4. **Analytics** — Vercel Analytics tracks page views with zero cookie-consent friction (privacy-first)

---

## Non-Goals

- Google Analytics (can be added later if event funnels are needed)
- Cloudflare WAF / Turnstile bot detection (add if spam becomes an issue)
- i18n / translations
- Custom 404 / 500 error pages with design

---

## Requirements

### REQ-1: Invite Link Preview
- REQ-1.1: Visiting `/table/{tableId}` in a link-unfurler (iMessage, WhatsApp, Slack) MUST show:
  - Title: `"{HostName}'s Poker Table — Join Now 🃏"`
  - Description: `"{HostName} invited you to play Texas Hold'em. Table {tableId} — no account needed."`
  - A 1200×630 OG image with the above text rendered on a dark-green felt background
  - `og:url` pointing to canonical `https://airtexas.club/table/{tableId}`
- REQ-1.2: The home page MUST have its own branded 1200×630 OG image
- REQ-1.3: Both pages MUST include `twitter:card = summary_large_image`
- REQ-1.4: The table lobby page MUST show the canonical invite URL (not just `window.location.href`) and offer a one-tap copy button

### REQ-2: SEO Fundamentals
- REQ-2.1: Root layout MUST declare `metadataBase: new URL('https://airtexas.club')`
- REQ-2.2: A favicon MUST appear in browser tabs and iOS home-screen icons
  - `/favicon.svg` — SVG with ♠ on dark-green background
  - `/apple-touch-icon.png` — 180×180 PNG (generated from SVG or separate file)
- REQ-2.3: `/robots.txt` MUST allow all crawlers on `/`, block `/api/`
- REQ-2.4: `/sitemap.xml` MUST include the home page (table pages are ephemeral — omit them)
- REQ-2.5: Table pages MUST have `robots: { index: false }` to prevent private tables appearing in search

### REQ-3: Security Hardening
- REQ-3.1: Every Server Action (`createTable`, `joinTable`, `performAction`, `startGame`, `buyBack`, `kickPlayer`, `resetGame`) MUST call `checkRateLimit` before performing any work. Return `{ error: 'Too many requests. Please slow down.' }` on limit exceeded.
- REQ-3.2: The `GET /api/table/[tableId]` route MUST rate-limit by IP.
- REQ-3.3: The CSP `script-src` MUST include `https://va.vercel-scripts.com` (Vercel Analytics script host).
- REQ-3.4: Rate limit tiers:
  - `createTable` / `joinTable`: 10 per minute per IP
  - `performAction` / `startGame` / `resetGame` / `buyBack` / `kickPlayer`: 60 per minute per player ID
  - API GET: 120 per minute per IP

### REQ-4: Analytics
- REQ-4.1: `@vercel/analytics` MUST be installed and `<Analytics />` rendered in the root layout
- REQ-4.2: No cookie consent banner is required (Vercel Analytics is GDPR-friendly by default)

---

## Implementation Tasks

### Stage P1: Analytics + Favicon + Metadata base

- [ ] `npm install @vercel/analytics`
- [ ] Create `public/favicon.svg` — ♠ spade on #1a3d2b background
- [ ] Update `src/app/layout.tsx`:
  - Add `metadataBase`, full `openGraph`, `twitter`, `icons` entries
  - Import and render `<Analytics />`
- [ ] Update `src/app/(home)/layout.tsx` — remove duplicate metadata (handled by root)
- [ ] Create `src/app/robots.ts`
- [ ] Create `src/app/sitemap.ts`

### Stage P2: OG Images

- [ ] Create `src/app/opengraph-image.tsx` — home-page branded image (Edge ImageResponse)
- [ ] Create `src/app/(game)/table/[tableId]/opengraph-image.tsx` — per-table image with host name

### Stage P3: Table Page Metadata

- [ ] Rewrite `generateMetadata` in `src/app/(game)/table/[tableId]/page.tsx`:
  - Fetch table; read host name from `table.players[table.hostPlayerId]?.name`
  - Set rich OG + Twitter meta
  - Set `robots: { index: false, follow: false }` (private tables)
- [ ] Update `src/app/(game)/table/[tableId]/table-lobby.tsx`:
  - Replace `window.location.href` with canonical URL `https://airtexas.club/table/{tableId}`
  - Add WhatsApp share button

### Stage P4: Rate Limiting

- [ ] Update `src/lib/utils/ratelimit.ts` — add tiered limiters (`createJoin`, `action`, `api`)
- [ ] Wire `checkRateLimit` into all 7 Server Actions in `src/app/actions.ts`
- [ ] Wire `checkRateLimit` into `src/app/api/table/[tableId]/route.ts`

### Stage P5: CSP Update

- [ ] Update `next.config.ts` — add Vercel Analytics domain to `script-src` and `connect-src`

### Verification Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npm test -- --run` — all pass
- [ ] `npm run build` — clean
- [ ] Check OG preview at https://www.opengraph.xyz/
- [ ] `git add -A && git commit -m "feat: prod readiness — OG images, SEO, rate limiting, analytics"`
- [ ] `vercel --prod`
