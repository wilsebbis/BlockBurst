/**
 * Spend guardrails. A hard $50 ceiling, checked both per calendar month (UTC) and over any rolling 30 days, so it
 * can't be dodged by straddling a month boundary. Players can only lower it on the spot.
 * The store here is a demo: no payment provider is wired up, and purchases are simulated.
 */
export const HARD_CAP_CENTS = 5000;
export const ROLLING_WINDOW_MS = 30 * 86_400_000;

export const HUMANE_CAP_MESSAGE = 'Humane Cap Reached: Monthly spend ceiling is $50.00.';

export class HumaneCapError extends Error {
  constructor(message = HUMANE_CAP_MESSAGE) {
    super(message);
    this.name = 'HumaneCapError';
  }
}

/**
 * What the demo store sells: the Gold Pass, cosmetics you choose (never a random crate), an ad-free switch and an
 * optional supporter tip. Coins are never sold, so nothing bought can feed the Mystery Crate.
 */
export const COSMETIC_PRICE_CENTS = 99;
export const TIP_CENTS = [199, 499];
export const NO_ADS_CENTS = 199;

export interface Purchase {
  itemId: string;
  priceCents: number;
  at: number;
  month: string;
}

export const effectiveCap = (userCapCents: number) => Math.max(0, Math.min(HARD_CAP_CENTS, userCapCents));

export const spentInMonth = (purchases: Purchase[], month: string) => purchases.filter((p) => p.month === month).reduce((s, p) => s + p.priceCents, 0);

export const spentInWindow = (purchases: Purchase[], now: number) => purchases.filter((p) => now - p.at < ROLLING_WINDOW_MS).reduce((s, p) => s + p.priceCents, 0);

export type SpendCheck = { ok: true } | { ok: false; reason: string };

/** Throws a HumaneCapError when a purchase would pass the $50 ceiling or the player's own lower limit. */
export function assertSpendAllowed(purchases: Purchase[], month: string, userCapCents: number, priceCents: number, now = Date.now()): void {
  if (priceCents < 0) throw new HumaneCapError('Invalid price.');
  if (spentInMonth(purchases, month) + priceCents > HARD_CAP_CENTS || spentInWindow(purchases, now) + priceCents > HARD_CAP_CENTS) throw new HumaneCapError();
  const cap = effectiveCap(userCapCents);
  if (spentInMonth(purchases, month) + priceCents > cap) {
    throw new HumaneCapError(`You set a monthly limit of $${(cap / 100).toFixed(2)}, and this would pass it. It resets on the 1st (UTC).`);
  }
}

export function checkSpend(purchases: Purchase[], month: string, userCapCents: number, priceCents: number, now = Date.now()): SpendCheck {
  try {
    assertSpendAllowed(purchases, month, userCapCents, priceCents, now);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Purchases need the player to be at least this old (the FTC's line for loot boxes; we apply it to everything). */
export const MIN_PURCHASE_AGE = 16;
export const ageFrom = (birthYear: number, currentYear: number) => currentYear - birthYear;
export const AGE_BLOCK_MESSAGE = 'Purchases are turned off for players under 16. Every cosmetic can be earned by playing.';

/**
 * Starter pack ("Where the money comes from": IAP toolkit). One-time, shown plainly in the store, with no timer,
 * no "only today" and no pop-up. You pick both items yourself.
 */
export const STARTER = { id: 'starter', priceCents: 149, picks: 2, label: 'Starter pack: pick any 2 Mystery Crate items yourself' } as const;

/** Blast Pass Gold: flat price in dollars, cosmetic only. */
export { GOLD_CENTS } from './pass';

