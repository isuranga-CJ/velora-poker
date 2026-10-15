# Velora Poker — foundation milestone

A new, isolated virtual-chip Texas Hold’em project. No Royal Casino repository, service, database, or deployment was changed.

## What works in this milestone

- React/TypeScript frontend with an original casino table composition, procedural Three.js lobby room, responsive lobby, card animations and chip stacks.
- Playable local practice against four explicitly labelled basic bots, using the shared Hold’em rules engine. Practice chips are isolated from online wallets and reset on refresh.
- Separate Node 24 WebSocket server: 2–9 player tables, secure shuffle, authoritative actions, heads-up blinds, betting streets, minimum raises, short all-ins, side pots, split pots and odd-chip allocation.
- Starting balance and daily rewards, table buy-ins/returns, atomic local snapshot + audit transactions, reconnect recovery, private password-protected rooms, spectator-safe views, action IDs and stale-state protection.
- Thirty-second turns, heartbeat detection, automatic hand starts, stored public showdown history. No bots appear as people.
- Real socket integration tests, persistence/restart tests, hand/rule tests and randomized chip conservation checks.

## Honest release boundaries

The deployed website is an **early-access frontend with local bot practice and a room preview**. Local practice does not require an account; it is not online multiplayer. The multiplayer server is implemented and tested locally. A hosted service may run in **provisioning mode** until its Auth and PostgreSQL configuration is present; provisioning mode exposes health/readiness only and denies gameplay. Online registration is explicitly closed until configuration exists. The Supabase email login path is implemented but not provisioned or integration-tested. Google login is not implemented.

Development uses a private **SQLite** file. The optional Node hosting path requires **PostgreSQL** with transactional snapshots and owner fencing. The free Cloudflare beta stores wallets and game state in SQLite Durable Objects; this version must not be horizontally scaled or advertised as production-ready. Supabase is not shared with another project. Account names in development are display names, not globally unique handles.

The frontend uses the supplied Sites Vinext (Next-compatible) deployment adapter; the game backend is separately deployable as the Cloudflare beta Worker or the Node service. Vercel frontend deployment is a prepared future option, not a completed deployment. Do not run the game server as a short-lived frontend function.

## Free Cloudflare beta option

The `workers/` adapter uses SQLite Durable Objects, WebSocket Hibernation and alarms. See [Free testing setup](docs/FREE_TESTING.md). This is now the recommended testing deployment path; Render/PostgreSQL remains an optional later path. The Cloudflare account is not yet authorized, so this source does not imply a live backend.

## Run locally

Requires Node 24+ and pnpm (exact package-manager version is in package.json).

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

For a regular local workstation, start the frontend and backend in separate terminals. The managed ChatGPT environment uses its own supervised preview workflow.

```sh
pnpm dev
```

```sh
DEV_GUEST_AUTH=true ALLOWED_ORIGINS=http://localhost:3000 pnpm server
```

Use the actual frontend origin shown by the dev server if it differs. Open Sign in → Local development connection, use `http://localhost:8080` and a player name. Open a separate browser profile for a second player. Join the same public table. The local guest endpoint is explicitly opt-in and the CLI binds it to loopback. Guest accounts are for development only.

## Production configuration (not yet provisioned)

Web frontend public configuration:

- `NEXT_PUBLIC_GAME_URL`: HTTPS origin of the dedicated game server, without `/ws`.
- `NEXT_PUBLIC_SUPABASE_URL`: new isolated Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public project key only.

Game server:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`: for server-side Auth user validation.
- `ALLOWED_ORIGINS`: exact comma-separated frontend origins. No wildcard.
- `DATABASE_URL`: a server-only PostgreSQL connection URL with verified TLS (use Supabase direct/session-pooler, not transaction pooling). Do not paste this secret in chat.
- `DATABASE_PATH`: local development SQLite path only.
- `PORT`: platform-assigned port (defaults to 8080).
- `DEV_GUEST_AUTH` must be unset in hosted environments.

Apply `server/schema.sql` to the new project before starting the hosted game. The schema is private and has no client grants. `server/migrate.ts` can apply it using a server-only database credential; use the Supabase connected SQL tool when available. No service-role key is needed by the current server. Never put a secret or service-role key in a public frontend variable. Supabase Auth tokens are checked against `/auth/v1/user`; expiration is enforced for connected sockets. Automatic refresh, revocation enforcement, password recovery and OAuth remain release gates.

## Files

- `game/engine.ts`: game state machine and rank evaluation.
- `server/app.ts`: HTTP/WebSocket transport, auth, wallet and snapshot persistence.
- `server/index.ts`: fail-closed server entry point with provisioning readiness.
- `server/storage.ts`, `server/schema.sql`: durable storage adapters and private PostgreSQL schema.
- `app/page.tsx`, `components/CasinoTable.tsx`, `components/PokerScene.tsx`: lobby and table clients.
- `components/PracticeTable.tsx`, `game/practice.ts`: isolated local practice with basic bots.
- `game/random.ts`: unbiased secure randomness shared across browser, Node and Workers.
- `tests/`: engine and genuine multi-client socket integration tests.
- `docs/ARCHITECTURE.md`: target architecture, resources, budgets and schema plan.
- `docs/RELEASE.md`: verified scope, pending work and deployment gates.
- `server/Dockerfile`: container for a single dedicated game-server instance.

## Assets and licensing

All table, chair, chip and card geometry and face textures are original procedural code in this repository. No proprietary casino artwork was copied. Lucide icons are ISC licensed; Three.js and React Three Fiber are MIT licensed. Optional DM Sans / Manrope web fonts use their upstream Google Fonts distribution; system fonts remain fallbacks. No stock image or GLB bundle is required.

## Safety of the economy

Virtual chips only. No purchase, deposits, withdrawals, transfers, redemption, prizes, or financial integrations. The “cash-out” audit reason means returning virtual table chips to the same player's virtual balance; it is not a money operation.
