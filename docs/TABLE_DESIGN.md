# Casino table screen

The fixed landscape composition follows CJ's uploaded table reference: burgundy racetrack table, a central dealer, neon lounge, player circles, angled card pairs, visible bets and bottom action controls. The original app's artwork and code are not shipped.

The new CasinoTable component consumes the existing authoritative TableView. It rotates seats around the current player, supports 2/5/6/9-seat layouts, displays server-provided bets, stacks, pot, payout and turn deadline, and exposes no hidden cards. Preview mode shows empty seats and no simulated opponents or invented hands. Fold/check/call/raise/all-in reuse the existing socket actions and server-side validation. A pure client helper labels the best current visible hand; this is not a win-probability prediction.

Original asset: public/assets/velora-casino-room.webp. Generated with the built-in image generation tool. Prompt: Original game environment, wide 16:9, luxurious purple/cyan neon card-game lounge and night skyline; large empty burgundy racetrack oval poker table with black rail and silver betting line; frontal elevated seated-player camera; professional adult dealer in full-coverage black business jacket and white collared shirt, centered behind table; polished stylized 3D videogame art; no text, branding, cards, chips, avatars or UI. Cards, chip stacks and avatars are procedural CSS elements, not extracted artwork.

Use /?view=table to open the room directly. Portrait phones can horizontally scroll the landscape composition; landscape is the preferred view. Reduced-motion users receive no card-deal animations. The image-based room has no WebGL requirement; the existing procedural 3D lobby preview remains available.

Public multiplayer backend provisioning is still pending. This visual update does not open account registration or enable unconfigured hosted gameplay. Browser visual QA was unavailable in this environment; type checks, application build and automated game tests are reported separately.
