/**
 * Ads, following the monetization reference (rewarded first, interstitials only at natural breaks, banners never)
 * and the humane playbook the sibling games share:
 *
 *  - **Rewarded "sponsor breaks"** are opt-in, from the Item Shop only: +coins, capped per day. Never at the moment
 *    of loss: the game-over and pause screens show no ads and no offers (tests/playbook.test.ts).
 *  - **Interstitials** only between games, after the result screen is closed, at most one every
 *    `interstitialEveryGames` games and `interstitialMinGapSec` seconds, never in a new player's first games,
 *    never mid-game, and never for players who bought "No sponsor breaks".
 *  - **No banners** anywhere, so nothing sits near a tap target.
 *  - **Consent first.** Before the first ad, a consent card asks for personalised or contextual ads (where an IAB
 *    TCF CMP such as Google UMP plugs in). Players under 16, or who haven't told us their age, only get
 *    contextual ads.
 *
 * Providers: web games distribute through Poki or CrazyGames, so their SDKs are used when the page is hosted
 * there. Everywhere else the demo provider shows an in-app placeholder: no ad network is connected in this build.
 */
import type { LiveConfig } from './liveConfig';

export type Consent = 'unknown' | 'personalised' | 'contextual';

export interface AdLedger {
  consent: Consent;
  /** Bought "No sponsor breaks": interstitials off for good (rewarded stays available, by choice). */
  removed: boolean;
  lastInterstitial: number;
  gamesSinceInterstitial: number;
  rewarded: { day: string; count: number };
}

export const emptyAdLedger = (): AdLedger => ({ consent: 'unknown', removed: false, lastInterstitial: 0, gamesSinceInterstitial: 0, rewarded: { day: '', count: 0 } });

export interface BreakContext {
  now: number;
  totalGames: number;
}

export function interstitialDue(l: AdLedger, cfg: LiveConfig, ctx: BreakContext): boolean {
  if (l.removed) return false;
  if (ctx.totalGames < cfg.newPlayerGraceGames) return false;
  if (l.gamesSinceInterstitial < cfg.interstitialEveryGames) return false;
  return ctx.now - l.lastInterstitial >= cfg.interstitialMinGapSec * 1000;
}

export const rewardedLeft = (l: AdLedger, cfg: LiveConfig, day: string) => Math.max(0, cfg.rewardedDailyCap - (l.rewarded.day === day ? l.rewarded.count : 0));

/** Personalised ads need an explicit yes and a player we know is 16 or older. */
export const effectiveConsent = (l: AdLedger, age: number | null): Consent => (l.consent === 'personalised' && age !== null && age >= 16 ? 'personalised' : l.consent === 'unknown' ? 'unknown' : 'contextual');

export interface AdProvider {
  name: string;
  /** Resolves when the break is over (shown, skipped or unavailable). */
  interstitial(): Promise<void>;
  /** Resolves true only if the player watched to the end. */
  rewarded(): Promise<boolean>;
}

type PokiSDK = { commercialBreak(): Promise<void>; rewardedBreak(): Promise<boolean> };
type CrazySDK = { SDK: { ad: { requestAd(kind: 'midgame' | 'rewarded', cb: { adFinished?: () => void; adError?: () => void; adStarted?: () => void }): void } } };

function pokiProvider(sdk: PokiSDK): AdProvider {
  return { name: 'Poki', interstitial: () => sdk.commercialBreak().catch(() => undefined), rewarded: () => sdk.rewardedBreak().catch(() => false) };
}

function crazyProvider(sdk: CrazySDK): AdProvider {
  const request = (kind: 'midgame' | 'rewarded') => new Promise<boolean>((resolve) => sdk.SDK.ad.requestAd(kind, { adFinished: () => resolve(true), adError: () => resolve(false) }));
  return { name: 'CrazyGames', interstitial: () => request('midgame').then(() => undefined), rewarded: () => request('rewarded') };
}

/** The demo provider hands the break to the app's own placeholder card (SponsorBreak.tsx). */
export function demoProvider(show: (kind: 'interstitial' | 'rewarded') => Promise<boolean>): AdProvider {
  return { name: 'Demo', interstitial: () => show('interstitial').then(() => undefined), rewarded: () => show('rewarded') };
}

export function detectProvider(fallback: AdProvider): AdProvider {
  const w = globalThis as unknown as { PokiSDK?: PokiSDK; CrazyGames?: CrazySDK };
  if (w.PokiSDK) return pokiProvider(w.PokiSDK);
  if (w.CrazyGames?.SDK?.ad) return crazyProvider(w.CrazyGames);
  return fallback;
}
