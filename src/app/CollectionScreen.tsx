/**
 * Collection: every cosmetic in the game, owned or not, with the one way to get it written on the card. Equip
 * what you own; buy Mystery Crate items outright for their fixed coin price; see the day each shop item is next
 * in the rotation. The Mystery Crate itself lives here too, with its live odds and pity counters on show.
 */
import clsx from 'clsx';
import { useState } from 'react';
import { ModalShell } from '../components/game/ModalShell';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { synth } from '../engine/WebAudioSynthesizer';
import { COIN_PRICE, COSMETICS, mustCosmetic, RARITY_COLOR, SLOT_NAMES, SOURCE_TEXT, type Rarity, type Slot } from '../lib/cosmetics';
import { CRATE_COST, cratePool, liveOdds, ODDS, PITY_EPIC, PITY_LEGENDARY } from '../lib/crates';
import { utcDateKey } from '../lib/dates';
import { levelFromXp, unlocked, UNLOCKS } from '../lib/progression';
import { nextInShop } from '../lib/shop';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

const SLOTS: Slot[] = ['skin', 'theme', 'burst', 'avatar'];
const TAB_LABEL: Record<Slot, string> = { skin: 'Skins', theme: 'Themes', burst: 'Bursts', avatar: 'Avatars' };
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

export function CollectionScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const [slot, setSlot] = useState<Slot>('skin');
  const [reveal, setReveal] = useState<{ id: string; pity: boolean } | null>(null);
  const today = utcDateKey();
  const level = levelFromXp(s.xp).level;
  const crateOpen = unlocked('crate', level);
  const left = cratePool().filter((c) => !s.owned.includes(c.id));
  const odds = liveOdds(s.owned);
  const items = COSMETICS.filter((c) => c.slot === slot);

  return (
    <Screen>
      <ScreenHeader title="Collection" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <div className="flex items-center gap-3">
            <span className="text-5xl" aria-hidden>
              📦
            </span>
            <div className="flex-1">
              <h2 className="font-display text-xl font-extrabold">Mystery Crate</h2>
              <p className="text-xs font-bold text-white/70">Coins only (never sold). Never a duplicate. Every item inside also has a fixed price below.</p>
            </div>
          </div>
          {crateOpen ? (
            <>
              <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs font-bold">
                {(Object.keys(ODDS) as Rarity[]).map((r) => (
                  <div key={r} className="rounded-lg bg-night-950/60 p-1">
                    <dt style={{ color: RARITY_COLOR[r] }} className="capitalize">
                      {r}
                    </dt>
                    <dd>{odds[r] !== undefined ? pct(odds[r]!) : 'done'}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1 text-[11px] font-bold text-white/60">
                Published odds {Object.values(ODDS).map(pct).join(' / ')}; a rarity you've finished passes its share to the rest. Pity: Epic or better within {PITY_EPIC} crates ({PITY_EPIC - s.crate.sinceEpic} to go), Legendary within {PITY_LEGENDARY} ({PITY_LEGENDARY - s.crate.sinceLegendary} to go).
              </p>
              <Button
                tone="grape"
                className="mt-2 w-full"
                disabled={!left.length || s.coins < CRATE_COST}
                onClick={() => {
                  synth.playCrank();
                  const r = s.openCrate();
                  if (r) {
                    setReveal(r);
                    setTimeout(() => synth.playChime(), 700);
                  }
                }}
              >
                {left.length ? `Open for 🪙 ${CRATE_COST}` : 'You own everything in the crate 🎉'}
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm font-bold text-white/60">🔒 Opens at level {UNLOCKS.crate}.</p>
          )}
        </Panel>

        <div className="grid grid-cols-4 gap-1 rounded-2xl border-[3px] border-night-950 bg-night-950/60 p-1" role="tablist">
          {SLOTS.map((k) => (
            <button key={k} role="tab" aria-selected={slot === k} onClick={() => setSlot(k)} className={clsx('min-h-tap rounded-xl font-display text-xs font-extrabold', slot === k ? 'bg-amber-400 text-night-950' : 'text-white/70')}>
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        <p className="text-sm font-bold text-white/70">
          {SLOT_NAMES[slot]}: {items.filter((c) => s.owned.includes(c.id)).length}/{items.length} owned. All cosmetic: nothing here changes pieces or scores.
        </p>
        <ul className="grid grid-cols-2 gap-3">
          {items.map((c) => {
            const owned = s.owned.includes(c.id);
            const equipped = s.loadout[slot] === c.id;
            const next = c.source === 'shop' ? nextInShop(c.id, today) : null;
            return (
              <li key={c.id} className="reveal">
                <Panel className={clsx('flex h-full flex-col items-center gap-1 !p-3 text-center', equipped && '!border-amber-400')}>
                  <CosmeticPreview item={c} size={52} dim={!owned} />
                  <p className="font-display font-extrabold leading-tight">{c.name}</p>
                  <p className="text-[11px] font-bold capitalize" style={{ color: RARITY_COLOR[c.rarity] }}>
                    {c.rarity}
                  </p>
                  {owned ? (
                    <Button tone={equipped ? 'ghost' : 'go'} className="mt-auto w-full !min-h-[44px] text-sm" disabled={equipped} onClick={() => s.equip(slot, c.id)}>
                      {equipped ? '✔ Equipped' : 'Equip'}
                    </Button>
                  ) : c.source === 'crate' ? (
                    <Button tone="gold" className="mt-auto w-full !min-h-[44px] text-sm" disabled={!crateOpen || s.coins < COIN_PRICE[c.rarity]} onClick={() => s.buyCosmetic(c.id) && synth.playCoin()}>
                      Buy 🪙 {COIN_PRICE[c.rarity]}
                    </Button>
                  ) : (
                    <p className="mt-auto text-[11px] font-bold text-white/60">
                      {SOURCE_TEXT[c.source]}
                      {next && (next === today ? ' · in the shop today' : ` · next in the shop ${next}`)}
                    </p>
                  )}
                </Panel>
              </li>
            );
          })}
        </ul>
      </div>

      {reveal && (
        <ModalShell label="Crate opened">
          {(() => {
            const c = mustCosmetic(reveal.id);
            return (
              <div className="flex flex-col items-center text-center">
                {/* The glow is the real rarity: an honest reveal. */}
                <div className="pop-in rounded-2xl p-2" style={{ boxShadow: `0 0 40px 6px ${RARITY_COLOR[c.rarity]}` }}>
                  <CosmeticPreview item={c} size={96} />
                </div>
                <h2 className="mt-3 font-display text-3xl font-extrabold">{c.name}</h2>
                <p className="font-bold capitalize" style={{ color: RARITY_COLOR[c.rarity] }}>
                  {c.rarity} {SLOT_NAMES[c.slot].slice(0, -1).toLowerCase()}
                  {reveal.pity && ' · pity guarantee'}
                </p>
                <div className="mt-4 grid w-full grid-cols-2 gap-2">
                  <Button tone="ghost" onClick={() => setReveal(null)}>
                    Nice
                  </Button>
                  <Button
                    tone="go"
                    onClick={() => {
                      s.equip(c.slot, c.id);
                      setReveal(null);
                    }}
                  >
                    Equip now
                  </Button>
                </div>
              </div>
            );
          })()}
        </ModalShell>
      )}
    </Screen>
  );
}
