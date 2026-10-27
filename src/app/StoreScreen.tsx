/**
 * The demo store (real money). It sells the Gold Pass, cosmetics you pick yourself (never a random crate), an
 * ad-free switch and an optional tip. Coins are not for sale, so money never touches the Mystery Crate. No payment
 * provider is wired up (RevenueCat or a web checkout would plug in here): purchases are simulated, and they all
 * pass the same guardrails (16+, a $50 hard monthly ceiling, and your own lower limit).
 */
import { useState } from 'react';
import clsx from 'clsx';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { SpendMeter } from '../components/shared/GuardrailBadge';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { cratePool } from '../lib/crates';
import { AGE_BLOCK_MESSAGE, ageFrom, COSMETIC_PRICE_CENTS, formatCents, MIN_PURCHASE_AGE, NO_ADS_CENTS, STARTER, TIP_CENTS } from '../lib/economy';
import { GOLD_CENTS, seasonOf } from '../lib/pass';
import { useEconomyStore } from '../stores/useEconomyStore';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function StoreScreen() {
  const go = useNav((x) => x.go);
  const eco = useEconomyStore();
  const meta = useMetaStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [picks, setPicks] = useState<string[]>([]);
  const season = seasonOf();
  const thisYear = new Date().getUTCFullYear();
  const blocked = eco.birthYear !== null && ageFrom(eco.birthYear, thisYear) < MIN_PURCHASE_AGE;
  const forSale = cratePool().filter((c) => !meta.owned.includes(c.id));

  function buy(id: string, cents: number, after?: () => void) {
    try {
      eco.purchase(id, cents);
      after?.();
      setMsg('Thank you! (Demo store: no money was taken.)');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Store" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <p className="text-sm font-bold text-white/80">Everything here can also be earned by playing. Coins are never sold. This is a demo store: no payment provider is connected and no money changes hands.</p>
          <div className="mt-3">
            <SpendMeter />
          </div>
        </Panel>

        {eco.birthYear === null ? (
          <Panel>
            <h2 className="font-display text-lg font-extrabold">Before you buy anything</h2>
            <label className="mt-2 block text-sm font-bold">
              What year were you born?
              <div className="mt-1 flex gap-2">
                <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} className="min-h-tap w-full rounded-xl border-2 border-night-950 bg-night-950 px-3 py-2 text-white" placeholder="YYYY" />
                <Button tone="ghost" disabled={year.length !== 4 || Number(year) > thisYear || Number(year) < thisYear - 120} onClick={() => eco.setBirthYear(Number(year))}>
                  OK
                </Button>
              </div>
            </label>
          </Panel>
        ) : blocked ? (
          <Panel>
            <p className="font-bold">{AGE_BLOCK_MESSAGE}</p>
          </Panel>
        ) : (
          <>
            <Panel className="!bg-amber-900/60">
              <h2 className="font-display text-xl font-extrabold">🎟️ Gold Pass · {formatCents(GOLD_CENTS)}</h2>
              <p className="text-sm font-bold text-white/80">Adds the Gold track to this season's Blast Pass ({season.name}): a burst, a theme, a skin and an avatar. Cosmetic only, never coins. It never expires, and there are no tier skips to buy.</p>
              <Button tone="gold" className="mt-2 w-full" disabled={meta.pass.gold.includes(season.id)} onClick={() => buy(`gold:${season.id}`, GOLD_CENTS, () => meta.grantGold(season.id))}>
                {meta.pass.gold.includes(season.id) ? 'You have it this season' : `Get it for ${formatCents(GOLD_CENTS)}`}
              </Button>
            </Panel>

            <Panel>
              <h2 className="font-display text-xl font-extrabold">🚫📺 No sponsor breaks · {formatCents(NO_ADS_CENTS)}</h2>
              <p className="text-sm font-bold text-white/70">Turns off sponsor breaks between games for good. Optional rewarded breaks in the Item Shop stay available if you want them.</p>
              <Button tone="cool" className="mt-2 w-full" disabled={eco.ads.removed} onClick={() => buy('no-ads', NO_ADS_CENTS, () => eco.removeAds())}>
                {eco.ads.removed ? 'Sponsor breaks are off' : `Turn them off for ${formatCents(NO_ADS_CENTS)}`}
              </Button>
            </Panel>

            <Panel>
              <h2 className="font-display text-xl font-extrabold">Pick a cosmetic · {formatCents(COSMETIC_PRICE_CENTS)} each</h2>
              <p className="text-xs font-bold text-white/60">Any Mystery Crate item, chosen by you. No random boxes for money.</p>
              {forSale.length === 0 && <p className="mt-2 text-sm font-bold">You have them all!</p>}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {forSale.map((c) => (
                  <div key={c.id} className="flex flex-col items-center rounded-xl border-2 border-night-950 bg-night-950/40 p-1 text-center">
                    <CosmeticPreview item={c} size={40} />
                    <p className="w-full truncate text-xs font-extrabold">{c.name}</p>
                    <Button tone="gold" className="mt-1 w-full !min-h-[44px] !px-1 text-xs" onClick={() => buy(`cosmetic:${c.id}`, COSMETIC_PRICE_CENTS, () => meta.grantCosmetic(c.id))}>
                      {formatCents(COSMETIC_PRICE_CENTS)}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>

            {!eco.starterBought && forSale.length >= STARTER.picks && (
              <Panel>
                <h2 className="font-display text-xl font-extrabold">Starter pack · {formatCents(STARTER.priceCents)}</h2>
                <p className="text-sm font-bold text-white/70">{STARTER.label}. One time only, and it stays here until you want it.</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {forSale.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setPicks((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : p.length < STARTER.picks ? [...p, c.id] : p))}
                      aria-pressed={picks.includes(c.id)}
                      className={clsx('min-h-[40px] rounded-full border-2 px-3 py-1 text-xs font-extrabold', picks.includes(c.id) ? 'border-night-950 bg-amber-400 text-night-950' : 'border-white/30')}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
                <Button
                  tone="gold"
                  className="mt-2 w-full"
                  disabled={picks.length !== STARTER.picks}
                  onClick={() =>
                    buy(STARTER.id, STARTER.priceCents, () => {
                      for (const id of picks) meta.grantCosmetic(id);
                      eco.markStarter();
                    })
                  }
                >
                  {picks.length === STARTER.picks ? `Get both for ${formatCents(STARTER.priceCents)}` : `Pick ${STARTER.picks - picks.length} more`}
                </Button>
              </Panel>
            )}

            <Panel>
              <h2 className="font-display text-xl font-extrabold">Support the game</h2>
              <p className="text-sm font-bold text-white/70">An optional one-time tip. It unlocks nothing and counts toward your spending limit.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TIP_CENTS.map((c) => (
                  <Button key={c} tone="ghost" onClick={() => buy(`tip:${c}`, c)}>
                    Tip {formatCents(c)}
                  </Button>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-extrabold">Your monthly limit</h2>
              <p className="text-xs font-bold text-white/60">Lowering takes effect now. Raising waits until next month.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 500, 1000, 2500, 5000].map((c) => (
                  <Button key={c} tone={eco.currentCap() === c ? 'go' : 'ghost'} className="!px-3 text-sm" onClick={() => eco.setCap(c)}>
                    {formatCents(c)}
                  </Button>
                ))}
              </div>
              {eco.pendingCap && (
                <p className="mt-1 text-xs font-bold text-white/70">
                  {formatCents(eco.pendingCap.cents)} from {eco.pendingCap.month}.
                </p>
              )}
            </Panel>
          </>
        )}
        {msg && (
          <Panel className="!bg-amber-400/25" >
            <p className="text-sm font-bold" role="status">
              {msg}
            </p>
          </Panel>
        )}
      </div>
    </Screen>
  );
}
