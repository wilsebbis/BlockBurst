/**
 * Ranks: a skill ladder for Classic runs (Bark Battle's Arena Ladder, grown into named tiers with divisions).
 *
 *  - Seven tiers of three divisions (Bronze III up to Grandmaster I), then Legend. 100 RP per division.
 *  - Each Classic run is compared with your division's par score: well above par +35, at par +25, half of par
 *    +10, under that −10. Par rises with every division, so the ladder measures skill, not hours.
 *  - Tier gates are floors: you can slip back a division, never out of a tier you have reached.
 *  - Runs with the 💡 Hint assist count for nothing here (and say so), so a rank is always your own play.
 *  - Seasons last 6 weeks. When one ends you keep a reward for the best tier you reached (coins, and a cosmetic
 *    from Silver up), and RP soft-resets one tier down (never below Bronze). Rewards are earned, never bought.
 */
export const TIERS = [
  { name: 'Bronze', emoji: '🥉', colour: '#cd7f32' },
  { name: 'Silver', emoji: '🥈', colour: '#cbd5e1' },
  { name: 'Gold', emoji: '🥇', colour: '#facc15' },
  { name: 'Platinum', emoji: '💿', colour: '#5eead4' },
  { name: 'Diamond', emoji: '💎', colour: '#7dd3fc' },
  { name: 'Master', emoji: '🔮', colour: '#c084fc' },
  { name: 'Grandmaster', emoji: '🏵️', colour: '#fb7185' },
  { name: 'Legend', emoji: '👑', colour: '#fbbf24' },
] as const;

export const DIVISIONS = 3;
export const RP_PER_DIVISION = 100;
export const LEGEND_RP = (TIERS.length - 1) * DIVISIONS * RP_PER_DIVISION;

export interface RankInfo {
  tier: number;
  /** 3, 2 or 1 (III is the lowest). 0 for Legend. */
  division: number;
  /** Divisions climbed from Bronze III (0-based); Legend is 21. */
  step: number;
  into: number;
  label: string;
  emoji: string;
  colour: string;
}

export function rankOf(rp: number): RankInfo {
  const capped = Math.max(0, rp);
  const step = Math.min((TIERS.length - 1) * DIVISIONS, Math.floor(capped / RP_PER_DIVISION));
  const tier = Math.min(TIERS.length - 1, Math.floor(step / DIVISIONS));
  const t = TIERS[tier];
  if (tier === TIERS.length - 1) return { tier, division: 0, step, into: capped - LEGEND_RP, label: `${t.name} · ${capped - LEGEND_RP} RP`, emoji: t.emoji, colour: t.colour };
  const division = DIVISIONS - (step % DIVISIONS);
  return { tier, division, step, into: capped - step * RP_PER_DIVISION, label: `${t.name} ${'I'.repeat(division)}`, emoji: t.emoji, colour: t.colour };
}

/** The score a Classic run is measured against in a division. */
export const parFor = (step: number) => Math.round((800 * Math.pow(1.22, step)) / 50) * 50;

export function rpDelta(score: number, step: number): number {
  const par = parFor(step);
  if (score >= par * 2) return 35;
  if (score >= par) return 25;
  if (score >= par / 2) return 10;
  return -10;
}

/** RP at the start of a tier: the floor a loss can't take you under. */
export const tierFloor = (tier: number) => tier * DIVISIONS * RP_PER_DIVISION;

export function applyRun(rp: number, score: number): { rp: number; delta: number } {
  const r = rankOf(rp);
  const raw = rpDelta(score, r.step);
  const next = raw >= 0 ? rp + raw : Math.max(tierFloor(r.tier), rp + raw);
  return { rp: next, delta: next - rp };
}

export const SEASON_DAYS = 42;
/** Season 1 began Monday 2026-09-07 UTC; seasons run back to back. */
const EPOCH = Date.UTC(2026, 8, 7);
const DAY = 86_400_000;

export function rankSeason(now = Date.now()): { index: number; id: string; start: number; end: number } {
  const index = Math.max(0, Math.floor((now - EPOCH) / (SEASON_DAYS * DAY)));
  const start = EPOCH + index * SEASON_DAYS * DAY;
  return { index, id: `r${index + 1}`, start, end: start + SEASON_DAYS * DAY };
}

/** Soft reset: down one tier, to the bottom of it. */
export const softReset = (rp: number) => tierFloor(Math.max(0, rankOf(rp).tier - 1));

/** Season reward for the best tier reached. Shown on the Ranks screen before the season starts. */
export function seasonReward(bestTier: number): { coins: number; cosmetic: string | null } {
  const cosmetic = bestTier >= 4 ? 'rank-diamond' : bestTier >= 2 ? 'rank-gold' : bestTier >= 1 ? 'rank-silver' : null;
  return { coins: 100 + bestTier * 75, cosmetic };
}

export interface RankState {
  season: string;
  rp: number;
  /** Best RP reached this season. */
  peak: number;
  history: { season: string; peakTier: number; coins: number; cosmetic: string | null }[];
}

export const emptyRank = (now = Date.now()): RankState => ({ season: rankSeason(now).id, rp: 0, peak: 0, history: [] });

/** Close the stored season if a new one has begun. A season with no ranked runs changes nothing. */
export function rolloverRank(s: RankState, now = Date.now()): { state: RankState; result: RankState['history'][number] | null } {
  const season = rankSeason(now).id;
  if (s.season === season) return { state: s, result: null };
  if (s.peak <= 0) return { state: { ...s, season }, result: null };
  const peakTier = rankOf(s.peak).tier;
  const reward = seasonReward(peakTier);
  const result = { season: s.season, peakTier, coins: reward.coins, cosmetic: reward.cosmetic };
  const rp = softReset(s.rp);
  return { state: { season, rp, peak: rp, history: [...s.history, result].slice(-12) }, result };
}
