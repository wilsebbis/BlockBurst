/**
 * Player level from XP, what each level unlocks, and what a game pays. Nothing here reads spending.
 *
 * The unlock ladder shows the fun first and delays every ask: level 1 is the board itself (Classic and
 * Adventure) and your collection. Daily habits arrive next, then the shop and crate, then competition, then the
 * pass and events, then crews. The store button appears on the home screen at level 4 (it's always reachable from
 * Settings). Locked features stay visible with their level, and each unlock gets a celebration.
 */
export type Feature = 'daily' | 'challenges' | 'gifts' | 'shop' | 'crate' | 'ranks' | 'leagues' | 'pass' | 'events' | 'crews';

export const UNLOCKS: Record<Feature, number> = { daily: 2, challenges: 2, gifts: 2, shop: 3, crate: 3, ranks: 4, leagues: 4, pass: 5, events: 5, crews: 6 };

export const FEATURE_NAMES: Record<Feature, string> = {
  daily: 'Daily Board',
  challenges: 'Challenges',
  gifts: 'Gift Box and Calendar',
  shop: 'Item Shop',
  crate: 'Mystery Crate',
  ranks: 'Ranks',
  leagues: 'Leagues',
  pass: 'Blast Pass',
  events: 'Events calendar',
  crews: 'Crews',
};

export const FEATURE_BLURB: Record<Feature, string> = {
  daily: 'One board a day, the same start for everyone. Your best score counts.',
  challenges: 'Three small goals a day and three bigger ones a week.',
  gifts: 'A gift box that fills while you are away, and a calendar that moves on any day you play.',
  shop: 'Skins, themes and bursts that rotate daily, for coins you earn by playing. Every item comes back.',
  crate: 'Coins for a surprise cosmetic. Published odds, never a duplicate, and every item has a fixed price too.',
  ranks: 'A skill ladder for Classic games, Bronze to Legend. Tiers you reach are floors.',
  leagues: 'A weekly race of 30 on XP. The top 7 move up; nobody moves down.',
  pass: 'A season of rewards earned by playing. Every reward is visible, and nothing expires.',
  events: 'Weekend Coin Fest and yearly seasons, all on a public calendar.',
  crews: 'Play together with up to 10. Shared goals, no pressure.',
};

export const STORE_BUTTON_LEVEL = 4;

/** Features that a level-up just opened. */
export const newlyUnlocked = (before: number, after: number) => (Object.keys(UNLOCKS) as Feature[]).filter((f) => UNLOCKS[f] > before && UNLOCKS[f] <= after);

/** XP needed to reach level n (cumulative). Level 1 is free. */
export const xpForLevel = (n: number) => (n <= 1 ? 0 : Math.round(80 * Math.pow(n - 1, 1.5)));

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return { level, into: xp - xpForLevel(level), need: xpForLevel(level + 1) - xpForLevel(level) };
}

export const unlocked = (f: Feature, level: number) => level >= UNLOCKS[f];

export type RunMode = 'classic' | 'daily' | 'archive' | 'adventure';

export const MAX_RUN_XP = 250;

/** XP for a finished game: a base, 3 per line cleared, and bonuses for today's Daily Board and Adventure wins. */
export function xpForRun(lines: number, mode: RunMode, firstDailyToday: boolean, won: boolean): number {
  const base = 10 + lines * 3 + (mode === 'daily' && firstDailyToday ? 40 : 0) + (mode === 'adventure' && won ? 30 : 0);
  return Math.min(MAX_RUN_XP, base);
}

/** Coins for a finished game: one per two lines, 10 per Perfect Clear. Adventure stars pay separately. */
export const coinsForRun = (lines: number, perfects: number) => Math.floor(lines / 2) + perfects * 10;

/**
 * A won round (an Adventure level cleared, or a new best) pays out in whole chests: its coins round up to the
 * next 50, and never less than 50, so the treasure-chest shower always pays a satisfying amount.
 */
export const winPayout = (coins: number) => Math.max(50, Math.ceil(coins / 50) * 50);

/** Levels per Adventure world (kept in step with engine/levels' WORLD_SIZE by a test). */
export const LEVELS_PER_WORLD = 10;

/** A cleared Adventure level pays 50 coins per star, plus 50 for every world reached beyond the first. */
export const levelPayout = (level: number, stars: number) => 50 * stars + 50 * Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD);

/** Adventure: coins for each new star earned on a level. */
export const STAR_COINS = 15;

export const LEVEL_UP_COINS = 30;
