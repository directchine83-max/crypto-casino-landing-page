# AGENTS.md

Next.js 16 (App Router) + TypeScript + pnpm casino site ("Live Roll"), v0-bootstrapped. Every merge to `main` auto-deploys to Vercel (`crypto-casino-landing-page`). **Solana-only and non-custodial**: the player's Phantom wallet signs every action; the server must never hold or generate a private key.

## Commands
- Use **pnpm** (pinned `pnpm@12.3.4`; `pnpm-lock.yaml`). `pnpm dev` / `pnpm build` / `pnpm start`.
- There is **no lint config/script** and no test suite. `pnpm build` runs the TypeScript typecheck; `npx tsc --noEmit` is the fast check.
- `node airdrop.mjs` — dev-only devnet helper (funds a fresh keypair via repeated airdrops).

## Architecture
- `app/page.tsx` — the whole casino UI in one `'use client'` component (Phantom connect via `window.solana`, bet flow, provably-fair modal, fr/en copy persisted in `localStorage.rollbit.lang`). Most UI work lands here.
- `app/[slug]/page.tsx` — static info pages (games/provably-fair/rewards/docs/discord/terms); SSG with `generateStaticParams`, `dynamicParams = false`.
- Backend (all `app/api/*` Solana/Telegram routes use `export const runtime = 'nodejs'`):
  - `lib/solana/*` — entire betting backend: `config.ts` (env → `SolanaConfig`), `connection.ts` (cached RPC `Connection`), `transaction.ts` (builds **unsigned** transfer), `send.ts` (relays player-signed tx), `verify.ts` (Ed25519 via `@noble/curves`), `amounts.ts` (lamports ↔ SOL, bigint, 9 decimals — never float math), `client.ts` (typed fetch wrapper used by the browser).
  - `lib/fair.ts` + `lib/fair-store.ts` — provably fair: HMAC-SHA256 roll derivation, in-memory `Map` on `globalThis` capped at 500; `reveal` deletes the commitment (one-shot).
  - `lib/house.ts` — house edge (`HOUSE_EDGE_BPS`, capped 2000) → payout factor.
  - `lib/telegram/*` — bot webhook at `/api/telegram` (commands `/ping /house /treasury /stats /ip /chatid`). Telegram uses HTML parse mode: **escape every interpolated value with `escapeHTML`**. Bet/ads notifications throttled to 5 per 30 s.
  - `lib/monetag.ts` + `components/monetag-overlay.tsx` — Monetag ad overlay.
  - `middleware.ts` — bot/crawler 302 redirect on `/` **only** and only when `BOT_REDIRECT_URL` is a valid `http(s)://` URL.
- **No DB / no persistence**: fair commitments, recent-games list, ad counters, Telegram throttle are all in-memory on `globalThis`, per server instance. Don't rely on them for durable data.
- `data/` (gitignored), the legacy env vars (`ETHEREUM_*/BITCOIN_TREASURY_ADDRESS`, `MASTER_ENCRYPTION_KEY`, `AI_GATEWAY_API_KEY`, `V0_*`) and the old `lib/wallet/*` + `app/api/{wallets,deposits,withdraw,balance}` were a **removed custodial multi-chain wallet system** (working tree is mid-migration to the Solana system). Don't reintroduce custodial wallet code or server-side private keys.
- `pnpm-workspace.yaml` exists only for pnpm config (`minimumReleaseAgeExclude`, `allowBuilds`), not a monorepo. `.opencode/skills/` and `bashrc/` are v0 sandbox tooling / shell setup — ignore them.

## Pitfalls
- Explorer links: `SolanaConfig.explorerTxUrl` / `explorerAddressUrl` are **base URLs**; append the id (signature/address) **then** `config.explorerQuery` (e.g. `?cluster=devnet`). Appending the query before the id breaks devnet links.
- On-chain betting routes (`/api/solana/transaction`, `/send`, `/fees`) return 503 unless the treasury is configured (`SOLANA_TREASURY_ADDRESS` set) and `SOLANA_SEND_ENABLED !== 'false'`; `/balance`, `/verify`, `/info` work without it.
- `/api/fair` actions: `commit` / `roll` / `reveal` / `verify`. `reveal` deletes the seed — a second reveal returns 404 and the client falls back silently.
- Recent-games seed + new roll entries (`/api/games`) are **SOL / Solana base58** — the project migrated off the old ETH/0x branding.
- Env doc lives in `.env.example`. `*.local` and `.vercel/` are gitignored — never read or commit real secrets.