# Foundation release verification

## Passed

- TypeScript no-emit checking.
- Production frontend build with Sites/Vinext adapter.
- Engine tests: rank categories, wheel, shuffle uniqueness, heads-up action order, validation/no-mutation, full showdown, private-card projection, side pots and unmatched contribution refunds, split-pot odd chips, short all-ins and cumulative reopening, fold settlement, short blinds, dealer rotation, 200 simulated variable-action hands with chip conservation.
- Real network integration test: three explicitly simulated WebSocket clients, token authentication, unauthenticated denial, origin denial, joins/buy-ins, reward duplicate protection, full hand, spectator move denial, reconnect and private room password checks.
- SQLite restart test: sessions, table stacks and wallet restore.
- PostgreSQL SQL tests using PGlite: atomic snapshot/audit/history, duplicate audit safety, owner fencing, rollback on audit failure, and denial to anon/authenticated roles.
- Delayed persistence serialization and failed-commit acknowledgement denial; closed provisioning endpoints.

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

1. GitHub source is synced to isuranga-CJ/velora-poker.
2. Confirm the new Supabase organization and provider-quoted cost; create a Singapore project and provision account configuration.
3. Deploy the dedicated Render service on the free plan, then configure its existing production environment once Auth/database are available.
4. Apply server/schema.sql only to the new project and run external PostgreSQL/RLS/restore tests.
5. Deploy the server, configure the frontend origin, and verify two independent browser accounts through a complete hand over the public internet.
6. Only then open public multiplayer registration, followed by mobile QA and performance measurement.
