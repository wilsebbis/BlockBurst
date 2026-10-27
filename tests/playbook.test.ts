/**
 * Playbook checks on the source itself (the same idea as the sibling games' playbook tests), extended with the
 * rules from the animation, monetization and design reference this game was built against.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const srcFiles = (readdirSync(new URL('../src', import.meta.url), { recursive: true }) as string[]).filter((f) => /\.(ts|tsx)$/.test(f));
const uiFiles = srcFiles.filter((f) => f.startsWith('app') || f.startsWith('components'));

describe('humane playbook', () => {
  it('the results and pause screens sell nothing, show no ads, and offer a free retry', () => {
    const banned = ['purchase(', 'priceCents', 'formatCents', "go('store')", "go('shop')", 'useEconomyStore', 'watchRewarded', 'continue for', 'Revive', 'watch an ad', 'extra life'];
    for (const f of ['src/components/game/GameOverModal.tsx', 'src/components/game/PauseModal.tsx']) {
      const src = read(f);
      for (const word of banned) expect(src.includes(word), `${f}: ${word}`).toBe(false);
    }
    // The play screen itself may only reach the one revive offer (below), never the shop or a purchase.
    const play = read('src/app/PlayScreen.tsx');
    for (const word of banned.filter((word) => word !== 'Revive')) expect(play.includes(word), `PlayScreen: ${word}`).toBe(false);
    expect(read('src/components/game/GameOverModal.tsx')).toContain('Play again');
  });

  it('a lost game offers at most one revive, for a break or coins, and declining it is free', () => {
    const prompt = read('src/components/game/RevivePrompt.tsx');
    expect(prompt).toContain('No thanks');
    // Coins or a rewarded break only: never real money.
    for (const word of ['purchase(', 'priceCents', 'formatCents']) expect(prompt.includes(word), word).toBe(false);
    // Once per game: the offer is guarded by the revived flag, which resets only for a new game.
    const play = read('src/app/PlayScreen.tsx');
    expect(play).toContain('!won && !revived.current');
    expect(play).toContain('revived.current = false;');
  });

  it('the Cozy fail card offers the same one revive, and starting over is always free', () => {
    const play = read('src/app/PlayScreen.tsx');
    const card = read('src/components/game/ResultCard.tsx');
    for (const word of ['purchase(', 'priceCents', 'formatCents', 'useEconomyStore']) expect(card.includes(word), word).toBe(false);
    // The ad is only behind the one revive, guarded like the prompt's; Start Over is always there and free.
    expect(play).toContain("...(offer ? [{ label: '🎬 Short break'");
    expect(play).toContain("{ label: '💔 Start Over'");
  });

  it('sponsor breaks run only between games, from one call site, after the results are closed', () => {
    const calls = srcFiles.filter((f) => !f.endsWith('adService.ts') && read(`src/${f}`).includes('maybeInterstitial('));
    expect(calls).toEqual(['app/PlayScreen.tsx']);
    const play = read('src/app/PlayScreen.tsx');
    expect(play).toMatch(/onAgain=\{\(\) => void leave\(/);
    // Rewarded breaks are opt-in and live in the Item Shop only.
    expect(srcFiles.filter((f) => !f.endsWith('adService.ts') && read(`src/${f}`).includes('watchRewarded('))).toEqual(['app/ShopScreen.tsx']);
    // No banner placements exist.
    expect(/banner\s*\(|showBanner|BannerAd/.test(read('src/lib/ads.ts') + read('src/lib/adService.ts'))).toBe(false);
  });

  it('every sound is synthesised: no audio files anywhere', () => {
    const pub = readdirSync(new URL('../public', import.meta.url), { recursive: true }) as string[];
    for (const f of [...srcFiles, ...pub]) expect(/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(f), f).toBe(false);
    for (const f of srcFiles) expect(read(`src/${f}`).includes('new Audio('), f).toBe(false);
    const synth = read('src/engine/WebAudioSynthesizer.ts');
    for (const m of ['playPick', 'playPlace', 'playReturn', 'playClear', 'playCombo', 'playGem', 'playPerfect', 'playNewBest', 'playCalmEnd']) expect(synth).toContain(`${m}(`);
  });

  it('the rules, generator, bot and levels never read stores, the player or spending', () => {
    for (const f of ['board.ts', 'generator.ts', 'rules.ts', 'bot.ts', 'levels.ts', 'pieces.ts', 'rng.ts', 'RunLog.ts']) {
      const src = read(`src/engine/${f}`);
      for (const banned of ['stores/', '../lib/', 'useEconomyStore', 'useMetaStore', 'purchases', 'localStorage']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
    for (const f of srcFiles.filter((f) => f.startsWith('engine'))) expect(read(`src/${f}`).includes('stores/'), f).toBe(false);
  });

  it('bot pace, practice crews and the crate never read the player or their spending', () => {
    for (const f of ['src/lib/leagues.ts', 'src/lib/crews.ts', 'src/lib/bots.ts', 'src/lib/crates.ts', 'src/lib/shop.ts']) {
      const src = read(f);
      for (const banned of ['useEconomyStore', 'purchases', 'stores/']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
  });

  it('every screen that lists bots labels them', () => {
    for (const f of ['src/app/LeaguesScreen.tsx', 'src/app/DailyScreen.tsx', 'src/app/CrewScreen.tsx']) expect(read(f), f).toContain('<NonHumanBadge');
  });

  it('coins are never sold, so money never reaches the Mystery Crate', () => {
    const store = read('src/app/StoreScreen.tsx');
    expect(store.includes('addCoins')).toBe(false);
    expect(/coin\s*(pack|bag|bundle)/i.test(store + read('src/lib/economy.ts'))).toBe(false);
    expect(read('src/lib/crates.ts').includes('purchase')).toBe(false);
    expect(read('src/lib/pass.ts')).toMatch(/gold: GOLD_SPECIAL\[tier\] \?\? null/);
  });

  it('there are no countdown or expiry timers in the UI', () => {
    for (const f of uiFiles) {
      const src = read(`src/${f}`).toLowerCase();
      for (const banned of ['expires in', 'ends in', 'last chance', 'hurry', 'only today', 'ready in', 'time left']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
  });

  it('crews have no kicking, no minimums and no member rankings', () => {
    const src = read('src/lib/crews.ts') + read('src/app/CrewScreen.tsx');
    expect(/\bkickMember|removeMember|minimumContribution/.test(src)).toBe(false);
    expect(read('src/app/CrewScreen.tsx').includes('botContributions')).toBe(false);
  });

  it('badges only point at things that are really waiting, never the shop or store', () => {
    const iface = read('src/lib/claimables.ts').split('export interface Claimables {')[1].split('}')[0];
    const keys = [...iface.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(3);
    for (const k of keys) expect(/shop|offer|store|sale/i.test(k), k).toBe(false);
  });

  it('hint-assisted games are labelled and kept out of ranks', () => {
    expect(read('src/stores/useMetaStore.ts')).toMatch(/if \(hinted\) rank = \{[^}]*counted: false/);
    expect(read('src/app/PlayScreen.tsx')).toContain("won't count for ranks");
  });
});

describe('animation and design rules', () => {
  it('CSS keyframes animate transform and opacity only, and honour reduced motion', () => {
    const css = read('src/index.css');
    for (const block of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      const props = [...block[1].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['transform', 'opacity'], `${p} in keyframes`).toContain(p);
    }
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@supports (animation-timeline: view())');
  });

  it('nothing animates layout properties (no transition-all, no width transitions)', () => {
    for (const f of uiFiles) {
      const src = read(`src/${f}`);
      expect(src.includes('transition-all'), f).toBe(false);
      expect(/transition-\[(width|height|top|left|margin)/.test(src), f).toBe(false);
    }
  });

  it('UI transitions stay within 150–300 ms', () => {
    for (const f of [...uiFiles.map((f) => `src/${f}`), 'src/index.css']) {
      for (const m of read(f).matchAll(/duration-(\d+)/g)) expect(Number(m[1]) >= 150 && Number(m[1]) <= 300, `${f}: duration-${m[1]}`).toBe(true);
    }
  });

  it('the game honours reduced motion: no shake, no particles', () => {
    const gc = read('src/engine/GameController.ts');
    expect(gc).toMatch(/if \(!this\.look\.reducedMotion\) \{\s*const per/);
    expect(read('src/app/PlayScreen.tsx')).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });

  it('buttons are at least 48 px tall, and the tab bar sits in the thumb zone above the safe area', () => {
    expect(read('tailwind.config.js')).toContain("tap: '48px'");
    expect(read('src/components/shared/ui.tsx')).toContain('min-h-tap');
    const tab = read('src/components/meta/TabBar.tsx');
    expect(tab).toContain('fixed inset-x-0 bottom-0');
    expect(tab).toContain('env(safe-area-inset-bottom)');
  });

  it('uses system fonts only (nothing to download) and a skeleton instead of a spinner', () => {
    expect(read('index.html').includes('fonts.googleapis')).toBe(false);
    expect(read('index.html')).toContain('Skeleton');
    expect(read('src/App.tsx')).toContain('ScreenSkeleton');
    for (const f of uiFiles) expect(/spinner|animate-spin/i.test(read(`src/${f}`)), f).toBe(false);
  });

  it('screens other than Home are code-split', () => {
    const app = read('src/App.tsx');
    for (const s of ['PlayScreen', 'DailyScreen', 'ShopScreen', 'StoreScreen', 'SettingsScreen']) expect(app).toContain(`import('./app/${s}')`);
  });

  it('opt-ins start off: haptics, hints, reminders and the app badge', () => {
    const store = read('src/stores/useMetaStore.ts');
    expect(store).toMatch(/haptics: false, hints: false/);
    expect(store).toMatch(/appBadge: false/);
  });
});
