/**
 * The rotating Item Shop (Bark Battle's Kennel Shop, laid out like a Fortnite item shop):
 *  - two Featured slots that change every Monday (UTC) and four Daily slots that change at 00:00 UTC;
 *  - everything is priced in coins, which are only earned by playing, at fixed prices by rarity;
 *  - the rotation is a fixed public cycle, so nothing is scarce: every item says the day it's next back, and the
 *    whole pool is browsable in the Collection. No timers, no "last chance", no personalised prices or offers.
 */
import { COIN_PRICE, COSMETICS, type Cosmetic } from './cosmetics';
import { addDays, isoWeek, utcDateKey } from './dates';

export const SHOP_POOL: Cosmetic[] = COSMETICS.filter((c) => c.source === 'shop');
export const FEATURED_SLOTS = 2;
export const DAILY_SLOTS = 4;

const DAY = 86_400_000;
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY);
const weekNumber = (day: string) => Math.floor((dayNumber(day) + 3) / 7);

/** Featured items: the epic and rare part of the pool, two a week. */
const FEATURED_POOL = SHOP_POOL.filter((c) => c.rarity !== 'common');

export function featuredFor(day: string): Cosmetic[] {
  const w = weekNumber(day);
  return Array.from({ length: FEATURED_SLOTS }, (_, i) => FEATURED_POOL[(w * FEATURED_SLOTS + i) % FEATURED_POOL.length]);
}

export function dailyFor(day: string): Cosmetic[] {
  const featured = new Set(featuredFor(day).map((c) => c.id));
  const rest = SHOP_POOL.filter((c) => !featured.has(c.id));
  const d = dayNumber(day);
  return Array.from({ length: DAILY_SLOTS }, (_, i) => rest[(d * DAILY_SLOTS + i) % rest.length]);
}

export const shopFor = (day: string) => ({ featured: featuredFor(day), daily: dailyFor(day), week: isoWeek(Date.parse(`${day}T00:00:00Z`)) });

export const inShop = (id: string, day: string) => [...featuredFor(day), ...dailyFor(day)].some((c) => c.id === id);

/** The next UTC day (from `day`, today included) the item is in the shop, or null if it isn't a shop item. */
export function nextInShop(id: string, day: string): string | null {
  if (!SHOP_POOL.some((c) => c.id === id)) return null;
  for (let i = 0; i <= 60; i++) {
    const d = addDays(day, i);
    if (inShop(id, d)) return d;
  }
  return null;
}

export const priceOf = (c: Cosmetic) => COIN_PRICE[c.rarity];

export const todayShop = () => shopFor(utcDateKey());
