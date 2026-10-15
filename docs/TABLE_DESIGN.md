# Casino table screen

The fixed landscape composition follows CJ's uploaded table reference: burgundy racetrack table, a central dealer, neon lounge, player circles, angled card pairs, visible bets and bottom action controls. The original app's artwork and code are not shipped.

The new CasinoTable component consumes the existing authoritative TableView. It rotates seats around the current player, supports 2/5/6/9-seat layouts, displays server-provided bets, stacks, pot, payout and turn deadline, and exposes no hidden cards. Preview mode shows empty seats and no simulated opponents or invented hands. Fold/check/call/raise/all-in reuse the existing socket actions and server-side validation. A pure client helper labels the best current visible hand; this is not a win-probability prediction.

Original asset: public/assets/velora-casino-room.webp. Generated with the built-in image generation tool. Prompt: Original game environment, wide 16:9, luxurious purple/cyan neon card-game lounge and night skyline; large empty burgundy racetrack oval poker table with black rail and silver betting line; frontal elevated seated-player camera; professional adult dealer in full-coverage black business jacket and white collared shirt, centered behind table; polished stylized 3D videogame art; no text, branding, cards, chips, avatars or UI. Cards, chip stacks and avatars are procedural CSS elements, not extracted artwork.

Use /?view=table to open the room directly. Portrait phones can horizontally scroll the landscape composition; landscape is the preferred view. Reduced-motion users receive no card-deal animations. The image-based room has no WebGL requirement; the existing procedural 3D lobby preview remains available.

Public multiplayer backend provisioning is still pending. This visual update does not open account registration or enable unconfigured hosted gameplay. Browser visual QA was unavailable in this environment; type checks, application build and automated game tests are reported separately.

## Local practice mode

`/?view=practice` runs a separate five-seat practice session: the player and four clearly labelled basic bots. The same Hold’em engine supplies dealing, legal actions, side pots, showdown, payouts and dealer rotation. Bots use only their own cards and the public board with a simple randomized policy; they are not advanced poker AI. Practice does not require authentication and cannot credit online wallets. Refresh clears the local session; restart resets all five stacks to 1,000.

The engine now uses a shared Web Crypto helper for Node, Workers and browsers. Rejection sampling avoids modulo bias in deck shuffling. Online actions remain server-authoritative; the browser runs the engine only for explicitly labelled local practice. Existing socket/runtime tests must pass after this shared-engine change.

## Audio and immersive view

Both preview/online tables and local practice share the same table media controls. Authored Web Audio effects distinguish card deals/flops, individual board cards, bets, checks, folds, your turn, final five-second countdown and winning/settlement. A first table interaction unlocks the browser audio context; a visible Tap for sound button is available before unlock. Mute and volume preferences persist locally, and unavailable audio reports a message rather than interrupting gameplay. Audio nodes disconnect when effects finish, and the context closes when leaving the table.

Fullscreen requests originate from the user's button tap on the actual table element. Supported browsers use native Fullscreen API with a best-effort landscape lock. Fullscreen changes synchronize the exit icon and release any orientation lock. Unsupported/blocked environments receive an explicitly labelled expanded table fallback; browser chrome can remain visible in this fallback. Escape exits fallback and the native browser exit remains available. Fullscreen includes sound/volume and exit controls. Phone-specific fullscreen/audio behavior has not been physically verified in this environment.

Visual polish keeps the current player's chip balance clear of the cards, removes the duplicated You label, adds a remaining-turn ring, and highlights winners. The game engine and practice bot policy are unchanged.
