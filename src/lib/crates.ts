/**
 * The Mystery Crate, kept fair with the rules from Bark Battle's Pup Crates and Cluck Crossing's Prize Machine:
 *  - coins only, and coins are never sold, so no money ever goes into it;
 *  - published odds by rarity, shown on the crate;
 *  - never a duplicate: every crate is an item you don't have yet. A rarity you've finished gives its share to the
 *    others in proportion, and the crate says so;
 *  - pity that carries forever: Epic or better within 10 crates, Legendary within 30;
 *  - an honest reveal (the glow is the real rarity) and a fixed-price route: any crate item can be bought outright
 *    for its listed coin price;
 *  - each crate's randomness comes from your player salt and crate number, so reloading never rerolls it.
 */
import { createRng } from '../engine/rng';
import { COSMETICS, type Cosmetic, type Rarity } from './cosmetics';

export const CRATE_COST = 250;

export const ODDS: Record<Rarity, number> = { common: 0.6, rare: 0.28, epic: 0.09, legendary: 0.03 };

export const PITY_EPIC = 10;
export const PITY_LEGENDARY = 30;

export interface CrateState {
  opened: number;
  sinceEpic: number;
  sinceLegendary: number;
}

export const emptyCrate = (): CrateState => ({ opened: 0, sinceEpic: 0, sinceLegendary: 0 });

export const cratePool = () => COSMETICS.filter((c) => c.source === 'crate');

/** The odds the crate shows right now, for what you don't own yet (sums to 1, or is empty when complete). */
export function liveOdds(owned: string[]): Partial<Record<Rarity, number>> {
  const left = cratePool().filter((c) => !owned.includes(c.id));
  const present = (Object.keys(ODDS) as Rarity[]).filter((r) => left.some((c) => c.rarity === r));
  const total = present.reduce((a, r) => a + ODDS[r], 0);
  return Object.fromEntries(present.map((r) => [r, ODDS[r] / total]));
}

export function openCrate(owned: string[], s: CrateState, salt: string): { item: Cosmetic; state: CrateState; pity: boolean } | null {
  const left = cratePool().filter((c) => !owned.includes(c.id));
  if (!left.length) return null;
  const rng = createRng(`burst/crate/v1/${salt}/${s.opened}`);
  const has = (r: Rarity) => left.some((c) => c.rarity === r);
  let rarity: Rarity | null = null;
  let pity = false;
  if (s.sinceLegendary + 1 >= PITY_LEGENDARY && has('legendary')) {
    rarity = 'legendary';
    pity = true;
  } else if (s.sinceEpic + 1 >= PITY_EPIC && (has('epic') || has('legendary'))) {
    rarity = has('epic') ? 'epic' : 'legendary';
    pity = true;
  } else {
    let r = rng.next();
    for (const [k, p] of Object.entries(liveOdds(owned)) as [Rarity, number][]) {
      rarity = k;
      if ((r -= p) <= 0) break;
    }
  }
  const item = rng.pick(left.filter((c) => c.rarity === rarity));
  const epicPlus = item.rarity === 'epic' || item.rarity === 'legendary';
  return {
    item,
    pity,
    state: { opened: s.opened + 1, sinceEpic: epicPlus ? 0 : s.sinceEpic + 1, sinceLegendary: item.rarity === 'legendary' ? 0 : s.sinceLegendary + 1 },
  };
}
