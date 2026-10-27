/**
 * The demo store's ledger and the ad ledger. No payment provider or ad network is wired up: purchases are
 * simulated and logged so the $50 humane cap, the player's own lower limit and the under-16 block can be enforced
 * and tested, and sponsor breaks are counted so their caps can be.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptyAdLedger, type AdLedger, type Consent } from '../lib/ads';
import { AGE_BLOCK_MESSAGE, ageFrom, assertSpendAllowed, effectiveCap, HARD_CAP_CENTS, MIN_PURCHASE_AGE, type Purchase } from '../lib/economy';
import { monthKey } from '../lib/dates';
import { persistStorage } from '../lib/storage';

interface EconomyState {
  purchases: Purchase[];
  userCapCents: number;
  /** A raise to the player's limit waits until next month; a cut is immediate. */
  pendingCap: { cents: number; month: string } | null;
  birthYear: number | null;
  starterBought: boolean;
  ads: AdLedger;
  currentCap(): number;
  markStarter(): void;
  setCap(cents: number): void;
  setBirthYear(y: number): void;
  /** Throws HumaneCapError (or an age block) instead of recording a purchase that breaks a guardrail. */
  purchase(itemId: string, priceCents: number, now?: number): void;
  setConsent(c: Consent): void;
  removeAds(): void;
  gameEnded(): void;
  interstitialShown(now?: number): void;
  /** Records a rewarded break if today's cap allows it. */
  takeRewarded(day: string, cap: number): boolean;
}

export const useEconomyStore = create<EconomyState>()(
  persist(
    (set, get) => ({
      purchases: [],
      userCapCents: HARD_CAP_CENTS,
      pendingCap: null,
      birthYear: null,
      starterBought: false,
      ads: emptyAdLedger(),
      markStarter: () => set({ starterBought: true }),
      currentCap: () => {
        const { userCapCents, pendingCap } = get();
        if (pendingCap && pendingCap.month <= monthKey()) return effectiveCap(pendingCap.cents);
        return effectiveCap(userCapCents);
      },
      setCap: (cents) => {
        const next = effectiveCap(cents);
        const now = get().currentCap();
        if (next <= now) set({ userCapCents: next, pendingCap: null });
        else {
          const d = new Date();
          const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
          set({ userCapCents: now, pendingCap: { cents: next, month: monthKey(nextMonth) } });
        }
      },
      setBirthYear: (y) => set({ birthYear: y }),
      purchase: (itemId, priceCents, now = Date.now()) => {
        const { birthYear, purchases } = get();
        if (birthYear === null || ageFrom(birthYear, new Date(now).getUTCFullYear()) < MIN_PURCHASE_AGE) throw new Error(AGE_BLOCK_MESSAGE);
        const month = monthKey(new Date(now));
        assertSpendAllowed(purchases, month, get().currentCap(), priceCents, now);
        set({ purchases: [...purchases, { itemId, priceCents, at: now, month }] });
      },
      setConsent: (consent) => set((s) => ({ ads: { ...s.ads, consent } })),
      removeAds: () => set((s) => ({ ads: { ...s.ads, removed: true } })),
      gameEnded: () => set((s) => ({ ads: { ...s.ads, gamesSinceInterstitial: s.ads.gamesSinceInterstitial + 1 } })),
      interstitialShown: (now = Date.now()) => set((s) => ({ ads: { ...s.ads, lastInterstitial: now, gamesSinceInterstitial: 0 } })),
      takeRewarded: (day, cap) => {
        const r = get().ads.rewarded;
        const count = r.day === day ? r.count : 0;
        if (count >= cap) return false;
        set((s) => ({ ads: { ...s.ads, rewarded: { day, count: count + 1 } } }));
        return true;
      },
    }),
    { name: 'burst-economy', storage: persistStorage, version: 1 },
  ),
);
