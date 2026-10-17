# Friends Cup beta

A free-entry, single-table Texas Hold’em freezeout for 2–6 signed-in members.
Tournament chips cannot be added to or returned to a player's daily-chip wallet.
The title is the reward: there is no cash prize, redemption, entry fee or wallet payout.

## Host and play

1. Open **Tournaments / Cups** and sign in.
2. Create a named Cup. Creating an event does not register its host.
3. Register and share the Cup invite link. Friends sign in and register too.
4. The host starts when all 2–6 registered players are online. The host may play or observe.
5. Seats are shuffled; each entrant receives 5,000 chips. Hands deal automatically with a seven-second results interval.
6. Follow live standings from the table strip or tournament lobby. Final placements persist across Worker restarts.

All beta Cups are visible to signed-in members. An invite link identifies the event; it is not a private access token.
Registration reserves one playing place across cash tables and Cups. Withdrawal and cancellation are allowed before start only.
A running player's seat is reserved until elimination. Disconnection is not withdrawal: blinds continue and the 30-second timeout checks or folds. Sign in with the same account to return.
Eliminated players may watch or join another game. Tournament balances never fund that game's buy-in.

## Structure

Each level lasts six minutes, measured by server time since the host starts the Cup.
Blinds change only when a new hand is dealt. A hand already in progress retains its original blinds.

| Level | Small / big blind |
| --- | --- |
| 1 | 25 / 50 |
| 2 | 50 / 100 |
| 3 | 75 / 150 |
| 4 | 100 / 200 |
| 5 | 150 / 300 |
| 6 | 200 / 400 |
| 7 | 300 / 600 |
| 8 | 500 / 1,000 |
| 9 | 750 / 1,500 |
| 10 | 1,000 / 2,000 |
| 11 | 1,500 / 3,000 |
| 12 | 2,500 / 5,000 |
| 13 | 5,000 / 10,000 |
| 14+ | 10,000 / 20,000 |

No antes, late entry, pause, re-entry, rebuys or add-ons. Last funded player is champion.
Players eliminated together are ordered by their stacks at the beginning of the hand. Equal starting stacks share a rank; later ranks skip those tied places.

## Verification and remaining limits

Automated tests exercise whole six-player engine Cups, blind transitions, tied eliminations, disconnected participation, chip conservation and JSON restoration.
Miniflare integration tests exercise actual Worker WebSockets with simulated verified identities: host authorization, duplicate request IDs, hidden cards, wallet isolation, final placements and durable restart.
These tests do not prove production Supabase sessions or live multi-device gameplay works.

Before a wider beta, test two real accounts in one Cup on separate phones, disconnect/rejoin mid-hand, complete a Cup and verify both wallet balances. Check portrait/fullscreen, standings controls and screen-reader focus on devices.

This is the existing single-authority limited beta: 40 concurrent sockets, 200 accounts and 25 rooms including stored Cup results. Capacity planning, archival, load testing and moderation remain required before international scale.
Multi-table scheduling, table balancing, late registration, league points, qualifiers and season standings are not implemented by this release.

Backend changes on main run the pinned deployment workflow after poker/tournament rule tests. The readiness check requires the Friends Cup feature marker; it is configuration/deployment evidence, not multiplayer acceptance.
