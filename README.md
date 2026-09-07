# HomeGameHero

HomeGameHero is a private, offline-ready poker night calculator for chip distributions, blind schedules, tournament clocks, cash-game ledgers, and payouts. It is designed for quick use at the table and stores game state only in the browser.

**Live app:** https://charliepolito.com/homegame/

**Portfolio:** [charliepolito.com](https://charliepolito.com/)

**Source:** [github.com/cpolito17/homegamehero](https://github.com/cpolito17/homegamehero)

## Features

- Cash-game and tournament setup flows
- Chip-bank distribution and color-up calculations
- Blind schedule builder and tournament clock
- Buy-in, rebuy, cash-out, prize, and payout math
- Local snapshots, light/dark themes, and offline PWA support
- Responsive, accessible interface for phones and desktops

## Architecture and technology

This is a client-only React app. A typed reducer owns game state; pure TypeScript modules implement money, chips, blinds, distribution, and payout calculations. Vite produces static assets, while a service worker provides offline caching. The stack includes React, TypeScript, Vite, Tailwind CSS, Vitest, and Cloudflare Workers static assets. There is no application server or database.

## Local setup and scripts

Requires a current Node.js LTS release and npm.

```bash
npm ci
npm run dev
npm run test
npm run typecheck
npm run lint
npm run check:contrast
npm run build
npm run preview
```

## Environment variables

None are required. The app makes no authenticated API calls. Do not add credentials to client-side environment variables because Vite-exposed values are public.

## Deployment

The production build uses the `/homegame/` base path and writes to `dist/homegame`. `npm run deploy` builds and publishes through the assets-only Cloudflare Worker in `wrangler.jsonc`.

## Security and privacy

Game names and financial entries remain in browser storage. There are no accounts, analytics, external APIs, or server-side persistence. Shared-device users can clear site data to remove saved games. Release checks should include the test suite and `npm audit`.

## Status and license

This is an active personal project. No license file is included, so reuse rights are reserved by default.
