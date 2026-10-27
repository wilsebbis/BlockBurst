# 🧱 Block Burst

A cozy web block puzzle in the style of Block Blast. Drag pieces from a tray of three onto an 8×8 board, and fill whole rows or columns to clear them. Every piece is a soft pastel creature with googly eyes, and every level happens somewhere: a sunny beach, a rainy pond, the nursery.

Block Burst is the focused version of [wilsebbis/blockblastclone](https://github.com/wilsebbis/blockblastclone). It keeps all of that game's gameplay, art, animation and music and drops everything around it. It opens on one screen:

* **▶ Play Level N:** the Adventure trail, played in order. Clear a level and the next one opens.
* **🌷 Sanctuary:** the blobs you clear off the board live on in a little garden.
* **🐧 Penguin Exhibit:** the calm pond from [wilsebbis/blockoutclone](https://github.com/wilsebbis/blockoutclone), where a penguin floats on its ring, sips lemonade or sunbathes, and can be dragged or steered by tilting the phone.
* **⚙️ Settings:** pick the theme (follow the worlds, or stay in one of the eleven places), sound and music, assists and comfort options.

There is no Classic mode, no Classic look, no Daily Board, no gift box or calendar, no challenges, Blast Pass, collection, events, shop, store, ranks, leagues or crews, and no ads.

## Quick start

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # Vitest: rules, generator, level proofs, replay verifier, progress, Sanctuary, exhibit, playbook
npm run verify-boards   # prove Adventure levels 1–70 (pass a number for more)
npm run build           # type-check + production build
```

**Controls:**

* **Touch or mouse:** drag a piece from the tray. It floats above your finger so you can see where it lands.
* **Keyboard:** **1 / 2 / 3** pick a piece, the **arrow keys** move it, **Enter** or **Space** places it, **Esc** or **P** pauses.

While you drag, the lines a piece would clear light up in its colour. Hiding the tab pauses the game. An unfinished level survives a reload: its moves are saved and replayed, and Home offers **Continue**.

## How a level works

* **Goals.** Most levels start with a few blocks carrying 💎 gems; clear their lines to collect them. Every fifth level asks for a 🎯 score instead.
* **Pieces.** Each tray holds three pieces from a catalogue of 41 fixed shapes (lines, squares, rectangles, corners, L, J, T, S, Z and diagonals). Pieces never rotate. When all three are placed, three more are dealt. The level ends when none of your pieces fit.
* **Scoring:**
  * 1 point per cell placed.
  * A clear scores **10 × cells cleared × lines cleared × combo**.
  * The **combo** counts clears in a row. It survives two placements without a clear and ends on the third.
  * Emptying the whole board is a **Perfect Clear**, worth +300.
* **Stars.** Every level was beaten by Burst Bot before it shipped; its move count is the ⭐⭐⭐ par.
* **Coins.** A cleared level pays a chest of coins (50 a star, plus 50 for each world past the first). The Sanctuary's Species Log thanks you with coins too. There is nothing to buy with real money.
* **Out of room?** The fail card offers one free revive a level ("Wipe their tears"), or **Start Over**.
* **Worlds.** Ten levels to a world: Candy Coast (Sunny Beach), Jelly Jungle (Whispering Forest), Crystal Caves (Crystal Caverns), Neon Nights (Firefly Twilight), Frosty Peaks (Snowy Peaks), Lava Lagoon (Lantern Mines) and Star Station (Cloud Islands). Then the trail loops with harder boards. A theme picked in Settings replaces the world's place on every level.

## Layout

| Path | What lives there |
| --- | --- |
| `src/engine/` | The game, unchanged from blockblastclone: pure rules and generator (`rules.ts`, `generator.ts`, `board.ts`, `levels.ts`, `bot.ts`, `RunLog.ts`), the canvas controller and renderer, the Cozy creatures, scenes, celebrations, praise and the synthesised sound and music. |
| `src/exhibit/` | The Penguin Exhibit, ported from blockoutclone: a pure pond simulation (`pond.ts`, `tricks.ts`, `tuning.ts`) and its canvas shell (ripples, splashes, wind, chroma-keyed penguin clips, tilt). |
| `src/app/` | The five screens: Home, Play, Sanctuary, Penguin Exhibit and Settings. |
| `src/stores/useMetaStore.ts` | Adventure progress, coins, the Sanctuary and settings, persisted in IndexedDB. |
| `public/exhibit/` | The penguin's idle image and its two silent trick clips. |

The engine keeps the drawing paths and modes it had in blockblastclone (Classic blocks, the Daily Board layout); the app only ever starts Adventure levels in the Cozy look.

[`docs/DESIGN.md`](docs/DESIGN.md) is blockblastclone's design record. It still describes the engine accurately; its sections on the removed meta systems are history.
