/** Adventure progress, coins, the Sanctuary and settings: everything Block Burst remembers between visits. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { levelFor, starsFor } from '../engine/levels';
import { coinsForRun, levelPayout, STAR_COINS, winPayout } from '../lib/progression';
import { build, collect, emptySanctuary, LOG_STEPS, logReady, rescue, type BuildingId, type SanctuaryState } from '../lib/sanctuary';
import type { ScenePick } from '../lib/scenery';
import { persistStorage } from '../lib/storage';
import type { GameState, RunConfig } from '../types/game';

export interface Settings {
  muted: boolean;
  masterVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  /** Opt-in: starts off. */
  haptics: boolean;
  /** Labelled assist: a 💡 button that shows Burst Bot's move. */
  hints: boolean;
  /** Show which lines a piece would clear while you drag it. */
  clearPreview: boolean;
  /** 'journey' (each world has its own place) or one scene for every level. */
  scenery: ScenePick;
  /** Background music (synthesised, like every sound); on unless switched off. */
  music: boolean;
  musicVolume: number;
}

/** What the game hands the store when a level ends. */
export interface RunSummary {
  cfg: RunConfig;
  state: GameState;
  /** Blobs rescued (cells cleared) per species this game. */
  rescued: number[];
}

export interface RunOutcome {
  coinsEarned: number;
  adventure: { level: number; won: boolean; stars: number; newStars: number; coins: number };
  /** Blobs sent to the Sanctuary this game. */
  rescued: number;
}

export interface AdventureProgress {
  /** The next level to play: one past the highest level cleared. */
  unlocked: number;
  stars: Record<number, number>;
}

interface MetaState {
  coins: number;
  adventure: AdventureProgress;
  /** Levels finished, won or lost: numbers the Polaroid. */
  gamesPlayed: number;
  settings: Settings;
  sanctuary: SanctuaryState;

  recordRun(run: RunSummary): RunOutcome;
  /** Sanctuary: empty the rain tank into the droplet bank. */
  collectDroplets(): number;
  buildSanctuary(id: BuildingId): boolean;
  /** Pays every Species Log step reached; returns the coins paid. */
  claimSpeciesLog(): number;
  updateSettings(patch: Partial<Settings>): void;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, masterVolume: 0.8, sfxVolume: 0.9, reducedMotion: false, haptics: false, hints: false, clearPreview: true, scenery: 'journey', music: true, musicVolume: 0.5 };

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      coins: 0,
      adventure: { unlocked: 1, stars: {} },
      gamesPlayed: 0,
      settings: { ...DEFAULT_SETTINGS },
      sanctuary: emptySanctuary(),

      recordRun: ({ cfg, state, rescued }) => {
        const before = get();
        const level = cfg.level ?? before.adventure.unlocked;
        const starsBefore = before.adventure.stars[level] ?? 0;
        const stars = state.won ? starsFor(levelFor(level), state.placed) : 0;
        const newStars = Math.max(0, stars - starsBefore);
        const starCoins = newStars * STAR_COINS;
        const gameCoins = coinsForRun(state.lines, state.perfects);
        // A won level pays out in whole chests, by its stars and how far into the worlds it is (levelPayout).
        const total = gameCoins + starCoins;
        const winBonus = state.won ? winPayout(Math.max(levelPayout(level, stars), total)) - total : 0;
        const unlocked = state.won ? Math.max(before.adventure.unlocked, level + 1) : before.adventure.unlocked;
        set({
          coins: before.coins + total + winBonus,
          gamesPlayed: before.gamesPlayed + 1,
          adventure: { unlocked, stars: { ...before.adventure.stars, [level]: Math.max(starsBefore, stars) } },
          sanctuary: rescue(before.sanctuary, rescued),
        });
        return {
          coinsEarned: gameCoins + winBonus,
          adventure: { level, won: state.won, stars, newStars, coins: starCoins },
          rescued: rescued.reduce((sum, count) => sum + count, 0),
        };
      },

      collectDroplets: () => {
        const result = collect(get().sanctuary);
        set({ sanctuary: result.state });
        return result.gained;
      },

      buildSanctuary: (id) => {
        const next = build(get().sanctuary, id);
        if (next !== null) set({ sanctuary: next });
        return next !== null;
      },

      claimSpeciesLog: () => {
        const sanctuary = get().sanctuary;
        const ready = logReady(sanctuary);
        if (ready.length === 0) return 0;
        const coins = ready.reduce((sum, entry) => sum + LOG_STEPS[entry.step].coins, 0);
        set({ sanctuary: { ...sanctuary, logClaimed: [...sanctuary.logClaimed, ...ready.map((entry) => `${entry.species}:${entry.step}`)] }, coins: get().coins + coins });
        return coins;
      },

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    }),
    {
      name: 'blockburst-meta',
      storage: persistStorage,
      version: 1,
      // Settings added in later versions get their defaults instead of being missing.
      merge: (persisted, current) => {
        const saved = persisted as Partial<MetaState> | undefined;
        return { ...current, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved?.settings } };
      },
    },
  ),
);
