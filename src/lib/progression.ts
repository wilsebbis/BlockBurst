/** What a finished Adventure level pays. Nothing here reads spending, and nothing is for sale. */

/** Coins for a finished level: one per two lines, 10 per Perfect Clear. Stars pay separately. */
export const coinsForRun = (lines: number, perfects: number) => Math.floor(lines / 2) + perfects * 10;

/**
 * A won level pays out in whole chests: its coins round up to the next 50, and never less than 50, so the
 * treasure-chest shower always pays a satisfying amount.
 */
export const winPayout = (coins: number) => Math.max(50, Math.ceil(coins / 50) * 50);

/** Levels per Adventure world (kept in step with engine/levels' WORLD_SIZE by a test). */
export const LEVELS_PER_WORLD = 10;

/** A cleared Adventure level pays 50 coins per star, plus 50 for every world reached beyond the first. */
export const levelPayout = (level: number, stars: number) => 50 * stars + 50 * Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD);

/** Coins for each new star earned on a level. */
export const STAR_COINS = 15;
