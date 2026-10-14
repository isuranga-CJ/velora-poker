# Foundation release verification

## Passed

- TypeScript no-emit checking.
- Production frontend build with Sites/Vinext adapter.
- Engine tests: rank categories, wheel, shuffle uniqueness, heads-up action order, validation/no-mutation, full showdown, private-card projection, side pots and unmatched contribution refunds, split-pot odd chips, short all-ins and cumulative reopening, fold settlement, short blinds, dealer rotation, 200 simulated variable-action hands with chip conservation.
- Real network integration test: three explicitly simulated WebSocket clients, token authentication, unauthenticated denial, origin denial, joins/buy-ins, reward duplicate protection, full hand, spectator move denial, reconnect and private room password checks.
- SQLite restart test: sessions, table stacks and wallet restore.

## Not verified or not implemented

- No browser-control skill is available in this managed environment. Browser UI, touch controls, WebGL rendering, accessibility interactions, physical-device FPS and mobile Safari/Android behavior have not been visually verified.
- The game server is not deployed. No global multiplayer or load-test capacity claim is made.
- Supabase project and production identity are not provisioned. Auth REST integration requires real-project tests, refresh/revocation flows and OAuth setup.
- PostgreSQL migration, unique handles, avatar uploads, full wallet history UI, friends lists, chat, emotes, reports, moderation, admin controls, collusion signals, achievements and tournaments are not implemented.
- PWA manifest is present, but offline caching/service worker, installation verification and offline-safe session handling are not implemented.
- Current card motion is a simple position interpolation. Advanced flips, collection, animated chip payouts, optimized GLB assets, adaptive FPS detection and comprehensive reduced-motion treatment remain later graphics work.
- Current snapshot persistence is for one process only, and rewrites the state. It must be replaced with bounded PostgreSQL transactions before production load.
- Current report and release figures do not represent a security certification.

## Next concrete milestone

1. Create the independent GitHub destination and sync the existing tested source.
2. Confirm the new Supabase organization and provider-quoted cost; create a Singapore project and provision account configuration.
3. Connect a dedicated hosting provider, inspect its plan and obtain approval for any cost.
4. Replace the local store with transactional PostgreSQL; run RLS, concurrency and restart tests.
5. Deploy the server, configure the frontend origin, and verify two independent browser accounts through a complete hand over the public internet.
6. Only then open public multiplayer registration, followed by mobile QA and performance measurement.
