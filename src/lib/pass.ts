/**
 * The Blast Pass, a battle pass kept fair (the rules from Cluck Crossing's Road Pass and Bark Battle's Park Pass):
 *  - 28-day seasons of 30 tiers. Pass XP is just the XP you earn by playing.
 *  - Every reward on both tracks is visible from day 1. The free track has coins and cosmetics.
 *  - The Gold Pass is a flat $2.99 and cosmetic only (skins, themes, bursts, an avatar). It never grants coins, so
 *    money can never reach the Mystery Crate. There are no tier skips and no "premium-plus" tiers for sale.
 *  - Nothing expires: tiers you reached in any season stay claimable forever, and Gold rewards stay yours.
 *  - Tuned so a player who plays most days reaches tier 30 and a casual player gets a good way in (tested).
 */
export const PASS_DAYS = 28;
export const PASS_TIERS = 30;
export const XP_PER_TIER = 200;
export const GOLD_CENTS = 299;

/** Season 1 starts Monday 2026-10-05 UTC; seasons run back to back. */
const EPOCH = Date.UTC(2026, 9, 5);
const DAY = 86_400_000;
const NAMES = ['Candy Rush', 'Frost Bite', 'Bloom Burst', 'Sun Splash', 'Neon Nights', 'Star Fall'];

export interface PassSeason {
  index: number;
  id: string;
  name: string;
  start: number;
  end: number;
}

export function seasonOf(now = Date.now()): PassSeason {
  const index = Math.max(0, Math.floor((now - EPOCH) / (PASS_DAYS * DAY)));
  const start = EPOCH + index * PASS_DAYS * DAY;
  return { index, id: `s${index + 1}`, name: NAMES[index % NAMES.length], start, end: start + PASS_DAYS * DAY };
}

export type PassReward = { kind: 'coins'; amount: number } | { kind: 'cosmetic'; id: string };

export interface PassTier {
  tier: number;
  free: PassReward;
  /** Cosmetic only, so it's empty on most tiers: money must never turn into coins (and coins into crates). */
  gold: PassReward | null;
}

const FREE_SPECIAL: Record<number, PassReward> = {
  8: { kind: 'cosmetic', id: 'penguin' },
  16: { kind: 'cosmetic', id: 'dusk' },
  30: { kind: 'cosmetic', id: 'mint-skin' },
};

const GOLD_SPECIAL: Record<number, PassReward> = {
  1: { kind: 'cosmetic', id: 'ribbons' },
  10: { kind: 'cosmetic', id: 'aurora' },
  20: { kind: 'cosmetic', id: 'royal' },
  30: { kind: 'cosmetic', id: 'phoenix' },
};

export const TIERS: PassTier[] = Array.from({ length: PASS_TIERS }, (_, i) => {
  const tier = i + 1;
  return { tier, free: FREE_SPECIAL[tier] ?? { kind: 'coins', amount: 30 + Math.floor(tier / 5) * 10 }, gold: GOLD_SPECIAL[tier] ?? null };
});

export const tierFromXp = (xp: number) => Math.min(PASS_TIERS, Math.floor(xp / XP_PER_TIER));

export const claimKey = (seasonId: string, tier: number, track: 'free' | 'gold') => `${seasonId}:${tier}:${track}`;

export interface PassState {
  /** Pass XP per season id; old seasons stay so their tiers remain claimable. */
  xp: Record<string, number>;
  /** Season ids the Gold Pass was bought for. */
  gold: string[];
  claimed: string[];
}

export const emptyPass = (): PassState => ({ xp: {}, gold: [], claimed: [] });

/** Every tier reached but not yet claimed, across every season you've played (nothing ever expires). */
export function unclaimed(s: PassState): { seasonId: string; tier: number; track: 'free' | 'gold' }[] {
  const out: { seasonId: string; tier: number; track: 'free' | 'gold' }[] = [];
  for (const [seasonId, xp] of Object.entries(s.xp)) {
    for (let t = 1; t <= tierFromXp(xp); t++) {
      if (!s.claimed.includes(claimKey(seasonId, t, 'free'))) out.push({ seasonId, tier: t, track: 'free' });
      if (s.gold.includes(seasonId) && TIERS[t - 1].gold && !s.claimed.includes(claimKey(seasonId, t, 'gold'))) out.push({ seasonId, tier: t, track: 'gold' });
    }
  }
  return out;
}
