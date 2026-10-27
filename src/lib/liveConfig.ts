/**
 * Remote config with guard rails (Bark Battle's live-ops governance). A remote source (Firebase Remote Config,
 * Statsig, or any JSON at VITE_REMOTE_CONFIG_URL) can tune the low-risk knobs below within fixed bounds, without
 * shipping an update. Anything that could tilt fairness is locked in the client and can't be tuned remotely:
 * crate odds and pity, prices, the tray generator, scoring, rank par and the spend caps. Prices and odds are never
 * A/B tested.
 */
export interface LiveConfig {
  /** Sponsor breaks: at most one every N games... */
  interstitialEveryGames: number;
  /** ...and never sooner than this many seconds after the last. */
  interstitialMinGapSec: number;
  /** New players see no sponsor breaks for their first N games. */
  newPlayerGraceGames: number;
  rewardedDailyCap: number;
  rewardedCoins: number;
}

export const LIVE_DEFAULTS: LiveConfig = { interstitialEveryGames: 3, interstitialMinGapSec: 120, newPlayerGraceGames: 8, rewardedDailyCap: 3, rewardedCoins: 20 };

export const LIVE_BOUNDS: Record<keyof LiveConfig, [number, number]> = {
  interstitialEveryGames: [2, 6],
  interstitialMinGapSec: [60, 300],
  newPlayerGraceGames: [5, 20],
  rewardedDailyCap: [0, 5],
  rewardedCoins: [10, 30],
};

export const LOCKED_KEYS = ['crateOdds', 'pity', 'prices', 'generator', 'scoring', 'rankPar', 'spendCap'] as const;

/** Merge a remote patch: unknown and locked keys are dropped, numbers are clamped into their bounds. */
export function applyRemote(base: LiveConfig, patch: Record<string, unknown>): LiveConfig {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in LIVE_BOUNDS) || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const [lo, hi] = LIVE_BOUNDS[k as keyof LiveConfig];
    out[k as keyof LiveConfig] = Math.round(Math.min(hi, Math.max(lo, v)));
  }
  return out;
}

let current = LIVE_DEFAULTS;
export const liveConfig = () => current;

/** Fetch remote values once at start-up, if a URL is configured. The game never waits on this. */
export async function loadRemoteConfig(): Promise<void> {
  const url = import.meta.env.VITE_REMOTE_CONFIG_URL as string | undefined;
  if (!url) return;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) current = applyRemote(LIVE_DEFAULTS, (await res.json()) as Record<string, unknown>);
  } catch {
    // Offline or blocked: the defaults stand.
  }
}
