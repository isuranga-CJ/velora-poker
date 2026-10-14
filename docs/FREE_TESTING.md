# Free testing deployment

This is the prepared Cloudflare alternative to the Render card requirement. The adapter is functional in local workerd/Miniflare tests. It has not yet been deployed to a Cloudflare account.

## What changed

- `workers/index.ts` implements the existing WebSocket protocol using a SQLite-backed Durable Object.
- The shared `game/engine.ts` remains the authoritative poker rules implementation.
- One beta world owns tables and virtual balances. Mutations commit atomically to durable SQLite before an acknowledgement is emitted.
- Connections use WebSocket Hibernation. Turn timeouts, authentication deadlines and automatic hands use Durable Object alarms.
- Password-protected rooms use PBKDF2; token validation uses the new Supabase project's Auth server.
- Frontend `NEXT_PUBLIC_GAME_TRANSPORT=cloudflare` switches heartbeat messages to the runtime's hibernation auto-response.
- The Node/PostgreSQL backend remains available as a separate future hosting option. No existing resources are deleted.

## Explicit beta bounds

The code limits the beta to 40 simultaneous socket connections, 200 accounts and 25 rooms. These are application caps, not measured capacity guarantees. It uses a single authoritative world, not regional sharding. Free hosting quotas, load capacity, real account verification and physical mobile devices still require deployment testing.

Cloudflare Free supports SQLite Durable Objects. On a Free account, exceeding included quotas causes operations to fail. Stay on Workers Free; do not activate Paid, KV-backed legacy Durable Objects, R2, a paid domain, or a paid database for this test.

Official references:
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://www.cloudflare.com/products/workers/
- https://supabase.com/pricing

## Local checks

Requires the root dependencies already installed.

```sh
pnpm typecheck
pnpm test:all
pnpm worker:check
```

The Cloudflare integration tests launch the actual local workerd runtime with SQLite Durable Objects. The Supabase response is an explicit test fixture; it is not a real user or a production auth integration. Tests cover a complete hand with three simulated sockets, private-card protection, spectator denial, duplicate daily rewards, password permissions, cold restart recovery, origin/auth/configuration denial, automatic hand start and turn expiry. The tests do not claim a forced hibernation or a real internet deployment has been verified.

## Android-friendly deployment via GitHub

1. Create/sign in to a Cloudflare account and keep Workers on the Free plan.
2. In Workers & Pages, create a Worker from the `isuranga-CJ/velora-poker` GitHub repository. Grant this repository to Cloudflare's own GitHub integration if prompted; the ChatGPT GitHub permission is separate.
3. Use repository root `.` and production branch `main`.
4. Build command: leave blank. Deploy command: `pnpm worker:deploy` (equivalent to `wrangler deploy --config workers/wrangler.jsonc`). The repository pins Wrangler and includes its dependencies.
5. Use Worker name `velora-poker-beta`, matching the config. The `v1` migration creates the SQLite namespace; do not change it to a KV namespace.
6. Configure runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the new isolated Supabase Free project. The publishable key is public; never use a service-role key. `ALLOWED_ORIGINS` is already the frontend Site origin.
7. Deploy. An unconfigured Worker deliberately reports readiness false and denies gameplay.
8. Verify `/health` and `/ready` on the actual returned `workers.dev` URL. Share the returned Worker URL and the Supabase project URL with the assistant for frontend wiring and real-user testing.

Create the new Supabase project in the approved organization only if its dashboard shows the intended $0 Free option. Do not reuse CJ Life Management Auth. Supabase's default email delivery can limit which test users receive confirmations; verify email delivery before claiming friends can register. Avoid paid SMTP setup while beta access is being tested.

## CLI alternative

On a local workstation that you control:

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put SUPABASE_URL --config workers/wrangler.jsonc
pnpm exec wrangler secret put SUPABASE_PUBLISHABLE_KEY --config workers/wrangler.jsonc
pnpm worker:deploy
```

Authorization belongs in Cloudflare's login/dashboard, not in chat or committed files. The current agent runtime is not authenticated to Cloudflare, so no deployed backend URL exists yet.

## Frontend wiring after Worker deployment

Configure the existing Site's runtime environment:

- `NEXT_PUBLIC_GAME_URL`: the returned HTTPS Worker origin, without `/ws`.
- `NEXT_PUBLIC_GAME_TRANSPORT`: `cloudflare`.
- `NEXT_PUBLIC_SUPABASE_URL`: the new project's URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key.

Then test two independently authenticated accounts joining the same table, a full hand, wallet return, reconnect, and private-room permissions over the public internet. Only then label online play open.
