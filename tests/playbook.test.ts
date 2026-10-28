/**
 * Playbook checks on the source itself (the same idea as the sibling games' playbook tests): what Block Burst
 * deliberately leaves out, and the animation and design rules it keeps.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const srcFiles = (readdirSync(new URL('../src', import.meta.url), { recursive: true }) as string[]).filter((f) => /\.(ts|tsx)$/.test(f));
const uiFiles = srcFiles.filter((f) => f.startsWith('app') || f.startsWith('components'));

describe('humane playbook', () => {
  it('nothing is for sale and there are no ads: no store, shop, crate, pass or sponsor breaks', () => {
    const banned = ['purchase(', 'priceCents', 'formatCents', 'useEconomyStore', 'maybeInterstitial', 'watchReviveAd', 'watchRewarded', 'Mystery Crate', 'Blast Pass'];
    // The engine's sound bank still has a few unused sounds (a crate's clicks); what matters is that nothing offers them.
    for (const f of srcFiles.filter((f) => !f.startsWith('engine'))) {
      const src = read(`src/${f}`);
      for (const word of banned) expect(src.includes(word), `${f}: ${word}`).toBe(false);
    }
  });

  it('only Adventure levels, the Sanctuary, the Penguin Exhibit and Settings are reachable', () => {
    const nav = read('src/stores/useNav.ts');
    expect(nav).toContain("export type Screen = 'home' | 'play' | 'settings' | 'sanctuary' | 'exhibit';");
    const home = read('src/app/HomeScreen.tsx');
    expect(home).toContain('Play Level {nextLevel}');
    expect(home).toContain('start(adventureRequest(nextLevel))');
  });

  it('a lost level offers one free revive on a countdown, then a tap starts over', () => {
    const play = read('src/app/PlayScreen.tsx');
    // Once per game: the offer is guarded by the revived flag, which resets only for a new game.
    expect(play).toContain('!st.won && !revived.current');
    expect(play).toContain('revived.current = false;');
    expect(play).toContain('{offer && <ReviveOverlay');
    expect(read('src/components/game/ReviveOverlay.tsx')).toContain('export const REVIVE_SECONDS = 5;');
    expect(play).toContain('leave(result.fail ? restart : nextLevel)');
  });

  it('the results and pause screens sell nothing', () => {
    for (const f of ['src/components/game/ResultCard.tsx', 'src/components/game/PauseModal.tsx']) {
      const src = read(f);
      for (const word of ["go('store')", "go('shop')", 'watch an ad', 'extra life', 'continue for']) expect(src.includes(word), `${f}: ${word}`).toBe(false);
    }
  });

  it('every sound is synthesised: no audio files anywhere, and the exhibit clips are silent videos', () => {
    const pub = readdirSync(new URL('../public', import.meta.url), { recursive: true }) as string[];
    for (const f of [...srcFiles, ...pub]) expect(/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(f), f).toBe(false);
    for (const f of srcFiles) expect(read(`src/${f}`).includes('new Audio('), f).toBe(false);
    expect(read('src/exhibit/penguinSprite.ts')).toContain('muted');
    const synth = read('src/engine/WebAudioSynthesizer.ts');
    for (const m of ['playPick', 'playPlace', 'playReturn', 'playClear', 'playCombo', 'playGem', 'playPerfect', 'playNewBest', 'playCalmEnd']) expect(synth).toContain(`${m}(`);
  });

  it('the rules, generator, bot and levels never read stores, the player or spending', () => {
    for (const f of ['board.ts', 'generator.ts', 'rules.ts', 'bot.ts', 'levels.ts', 'pieces.ts', 'rng.ts', 'RunLog.ts']) {
      const src = read(`src/engine/${f}`);
      for (const banned of ['stores/', '../lib/', 'useMetaStore', 'purchases', 'localStorage']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
    for (const f of srcFiles.filter((f) => f.startsWith('engine'))) expect(read(`src/${f}`).includes('stores/'), f).toBe(false);
  });

  it('the penguin pond simulation is pure: no stores, no DOM, no system clock, no Math.random', () => {
    for (const f of ['pond.ts', 'tricks.ts', 'tuning.ts']) {
      const src = read(`src/exhibit/${f}`);
      for (const banned of ['stores/', 'document.', 'window.', 'Date.now(', 'performance.now(', 'Math.random(']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
  });

  it('there are no countdown or expiry timers in the UI', () => {
    for (const f of uiFiles) {
      const src = read(`src/${f}`).toLowerCase();
      for (const banned of ['expires in', 'ends in', 'last chance', 'hurry', 'only today', 'ready in', 'time left']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false);
    }
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

  it('buttons are at least 48 px tall', () => {
    expect(read('tailwind.config.js')).toContain("tap: '48px'");
    expect(read('src/components/shared/ui.tsx')).toContain('min-h-tap');
  });

  it('uses system fonts only (nothing to download) and a skeleton instead of a spinner', () => {
    expect(read('index.html').includes('fonts.googleapis')).toBe(false);
    expect(read('index.html')).toContain('Skeleton');
    expect(read('src/App.tsx')).toContain('ScreenSkeleton');
    for (const f of uiFiles) expect(/spinner|animate-spin/i.test(read(`src/${f}`)), f).toBe(false);
  });

  it('screens other than Home are code-split', () => {
    const app = read('src/App.tsx');
    for (const s of ['PlayScreen', 'SettingsScreen', 'SanctuaryScreen', 'ExhibitScreen']) expect(app).toContain(`import('./app/${s}')`);
  });

  it('opt-ins start off: haptics and hints', () => {
    expect(read('src/stores/useMetaStore.ts')).toMatch(/haptics: false, hints: false/);
  });

  it('is always the Cozy look: no Classic look setting', () => {
    expect(read('src/App.tsx')).toContain('app-bg cozy');
    expect(read('index.html')).toContain('class="cozy-root"');
    expect(read('src/stores/useMetaStore.ts').includes('look')).toBe(false);
    expect(read('src/app/PlayScreen.tsx')).toContain('cozy: true');
  });
});
