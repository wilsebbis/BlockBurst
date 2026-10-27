# Design notes

Block Burst is built two ways at once:

* on the same foundations as the other three games in this account (Bark Battle, Project AntLink and Cluck Crossing);
* against the animation, games, monetization, design and tooling reference it was briefed with.

This file maps both to the code, and says plainly what was declined and why.

## What came from the sibling games

| Technique | From | Here |
| --- | --- | --- |
| Deterministic engine: pure rules, a separate visual layer | AntLink, Cluck Crossing | `src/engine/rules.ts`, `src/engine/GameController.ts` |
| Seeded RNG (MurmurHash3 + Mulberry32), one stream per decision | all three | `src/engine/rng.ts`, `burst/deal/v1/<seed>/<tray>/<k>` |
| Hash-chained move log, replay verifier | Bark Battle's movelog, AntLink's MoveLogVerifier, Cluck's RunLog | `src/engine/RunLog.ts` |
| A verifier that proves content before it ships | AntLink's PuzzleVerifier, Cluck's solver | `src/engine/levels.ts` (Burst Bot beats every Adventure level) |
| UTC daily seed, spoiler-free share text, 1080×1920 brag card | all three | `src/lib/bots.ts` (`dailySeed`), `src/lib/share.ts` |
| Total-days streak with free rest days and vacation mode | AntLink, Cluck | `src/lib/streak.ts` (copied) |
| Weekly leagues of 30, top 7 promote, no relegation, labelled bots | Bark Battle, Cluck | `src/lib/leagues.ts` |
| Arena ladder with floors and soft-reset seasons | Bark Battle's Arena Ladder | `src/lib/ranks.ts` (grown into tiers and divisions) |
| Season pass: every reward visible, cosmetic paid track, nothing expires | Bark Battle's Park Pass, Cluck's Road Pass | `src/lib/pass.ts` |
| Rotating daily shop on a fixed public cycle | Bark Battle's Kennel Shop | `src/lib/shop.ts` (with weekly featured slots) |
| Gacha with published odds, no duplicates, pity and a fixed-price route | Bark Battle's Pup Crates, Cluck's Prize Machine | `src/lib/crates.ts` |
| Clans: mirrored XP, no kicking, quick chat only | Bark Battle's Dog Pack, Cluck's Coops | `src/lib/crews.ts` |
| Unlock ladder with visible locks and a one-pop-up-per-visit celebration | Cluck | `src/lib/progression.ts`, `src/components/meta/UnlockCelebration.tsx` |
| Notifications policy: opt-in, one a day, quiet hours, stops after 3 unopened | Cluck | `src/lib/notify.ts`, `src/lib/useNotifications.ts` |
| Live-ops governance: remote config with bounds and locked keys | Bark Battle's liveConfig | `src/lib/liveConfig.ts` |
| $50 hard cap, own lower limit, under-16 block, demo store | all three | `src/lib/economy.ts`, `src/stores/useEconomyStore.ts` |
| Procedural Web Audio, no audio files | all three | `src/engine/WebAudioSynthesizer.ts` |
| Thumb-zone tab bar; badges only for real claimables | Bark Battle, Cluck | `src/components/meta/TabBar.tsx`, `src/lib/claimables.ts` |
| Playbook rules enforced as tests | all three | `tests/playbook.test.ts` |

## The reference, section by section

### 1. Animation formats

| Need | What the reference says | What Block Burst does |
| --- | --- | --- |
| Game rendering | Sprite sheets or texture atlases, not individual frames | Each block face is painted once per (skin, colour, size) into an offscreen canvas and blitted (`BlockSprites` in `renderer.ts`). |
| Simple UI transitions | Native/CSS transitions, not animation files | All UI motion is CSS (`pop-in`, `bob`, `transition-transform`). |
| Icons | SVG or icon fonts | An SVG favicon and app icon. In-UI icons are system emoji, which cost nothing to load. |
| Vector or interactive animation | Lottie (dotLottie) or Rive | **Not used.** Nothing in the game needs a timeline or state-machine animation that the canvas and CSS can't already do, so adding a runtime (Rive ≈ 150 KB, lottie-web ≈ 250 KB) would only cost load time. If a mascot or onboarding animation is added later, it should be a Rive file driven by a state-machine input. |
| Video | H.264/AV1, muted, `playsinline` | No video anywhere. |

**Rules of thumb**

* **Transform and opacity only.**
  * CSS keyframes animate `transform` and `opacity` and nothing else. A test parses `index.css` to check.
  * Progress bars scale with `scaleX` rather than changing `width`.
  * No `transition-all` anywhere (tested).
  * On the canvas, blocks animate by position, scale and alpha only.
* **Reduced motion.**
  * Honoured from `prefers-reduced-motion` and from an in-game setting.
  * With it on, there is no screen shake, no particles, no rising score text and no bouncing menus.
  * Clear animations shorten to 180 ms.
* **Durations.**
  * UI transitions use 150–300 ms (tested), easing out on entry.
  * The drag follows the pointer 1:1 with no lag.
  * A piece that doesn't fit eases back to the tray in 180 ms.

### 2. Scroll-driven animation

* The long lists use native CSS scroll-driven animation (`.reveal` in `index.css`): pass tiers, shop and collection cards, and Adventure worlds.
* It sits behind `@supports (animation-timeline: view())`, so Firefox simply shows the cards with no animation.
* GSAP, Lenis, image sequences and Three.js aren't needed: there is no marketing page.

### 3. Mobile app animation

* The game is a web app (installable PWA), so SwiftUI, Compose, Reanimated and Flutter don't apply.
* **Frame budget.**
  * The render loop runs only while something moves: a drag, an animation, particles or shake. An idle board costs zero frames.
  * Particle count is capped by a fixed pool of 360.
  * Device pixel ratio is capped at 3.
* **Haptics.** Opt-in short buzzes when you pick up a piece and when lines clear (`navigator.vibrate`).

### 4. Games

* **Engine.** Plain Canvas 2D with no library.
  * The board is 64 cells, drawn from cached sprites.
  * Phaser or PixiJS would add 300–1000 KB for nothing this game needs.
* **Pooling.** Particles come from a pre-allocated pool, and nothing is allocated per frame in the hot path.
* **Juice.**
  * Pieces pop when placed.
  * Clears flash and shrink in a ripple out from the piece you placed.
  * Particles burst in your chosen style.
  * Screen shake on 3+ lines and Perfect Clears.
  * Combo and score text.
  * Haptics.
  * A synthesised sound on every input: pick-up, place (pitched by piece size), return, clears that climb the pentatonic scale with the combo, combo call-outs, gems, Perfect Clear and fanfares.

### 5. Ads and monetization

* **Rewarded video first.** An opt-in "sponsor break" pays 🪙 20, up to 3 a day.
  * It is offered in the Item Shop only.
  * It is never at the moment of loss: the reference suggests continues, but the sibling games' playbook forbids selling at a loss, and that rule wins here.
* **Interstitials only at natural breaks.**
  * They come only after you close the results of a finished game.
  * Frequency-capped: at most one every 3 games and 2 minutes.
  * Never in a new player's first 8 games.
  * All three numbers are remote-tunable within bounds.
* **No banners**, anywhere.
* **Hybrid monetization.** The demo store has the cosmetic Gold Pass, cosmetics you pick yourself, a paid "No sponsor breaks" switch, a one-time starter pack and a tip.
  * Coins are never sold, so money can't reach the Mystery Crate.
  * RevenueCat or a web checkout would plug in at `useEconomyStore.purchase`.
* **Consent.**
  * A consent card asks for personalised or contextual ads before the first ad. An IAB TCF CMP such as Google UMP would replace it.
  * Players under 16, or who haven't told us their age, get contextual ads only.
* **Web distribution.** `src/lib/ads.ts` uses the Poki SDK (`commercialBreak` / `rewardedBreak`) or the CrazyGames SDK (`requestAd`) when the page is hosted there. Otherwise a demo placeholder says that no ad network is connected.
* **Not applicable:** AppLovin MAX, AdMob, LevelPlay, ATT/SKAdNetwork, App Store labels and attribution SDKs are native-app concerns.

### 6. Design

* **Touch targets.**
  * Buttons are at least 48 px.
  * The tab bar and the tray sit in the thumb zone.
  * On touch, a dragged piece floats above your finger so you can see where it lands.
* **Safe areas.**
  * Headers, the tab bar and modals pad with `env(safe-area-inset-*)`.
  * The viewport uses `viewport-fit=cover`.
  * Modals are bottom sheets on phones.
* **Dark UI.** The whole UI is dark navy, with white text at 80–100% opacity on `#1b2350`, which keeps contrast above 4.5:1.
* **Loading.**
  * `index.html` ships a skeleton of the home screen, so there is no blank flash.
  * Lazy-loaded screens show skeletons, never spinners (tested).
  * Actions apply instantly; there are no network round-trips.
* **Onboarding.**
  * Value before signup: no account at all, and Classic is one tap away.
  * The unlock ladder introduces one system at a time.
  * Notifications are asked for in context (after 3 games), through our own card first.
* **Accessibility.**
  * The canvas has a full keyboard path: 1/2/3 to pick, arrows to move, Enter to place, Esc to pause.
  * An `aria-live` region announces clears and the score.
  * Progress bars have `role="progressbar"` and modals are labelled dialogs.
  * Colour never carries meaning:
    * block colours are cosmetic;
    * gems are drawn as a shape;
    * pieces that can't fit are greyed *and* faded;
    * rarities are written out.
* **Empty and error states.** Lists say "nothing yet". A designed error screen (`ErrorBoundary.tsx`) replaces a blank page, and says progress is safe.

### 7. Assets and performance

* **Images.** None. Everything is drawn: canvas blocks, CSS previews, emoji and one SVG.
* **Fonts.** System fonts only, so there is nothing to download and no font-swap layout shift. The sibling games used Google Fonts; this one doesn't.
* **Code splitting.**
  * Home ships in the first bundle; every other screen is `React.lazy`.
  * The game screen is a 29 KB chunk.
* **Main-thread work, measured instead of moved to a worker.**
  * Building and bot-verifying an Adventure level takes about 2 ms.
  * The generator's full-tray search uses 8-bit row masks and early exit, and stays under 1 ms on typical boards.
  * A Web Worker would cost more in messaging than it saves, so there isn't one.
* **CLS.** The canvas is sized from its container before the first paint, and the skeleton matches the layout.

### 8. Tooling

* **Backend:** optional Supabase over plain REST (`src/lib/cloud.ts`, `supabase/schema.sql`), as in the sibling games.
* **Remote config:** `src/lib/liveConfig.ts` reads any JSON at `VITE_REMOTE_CONFIG_URL`, such as a Firebase Remote Config or Statsig proxy.
  * Values are clamped to bounds.
  * Odds, prices, the generator, scoring, rank par and spend caps are locked and never A/B tested.
* **Crash reporting:** the `ErrorBoundary` is the hook point for Sentry or Crashlytics. No SDK is bundled.
* **Analytics:** none is collected. PostHog or Amplitude would need a consent step of their own first.

## Fairness decisions specific to a block puzzle

* **The generator looks at the board, openly.** Block Blast-style games feel fair because the generator avoids hopeless trays.
  * Block Burst's generator reads the seed, the tray number and the board, and nothing else. The playbook test checks the imports.
  * It deals the first candidate whose three pieces can all be placed.
  * How hard it looks, and how common big pieces are, depend only on the tray number, so long games end. A test plays Classic games to their end.
* **Ranks measure skill, leagues measure play.**
  * Ranks compare each Classic game with a par that rises every division.
  * Leagues race on weekly XP.
  * Games with 💡 hints are labelled and never move your rank.
* **Adventure par is the bot's move count.** Every level ships only after Burst Bot beats it, and 3 stars means matching or beating the bot.
