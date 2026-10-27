/**
 * Runs sponsor breaks through whichever provider is present (Poki, CrazyGames, or the in-app demo placeholder),
 * after checking the policy in ads.ts and asking for consent the first time.
 */
import { create } from 'zustand';
import { demoProvider, detectProvider, interstitialDue, rewardedLeft } from './ads';
import { utcDateKey } from './dates';
import { ageFrom } from './economy';
import { liveConfig } from './liveConfig';
import { useEconomyStore } from '../stores/useEconomyStore';
import { useMetaStore } from '../stores/useMetaStore';

interface AdUi {
  /** The demo placeholder being shown, if any. */
  showing: { kind: 'interstitial' | 'rewarded'; resolve(watched: boolean): void } | null;
  /** The consent card, if waiting for an answer. */
  consent: { resolve(): void } | null;
}

export const useAdUi = create<AdUi>(() => ({ showing: null, consent: null }));

const provider = () => detectProvider(demoProvider((kind) => new Promise<boolean>((resolve) => useAdUi.setState({ showing: { kind, resolve } }))));

async function ensureConsent(): Promise<void> {
  if (useEconomyStore.getState().ads.consent !== 'unknown') return;
  await new Promise<void>((resolve) => useAdUi.setState({ consent: { resolve } }));
}

export const playerAge = () => {
  const y = useEconomyStore.getState().birthYear;
  return y === null ? null : ageFrom(y, new Date().getUTCFullYear());
};

/** Called when the player leaves a finished game's result screen: the natural break between games. */
export async function maybeInterstitial(now = Date.now()): Promise<void> {
  useEconomyStore.getState().gameEnded();
  const eco = useEconomyStore.getState();
  if (!interstitialDue(eco.ads, liveConfig(), { now, totalGames: useMetaStore.getState().totals.games })) return;
  await ensureConsent();
  eco.interstitialShown(now);
  await provider().interstitial();
}

export const rewardedRemaining = () => rewardedLeft(useEconomyStore.getState().ads, liveConfig(), utcDateKey());

/** An opt-in rewarded break from the shop. Pays coins only if watched to the end. */
export async function watchRewarded(): Promise<number> {
  const cfg = liveConfig();
  if (rewardedRemaining() <= 0) return 0;
  await ensureConsent();
  const watched = await provider().rewarded();
  if (!watched || !useEconomyStore.getState().takeRewarded(utcDateKey(), cfg.rewardedDailyCap)) return 0;
  useMetaStore.getState().addCoins(cfg.rewardedCoins);
  return cfg.rewardedCoins;
}

/**
 * The one revive a lost game may offer, paid for with a rewarded break. Pays no coins and does not use up the
 * shop's daily rewarded breaks; resolves true only if the break was watched to the end.
 */
export async function watchReviveAd(): Promise<boolean> {
  await ensureConsent();
  return provider().rewarded();
}
