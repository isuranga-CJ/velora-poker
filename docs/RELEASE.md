# Foundation release verification

## Passed

- TypeScript no-emit checking.
- Production frontend build with Sites/Vinext adapter.
- Engine tests: rank categories, wheel, shuffle uniqueness, heads-up action order, validation/no-mutation, full showdown, private-card projection, side pots and unmatched contribution refunds, split-pot odd chips, short all-ins and cumulative reopening, fold settlement, short blinds, dealer rotation, 200 simulated variable-action hands with chip conservation.
- Real network integration test: three explicitly simulated WebSocket clients, token authentication, unauthenticated denial, origin denial, joins/buy-ins, reward duplicate protection, full hand, spectator move denial, reconnect and private room password checks.
- SQLite restart test: sessions, table stacks and wallet restore.
- PostgreSQL SQL tests using PGlite: atomic snapshot/audit/history, duplicate audit safety, owner fencing, rollback on audit failure, and denial to anon/authenticated roles.
- Delayed persistence serialization and failed-commit acknowledgement denial; closed provisioning endpoints.

## Cloudflare free testing path

A separate SQLite Durable Object adapter is added in `workers/`. Local workerd tests verify the existing socket protocol, full hands, wallet state, privacy, room access and cold restart recovery. Auth is mocked only in tests; real Supabase/Cloudflare account integration remains unverified. See FREE_TESTING.md for the deployment steps and limits.

## Not verified or not implemented

- No browser-control skill is available in this managed environment. Browser UI, touch controls, WebGL rendering, accessibility interactions, physical-device FPS and mobile Safari/Android behavior have not been visually verified.
- The hosted game service can run in provisioning mode, which denies all game/account traffic until production configuration is ready. No global multiplayer or load-test capacity claim is made.
- Supabase project and production identity are not provisioned. Auth REST integration requires real-project tests, refresh/revocation flows and OAuth setup.
- PostgreSQL snapshot storage, atomic audit commits and a private schema setup script are implemented. SQL is tested with embedded PostgreSQL (PGlite); a real Supabase network connection and TLS are not yet tested. Unique handles, avatar uploads, full wallet history UI, friends lists, chat, emotes, reports, moderation, admin controls, collusion signals, achievements and tournaments are not implemented.
- PWA manifest is present, but offline caching/service worker, installation verification and offline-safe session handling are not implemented.
- Current card motion is a simple position interpolation. Advanced flips, collection, animated chip payouts, optimized GLB assets, adaptive FPS detection and comprehensive reduced-motion treatment remain later graphics work.
- Both storage paths are for a single authoritative process and rewrite the snapshot. PostgreSQL transactions include revision/owner fencing, but normalized per-table writes and regional scaling remain release gates.
- Current report and release figures do not represent a security certification.

## Next concrete milestone

1. Authorize the Cloudflare Free account or connect this GitHub repository through Workers Builds.
2. Create the new isolated Supabase Free project and verify test-account registration/email delivery.
3. Deploy the Worker and configure its Supabase URL/publishable key.
4. Wire the actual returned Worker URL into the existing Site, using `NEXT_PUBLIC_GAME_TRANSPORT=cloudflare`.
5. Verify two real accounts through a full hand and reconnect over the public internet; then run mobile QA and measure performance.

The Render/PostgreSQL path remains available for later hosting work. The free beta does not require its billing/card setup or its PostgreSQL schema.
