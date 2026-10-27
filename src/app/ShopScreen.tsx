/**
 * The rotating Item Shop. Coins only (earned by playing, never sold), fixed prices by rarity, and a fully public
 * rotation: today's items, the next few days' items, and the day anything else returns. No timers, no "last
 * chance", no personalised offers. The opt-in rewarded sponsor break lives here and nowhere else.
 */
import clsx from 'clsx';
import { useState } from 'react';
import { LockedCard } from './HomeScreen';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { synth } from '../engine/WebAudioSynthesizer';
import { rewardedRemaining, watchRewarded } from '../lib/adService';
import { RARITY_COLOR, type Cosmetic } from '../lib/cosmetics';
import { addDays, utcDateKey } from '../lib/dates';
import { liveConfig } from '../lib/liveConfig';
import { levelFromXp, unlocked } from '../lib/progression';
import { dailyFor, featuredFor, priceOf, shopFor } from '../lib/shop';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

function Item({ c, big = false }: { c: Cosmetic; big?: boolean }) {
  const s = useMetaStore();
  const owned = s.owned.includes(c.id);
  const price = priceOf(c);
  return (
    <Panel className={clsx('reveal flex flex-col items-center gap-1 !p-3 text-center', big && '!bg-violet-900/70')}>
      <CosmeticPreview item={c} size={big ? 72 : 52} />
      <p className="font-display font-extrabold leading-tight">{c.name}</p>
      <p className="text-[11px] font-bold capitalize" style={{ color: RARITY_COLOR[c.rarity] }}>
        {c.rarity} {c.slot}
      </p>
      <Button tone={owned ? 'ghost' : 'gold'} className="mt-auto w-full !min-h-[44px] text-sm" disabled={owned || s.coins < price} onClick={() => s.buyCosmetic(c.id) && synth.playCoin()}>
        {owned ? '✔ Owned' : `🪙 ${price}`}
      </Button>
    </Panel>
  );
}

export function ShopScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const today = utcDateKey();
  const level = levelFromXp(s.xp).level;
  const [left, setLeft] = useState(rewardedRemaining);
  const [busy, setBusy] = useState(false);
  const shop = shopFor(today);
  const cfg = liveConfig();

  if (!unlocked('shop', level))
    return (
      <Screen>
        <ScreenHeader title="Item Shop" onBack={() => go('home')} />
        <div className="px-4">
          <LockedCard feature="shop" />
        </div>
      </Screen>
    );

  return (
    <Screen>
      <ScreenHeader title="Item Shop" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <p className="text-sm font-bold text-white/80">Daily items change at 00:00 UTC and featured items every Monday. Everything comes back on a fixed public rotation, so nothing here is now-or-never.</p>

        <h2 className="font-display text-xl font-extrabold">⭐ Featured this week</h2>
        <div className="grid grid-cols-2 gap-3">
          {shop.featured.map((c) => (
            <Item key={c.id} c={c} big />
          ))}
        </div>

        <h2 className="font-display text-xl font-extrabold">🗓️ Today</h2>
        <div className="grid grid-cols-2 gap-3">
          {shop.daily.map((c) => (
            <Item key={c.id} c={c} />
          ))}
        </div>

        <Panel>
          <h2 className="font-display text-lg font-extrabold">Coming up</h2>
          <p className="text-xs font-bold text-white/60">The rotation is public. Plan ahead, or don't: it all comes round again.</p>
          <ul className="mt-2 space-y-2">
            {[1, 2, 3].map((k) => {
              const d = addDays(today, k);
              const items = [...(featuredFor(d)[0].id !== shop.featured[0].id ? featuredFor(d) : []), ...dailyFor(d)];
              return (
                <li key={d} className="flex items-center gap-2">
                  <span className="w-20 text-xs font-bold text-white/70">{k === 1 ? 'Tomorrow' : d}</span>
                  <span className="flex flex-wrap gap-1">
                    {items.map((c) => (
                      <span key={c.id} title={c.name} className={clsx('rounded-lg bg-night-950/60 px-1.5 py-0.5 text-sm', s.owned.includes(c.id) && 'opacity-40')}>
                        {c.emoji}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <h2 className="font-display text-lg font-extrabold">📺 Sponsor break (optional)</h2>
          <p className="text-sm font-bold text-white/70">
            Choose to watch a short sponsor break for 🪙 {cfg.rewardedCoins}. Up to {cfg.rewardedDailyCap} a day, only here, never after a game or when you're stuck.
          </p>
          <Button
            tone="ghost"
            className="mt-2 w-full"
            disabled={left <= 0 || busy}
            onClick={async () => {
              setBusy(true);
              const got = await watchRewarded();
              setBusy(false);
              setLeft(rewardedRemaining());
              if (got) synth.playChime();
            }}
          >
            {busy ? 'Sponsor break playing…' : left > 0 ? `Watch for 🪙 ${cfg.rewardedCoins} (${left} left today)` : "That's all for today"}
          </Button>
        </Panel>

        <Button tone="ghost" className="w-full" onClick={() => go('collection')}>
          🎨 See the whole collection
        </Button>
      </div>
    </Screen>
  );
}
