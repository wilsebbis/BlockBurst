# 🧱 Block Burst

A web block puzzle in the style of Block Blast. Drag pieces from a tray of three onto an 8×8 board, and fill whole rows or columns to clear them. Clear several at once, or keep clearing move after move, for big combos. The game ends when none of your pieces fit.

Around that core loop there is:

* a **Daily Board**, the same start for everyone each day;
* an **Adventure** trail of gem-collecting levels;
* **Ranks** from Bronze to Legend;
* weekly **Leagues**;
* the **Blast Pass**, a season pass;
* a rotating **Item Shop**;
* a **Mystery Crate** with published odds;
* **Crews** (clans);
* daily and weekly challenges, gifts, events and trophies.

It's built on the same foundations as the other games in this account:

* [Bark Battle](https://github.com/wilsebbis/Dog-Meowdoku);
* [Project AntLink](https://github.com/wilsebbis/FlowStyleGame);
* [Cluck Crossing](https://github.com/wilsebbis/CrossyRoadClone).

They share a deterministic engine, seeded UTC dailies, hash-chained replay logs, procedural Web Audio, a thumb-zone layout, and the same humane free-to-play guardrails, enforced by tests.

It also follows an animation, games, monetization and design reference section by section. [`docs/DESIGN.md`](docs/DESIGN.md) maps every item, including what was declined and why.

## Quick start

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # Vitest: rules, generator fairness, level proofs, replay verifier, meta systems, playbook rules
npm run verify-boards   # bot-play and replay the next 14 Daily Boards, prove Adventure levels 1–70
npm run build           # type-check + production build
```

**Controls:**

* **Touch:** drag a piece from the tray. It floats above your finger so you can see where it lands.
* **Mouse:** drag a piece from the tray.
* **Keyboard:**
  * **1 / 2 / 3** pick a piece;
  * the **arrow keys** move it;
  * **Enter** or **Space** places it;
  * **Esc** or **P** pauses.

While you drag, the lines a piece would clear light up in its colour. Pieces that can't fit anywhere are greyed out in the tray. Hiding the tab pauses the game. An unfinished game survives a reload: its moves are saved and replayed.

## How a game works

* **Pieces.** Each tray holds three pieces from a catalogue of 41 fixed shapes:
  * lines of 1–5;
  * 2×2 and 3×3 squares;
  * 2×3 rectangles;
  * small and big corners;
  * every L and J;
  * T, S and Z;
  * diagonals.

  Pieces never rotate. When all three are placed, three more are dealt.
* **Scoring:**
  * 1 point per cell placed.
  * A clear scores **10 × cells cleared × lines cleared × combo**.
  * The **combo** counts clears in a row. It survives two placements without a clear and ends on the third.
  * Emptying the whole board is a **Perfect Clear**, worth +300.

### A deterministic engine, and a fair generator

The game is split into two layers:

* **The logical layer** (`src/engine/rules.ts`) is pure and deterministic. It uses an 8-bit row mask per board row, so every rule question is a few integer operations.
* **The visual layer** (`src/engine/GameController.ts`, `src/engine/renderer.ts`) only draws what the rules decided.

**The tray generator** (`src/engine/generator.ts`) does what makes Block Blast feel fair, openly and deterministically:

1. Candidate *k* for tray *n* is drawn from its own RNG stream, `burst/deal/v1/<seed>/<n>/<k>`.
2. The first candidate whose three pieces **can all be placed**, in some order with clears in between, is dealt.
3. In long Classic games it looks at fewer candidates and big pieces get more common, so games end. This ramp depends on the tray number only.
4. **Combo spikes.** Some trays, decided by their own stream `burst/spike/v1/<seed>/<n>`, look through 24 more candidates. They deal the fully placeable tray whose best play clears the most lines at once and keeps clears coming (`comboPotential`). Spikes come more often while a combo streak is alive, carrying it toward ten, and when lines are nearly full. They ease off after a streak of ten so it can end: tension, then big payoffs. With human-like play (a sloppy Burst Bot over 60 games) they lift lines cleared from 22.8 to 31.0 a game, games with a 10-clear streak from 16 to 26, and games with a 3+ line clear at once from 7 to 24.

The generator reads the seed, the tray number, the board and the combo count, and **nothing else**: never the player, their history or their spending. A playbook test checks its imports. Changing the dealer bumped the rules version (`burst-2`), so runs and saved games from the old dealer are never replayed against the new one.

Because the same config and the same moves always give the same game, three features fall out of this:

* **Replays and anti-cheat** (`src/engine/RunLog.ts`).
  * Every move is logged and SHA-256 hash-chained: `h0 = H(rulesVersion | mode | seed | level)`, then `hᵢ = H(hᵢ₋₁ | slot r c)`.
  * `verifyRun` replays the log with the real rules. It rejects:
    * illegal moves;
    * moves after the end;
    * forged scores or line counts;
    * bad hashes;
    * impossibly fast games.
  * The Daily screen re-verifies your stored best on your device.
* **Burst Bot** (`src/engine/bot.ts`), a greedy one-move-ahead player. It is:
  * the labelled `[BOT]` on every board, with a real score on today's Daily Board;
  * the opt-in 💡 **Hint** assist;
  * the Adventure level verifier.
* **Resume.** An unfinished game is just its request and its move log.

### Modes

* **Classic.** An empty board and a fresh seed every game. Every Classic game without hints counts for your rank.
* **Daily Board.**
  * The seed is `burst/daily/v1/YYYY-MM-DD` (UTC). The board starts with a mirror-symmetric pattern, the same worldwide.
  * You can play as often as you like, and your best score counts.
  * A 4-week calendar lets you practise past boards. Practice doesn't affect your streak.
  * **Share text** is spoiler-free, and there's a 1080×1920 **brag card**:

    ```
    🧱 Block Burst · Daily Board 2026-10-25
    🏁 12,480 · ➖ 41 lines · 📅 14 days
    🔥 x7 combo  ✖️ 3 at once  ✨ 1 perfect
    🟦🟦🟦🟦🟦🟦🟦🟦⬜⬜
    Same start for everyone today.
    ```
* **Adventure** (`src/engine/levels.ts`).
  * Levels are built from their number, 10 to a world across 7 worlds, then the trail loops.
  * Most levels start with clustered blocks carrying 💎 gems: clear the lines that hold them. Every fifth level asks for a score.
  * **Every level is proven before it is shown.** Burst Bot plays it with the real rules and generator, and a layout variant only ships if the bot meets the goal.
  * Score targets are set below what the bot reached.
  * The bot's move count is the ⭐⭐⭐ par. Tests prove levels 1–60.

## Meta systems

The unlock ladder shows the fun first and delays every ask. Locked features stay visible with a 🔒 Lv N badge, and each unlock gets one celebration.

| Level | Unlocks |
| --- | --- |
| 1 | Classic, Adventure, Collection |
| 2 | **Daily Board**, Challenges, Gift Box and Calendar |
| 3 | **Item Shop**, **Mystery Crate** |
| 4 | **Ranks**, **Leagues**, the Store button on Home |
| 5 | **Blast Pass**, **Events** |
| 6 | **Crews** |

A game pays:

* **XP:** 10 + 3 per line cleared, plus 40 for the day's first Daily Board and 30 for an Adventure win, capped at 250;
* **coins:** 1 per 2 lines and 10 per Perfect Clear, plus 15 per new Adventure star.

* **Ranks** (`src/lib/ranks.ts`). A skill ladder: Bronze, Silver, Gold, Platinum, Diamond, Master and Grandmaster, each with divisions III–I, then Legend.
  * Each Classic game is scored against your division's **par**, which rises every division:
    * double par: +35 RP;
    * par: +25;
    * half of par: +10;
    * below: −10.
  * **Tier gates are floors:** you can slip a division, never out of a tier.
  * **Seasons** last 6 weeks. You keep a reward for your best tier (coins, plus a badge or skin from Silver up), and RP eases down one tier.
  * Games with hints never count.
* **Leagues** (`src/lib/leagues.ts`). Each week you race on XP in a group of 30, across 7 leagues from 🪨 Pebble to 🌈 Prism.
  * The top 7 move up. **Nobody moves down**, and a week off changes nothing.
  * The other 29 racers are labelled practice bots, with a deterministic pace that never reacts to you.
* **Blast Pass** (`src/lib/pass.ts`). 28-day seasons of 30 tiers, with every reward visible from day 1.
  * The free track has coins and cosmetics.
  * The **Gold Pass** is a flat $2.99 and cosmetic only. It never grants coins.
  * There are no tier skips, and nothing expires.
  * It's tuned so that most-days players finish and casual players get a good way in (tested).
* **Item Shop** (`src/lib/shop.ts`).
  * **Two featured slots** change every Monday, and **four daily slots** change at 00:00 UTC.
  * Coins only, at fixed prices by rarity.
  * The rotation is public: the shop shows the next three days, and the Collection says the day each item is next in the shop.
  * Every item returns within 3 weeks (tested). There are no timers, "last chance" messages or personalised offers.
* **Mystery Crate** (`src/lib/crates.ts`).
  * Coins only, and coins are never sold.
  * **Published odds** are 60 / 28 / 9 / 3%, redistributed when you finish a rarity.
  * **Never a duplicate.**
  * **Pity:** Epic or better within 10 crates, Legendary within 30.
  * **Seeded:** each crate's randomness comes from a per-install salt and the crate number, so reloading never rerolls it.
  * An honest reveal glow.
  * Every crate item can also be bought outright for its coin price.
* **Collection** (`src/lib/cosmetics.ts`). 58 cosmetics, all looks only:
  * block **skins**: glossy, flat, jelly, pixel, gem, neon, wood, candy, ice and lava styles;
  * board **themes**;
  * clear **bursts**: sparks, confetti, stars, bubbles, hearts, pixels, snow and embers;
  * **avatars**.

  Every item shows its one way in.
* **Crews** (`src/lib/crews.ts`). Up to 10 players.
  * **20% of your XP is mirrored** into the crew's weekly pool. It's copied, never taken.
  * Milestones pay everyone the same. The top one is the Crew Colours theme.
  * There are **no contribution rankings, no minimums and no kicking**.
  * Quick chat uses fixed friendly phrases only.
  * A daily "share a gift" has the game pay every member.
  * You can join by invite link (`?crew=CODE`). **Play solo** leaves any time.
  * Offline, the other members are labelled practice bots.
* **Daily streak** (`src/lib/streak.ts`).
  * The headline is **total days played**, which never goes down.
  * Free rest days cover missed days, and there's a vacation mode.
  * There are no countdowns and no paid freezes.
* **Challenges.** Three per UTC day plus an all-clear bonus, and three weekly quests.
* **Gift Box and Gift Calendar.**
  * The box fills while you're away, up to an 8-hour cap, then waits.
  * The calendar moves one step on any day you play, and gaps never reset it.
* **Events** (`src/lib/events.ts`). A public calendar, exportable as `.ics`, with no countdowns:
  * **Weekend Coin Fest** really doubles coins.
  * **Block Party** week dresses the Daily Board and doubles crew gifts.
  * **Spring Bloom**, **Lava Lagoon** and **Frosty Fortnight** each give cosmetics that come back every year.
* **Trophies.** 18, earned only by play.
* **Reminders** (`src/lib/notify.ts`). Opt-in, offered after a positive moment through our own card.
  * At most one a day, never 22:00–08:00.
  * Each one is tied to something real, and they stop after 3 go unopened.
  * There's also an opt-in app-icon badge of real claimables, and a **glance page** (`?glance=streak`).

### Ads and the store

* **Sponsor breaks** (`src/lib/ads.ts`, `src/lib/adService.ts`):
  * **Rewarded:** opt-in from the Item Shop, 🪙 20 each, 3 a day.
  * **Interstitials:** only between games, after you close the results, at most one every 3 games and 2 minutes. Never in your first 8 games, never mid-game, never on the game-over or pause screens.
  * **No banners.**
  * A consent card comes first, and players under 16 get contextual ads only.
  * On Poki or CrazyGames their SDKs are used. Otherwise a demo placeholder says that no ad network is connected.
* **Store (demo)** (`src/app/StoreScreen.tsx`):
  * the Gold Pass;
  * cosmetics you pick yourself at $0.99;
  * a one-time starter pack (you pick both items, no timer);
  * **No sponsor breaks** for $1.99;
  * an optional tip.

  Purchases are blocked under 16. There's a $50 hard monthly ceiling (per calendar month and over any rolling 30 days), and you can set a lower limit. No payment provider is connected.
* **Remote config** (`src/lib/liveConfig.ts`).
  * Ad frequency and rewarded payouts can be tuned remotely within bounds.
  * Odds, prices, the generator, scoring, rank par and caps are locked in the client.

### Scenery (Cozy look)

Cozy games are played in one of eleven pastel places, each with its own gentle weather and an outfit the creatures wear while they're there:

| Place | Weather | Outfit |
| --- | --- | --- |
| Wildflower Meadow | drifting petals | daisy chains |
| Whispering Forest | falling leaves, sunbeams | mushroom caps |
| Rainy Pond | rain and ripples | rain hats |
| Sunny Beach | sparkles on the water | snorkels |
| Under the Sea | rising bubbles | diving bubbles |
| Crystal Caverns | glowing motes | crystals |
| Lantern Mines | dust in the lamplight | hard hats with lamps |
| Snowy Peaks | snow | beanies |
| Cloud Islands | drifting clouds, a rainbow | propeller hats |
| The Nursery | twinkles | bonnets and dummies |
| Firefly Twilight | fireflies | nightcaps |

Classic is a journey: it starts in the meadow and wanders somewhere new every 2,500 points. Adventure worlds each have their own place, and the Daily Board picks one a day. You can also pin a place in Settings. Big clears blow the weather about, and line clears burst into the place's own things (petals, bubbles, snowflakes) mixed in with the stars. Creatures pop up thought bubbles: hearts, bolts, notes, stars, sweat, Zzz, "!" and "?". The scenery is purely visual (`src/engine/scenes.ts`, `src/lib/scenery.ts`).

The 📸 Polaroid on the end-of-game card shows the finished board set into the place it was played in. It carries sticker badges, a title and a date stamp. A game that ends on a new best ends in a party, not tears.

In the Cozy look every round ends on one star card, in one of two kinds, and it's the only end-of-round screen (the old results card is gone):
- **Success** (1–3 stars, or a crown for a new best): the celebration below, then "Tap to continue" on the card. A tap anywhere goes to the next level, or a fresh game after a new best.
- **Fail** (0 stars): the stars stay empty and a red **FAIL** stamp slams down. Below it: "😢 Out of room! Wipe their tears? Clear a few blocks and keep going." with **🎬 Short break** (the game's one revive) and **💔 Start Over**, or just Start Over once the revive is used.

Home is in the pause menu. The round share button in the card's corner shares the round's Polaroid (on a fail, that's "clip this fail"). An Adventure win pays 🪙 50 per star, plus 50 for each world past the first (`levelPayout`). The Classic look keeps its own results screen and revive prompt.

Winning a round (an Adventure level, or a new best) plays a celebration in the style of the big puzzle games' reward screens, drawn in the Cozy look:
1. "Block Burst" bounces in letter by letter (the "o" has googly eyes).
2. A banner pops up: "Well done!", "Perfect!" for three stars, or "New best!".
3. A card rises with a ribbon naming the level.
4. The stars land one by one on a plump cushion. A new best gets a crown instead.
5. A treasure chest with googly eyes drops in and waits to be tapped. It rattles, pops its lid in a flash of light and bursts into coins.
6. The coins burst out and fall, weighed down. Before any of them can touch the floor, their polarity flips: each one swoops round in a U-turn without ever stopping, then is pulled up into a coin counter in the corner that ticks up "+N". The coins fall into step as one stream as they go. As the chest fades, a glowing "+N coins" pops up in its place, letter by letter, with one wave rolling through it, while the "Block Burst" name above keeps waving until Continue.
7. "Tap to continue" shows along the bottom of the card, and a tap anywhere goes on: to the next level after an Adventure win, otherwise to the results card.

A won round pays out in whole chests: its coins round up to the next 50, and never less than 50 (`winPayout` in `src/lib/progression.ts`). The total fills the space where the chest was.

Every beat has a synthesised sound. With reduced motion the finished card shows straight away (`src/engine/celebration.ts`, `src/engine/coinShower.ts`). The same bouncing logo opens the app once per visit, and a tap skips it (`src/components/meta/LogoSplash.tsx`).

### Music, cheers and progress

- **Music:** a soft lo-fi music box, synthesised live like every other sound (`src/engine/music.ts`). Each place has its own tune (key, tempo, chords, instrument), with melodies made up on the fly. It picks up with a gentle shaker as the board gets crowded, and ducks under the results and the pause menu. Settings: 🎵 Music on/off and volume.
- **Cheers:** big clears and combos get a praise word ("Sweet!", "Lovely!", "Dreamy!", "Magical!", "Legendary!", or "All Clear!" for an empty board) over golden rays, with confetti in the scene's particles, a flash on the biggest, a rainbow sweep for an All Clear, and a rising sting (`src/engine/praise.ts`).
- **Progress:** toasts at 25%, 50% and 75% of the way to an Adventure goal ("🎯 Halfway there!") or to your best in Classic and the Daily Board ("👑 75% of your best!"), then "👑 New best territory!".
- **Difficulty, honestly:** as an Adventure level starts, a toast says how forgiving it is, measured rather than invented: a slightly sloppy Burst Bot plays it 24 times, and its clear rate is shown ("🌶️ Tricky level · Burst Bot clears it 38% of the time"). Results are cached per level (`src/lib/difficulty.ts`). Real player clear rates could replace this once the optional cloud sync is collecting them.

### Sanctuary

Every cell you clear is a rescued blob of its species, and it goes to live in the Sanctuary (open from level 1). The blobs wander a little garden and drip droplets into a rain tank over real time: 4 an hour, plus 1 for each species you've met and 3 for each Sunflowers level. A full tank spills into puddles on the path. That's a cue to drop by, never a penalty: nothing is lost, the tank just stops filling. Droplets build Moss Huts (more blobs out playing), a Rain Barrel (a bigger tank) and Sunflowers (a faster drip). They can't be bought and buy nothing else, so the loop sits outside the shop entirely. The Species Log counts each of the seven species, with a one-time coin thank-you at 1, 25, 100, 500 and 2,000 rescued. Logic lives in `src/lib/sanctuary.ts`.

## Humane playbook (enforced in `tests/playbook.test.ts`)

* The results and pause screens sell nothing and show no ads. "Play again" is free and immediate. The one exception: when a game is lost, the board's creatures cry and one "wipe their tears" revive is offered before the results, for a short rewarded break or 50 coins (never real money). "No thanks" is always there, it is offered at most once per game, and a revived game counts as assisted (not for ranks).
* Sponsor breaks have exactly one call site, between games. Rewarded breaks live in the shop only.
* The rules, generator, bot and levels never import stores or `src/lib`.
* Bot pace, practice crews, the crate and the shop never read the player.
* Every screen that lists bots labels them `[BOT]`.
* Coins are never sold. The Gold track holds cosmetics only.
* There are no countdown, "last chance" or expiry messages anywhere in the UI.
* Badges only mark things that are really waiting, never the shop or store.
* Every sound is synthesised, and there are no audio files.
* Hint-assisted games are labelled and kept out of ranks.
* **Animation and design rules:**
  * CSS keyframes animate only `transform` and `opacity`, and there's no `transition-all`.
  * UI durations are 150–300 ms.
  * Reduced motion is honoured, in CSS and on the canvas.
  * Buttons are at least 48 px.
  * The tab bar respects the safe area.
  * System fonts only.
  * Skeletons, never spinners.
  * Screens are code-split.
  * Opt-ins start off.

## Architecture

| Area | Where |
| --- | --- |
| Shared types | `src/types/game.ts` |
| Seeded RNG (MurmurHash3 + Mulberry32) | `src/engine/rng.ts` |
| Piece catalogue | `src/engine/pieces.ts` |
| Bitmask board, fit and clear checks, the full-tray search | `src/engine/board.ts` |
| Tray generator | `src/engine/generator.ts` |
| Rules, scoring, Daily layout | `src/engine/rules.ts` |
| Burst Bot | `src/engine/bot.ts` |
| Adventure levels and their proofs | `src/engine/levels.ts` |
| Hash-chained move log, replay, verifier | `src/engine/RunLog.ts` |
| Canvas renderer: sprite cache, skins, particles | `src/engine/renderer.ts` |
| Game loop, drag, keyboard, animations | `src/engine/GameController.ts` |
| Procedural audio | `src/engine/WebAudioSynthesizer.ts` |
| Cosmetics, crate, shop, ranks, leagues, pass, crews, challenges, gifts, events, trophies, notifications, ads, live config, share | `src/lib/` |
| Stores (Zustand + IndexedDB persistence) | `src/stores/` |
| Screens (lazy-loaded) | `src/app/` |
| Tab bar, HUDs, modals, badges, sponsor break | `src/components/` |
| Optional Supabase sync (REST) and schema | `src/lib/cloud.ts`, `supabase/schema.sql` |

The stack is Vite + React 19 + TypeScript (strict) + Zustand + Tailwind + Vitest, the same as the sibling games.

## Not built yet

* **Real multiplayer** for leagues, crews and the world Daily board. The schema, RLS policies and client calls are in place, but no server-side replay verifier is deployed.
* **Closed-app push.** Reminders fire while the tab is open in the background.
* **Real payments and a real ad network.** The store and sponsor breaks are demos. The Poki and CrazyGames adapters are only active when their SDK is on the page.
* **Crash reporting and analytics.** The error boundary is the hook point. No SDK is bundled, and nothing is collected.
