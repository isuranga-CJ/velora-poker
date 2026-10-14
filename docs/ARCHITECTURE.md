# Architecture and isolated resources

## Working brand

Candidates: Velora Poker (recommended working name), Aurelian Poker, Orbit Royale, Rivora Poker, Lumina Poker. No trademark or domain clearance has been performed. Naming remains provisional.

## Current deployment topology

Browser → Sites-hosted React/Vinext frontend and public configuration route.

Separately runnable browser client → HTTPS + WSS → single Node 24 authoritative game server → private SQLite (development) or PostgreSQL (hosted) snapshot/audit store.

The browser receives only a player-scoped projection. The deck and other players' private cards never leave the authoritative process. A spectator receives null card placeholders until an eligible showdown. Folded hole cards stay hidden.

The Node server serializes mutations through one async queue, checks authentication/expiry and table revision, validates rules, updates balances and state, commits the selected storage transaction, then acknowledges/broadcasts. Failed command mutations restore the preceding snapshot. Duplicate IDs return acknowledgments without applying rewards or bets twice. Stale hand IDs and versions prevent old commands being used in a later hand.

## Free beta topology

Sites frontend → Cloudflare Worker → one SQLite Durable Object for the beta world. Supabase Free provides only account authentication. Hibernating sockets and alarms replace the Node process timers. The account is not authorized in the current runtime; no live Worker URL has been verified. This path does not require PostgreSQL, a Render card or a paid disk.

## Intended production topology

Frontend (Sites or Vercel) → regional dedicated Node WebSocket service → PostgreSQL in the same region. Supabase provides Auth and PostgreSQL. Later, Redis provides presence, routing and table ownership leases; it never independently settles wallets. One authoritative owner processes each table. Horizontal scaling requires fencing tokens and durable transactions before additional workers are enabled.

Start with one Singapore-region game service and measure real round-trip times. Add regional table pools only after operational testing. No global latency or concurrency capacity has been measured.

## Resource decisions

| Resource | State / next action |
|---|---|
| Isolated source repository | Created by the Sites publishing workflow; not a GitHub repository |
| `isuranga-CJ/velora-poker` GitHub repository | Created by the user; source uploaded and verified |
| Supabase organization | `isuranga-CJ's Org` was discovered; explicit organization selection and provider cost confirmation are required before provisioning |
| New Supabase project | Not created; do not reuse CJ Life Management or Royal Casino resources |
| Frontend Site | New `velora-poker-cj` project |
| Vercel | Connected `Z BORN GEN` team inspected; no existing project modified |
| Dedicated server | Render connected; My Workspace explicitly approved; free service deployment configuration ready |
| Storage | SQLite for local development; PostgreSQL required for hosted wallets; external database not yet provisioned |
| Paid services | None purchased, subscribed to, or provisioned |

## Relational target design — planned, not applied

Keep authoritative tables in an unexposed `poker_private` schema with no `anon`/`authenticated` grants; a dedicated database role gets only required statements. Enable RLS for defense in depth. Publish a minimal safe profile projection separately. Never subscribe clients to private game rows.

| Table | Key relationships / constraints |
|---|---|
| users | UUID PK referencing auth.users; server-owned account status; deletion/retention workflow |
| player_profiles | user PK/FK; case-insensitive unique username; controlled avatar URL; privacy flags |
| friendships | composite user/friend PK; no self edge; both user FKs; request/accepted/blocked state |
| virtual_wallets | user PK/FK; nonnegative bigint balance; version |
| wallet_transactions | UUID PK; user FK; unique idempotency key; signed delta; reason; resulting balance; timestamp |
| poker_tables | UUID PK; mode/capacity/blinds constraints; private password hash kept server-only |
| table_seats | table FK + seat-number PK; unique active user; nonnegative stack |
| game_sessions | session PK; table FK; region; owner/fencing version; state and recovery timestamps |
| poker_hands | hand UUID PK; session FK; rules version; private state and shuffle data; completed timestamp |
| player_actions | hand FK + sequence unique; user FK; request ID unique; prior/next revision; validated payload |
| hand_results | hand/user composite PK; contribution/payout; safe public board/result |
| tournaments | UUID PK; state; schedule; blind-level configuration; virtual prize configuration |
| tournament_entries | tournament/user composite PK; enrollment, table assignment, rank |
| achievements | achievement ID PK; criterion version; separate user_achievements junction |
| chat_messages | message UUID PK; table/user FKs; bounded text; moderation state |
| reports | report UUID PK; reporter/subject FKs; reason; review state |
| moderation_actions | action UUID PK; server-controlled admin actor FK; report FK; scope and audit timestamp |

Index all referencing FKs used for joins, active table lookups, wallet history `(user_id, created_at DESC)`, hands `(table_id, completed_at DESC)` and reports `(status, created_at)`. Use bigint integers for chips, not floating-point values.

Wallet operation: begin transaction; lock wallet and seat rows in a deterministic order; insert unique request receipt; validate sufficient balance; update wallet/seat; append immutable ledger; persist game revision/result; commit; emit response. Settlement IDs must be unique by hand and player. The caller never supplies a new balance or a winner.

Migration gate: create migration files using the Supabase CLI, apply only to the new project, run advisors and positive/negative RLS tests. No target SQL has been applied in this release.

## Budgets (targets, not measurements)

- Core frontend JS ≤ 250 KB gzip; lazy 3D bundle ≤ 450 KB gzip.
- First usable lobby ≤ 3 seconds on a measured midrange Android/4G profile.
- Main room ≤ 150 draw calls, ≤ 150k triangles and ≤ 96 MB texture/GPU asset memory.
- High quality target 60 FPS; low quality 30 FPS; DPR capped at 1.5 or 1 in low mode.
- WebSocket payload limit 8 KB; revisioned snapshots with backpressure; future per-table fanout/deltas.
- Server action validation/commit target p95 < 50 ms under the measured beta load; network latency measured separately.
- No externally loaded GLB models in the foundation release.

## Retention and operations — release gates

Before beta, define and implement retention jobs: delete expired guest sessions daily; private completed-hand secrets within 24 hours unless a scoped abuse investigation requires retention; redacted hand histories 90 days; chat 30 days; reports/audits under a documented policy. Current local development data is retained until its private database is deleted. Do not assume planned retention is active.

Back up production databases, test restore and crash recovery, set storage limits, configure error monitoring without tokens/cards, and rotate credentials through platform secret settings. Run only one instance until PostgreSQL ownership/fencing is implemented.
