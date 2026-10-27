import clsx from 'clsx';
import { useState } from 'react';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Meter, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { TROPHIES } from '../lib/achievements';
import { mustCosmetic, type Slot } from '../lib/cosmetics';
import { LEAGUES } from '../lib/leagues';
import { FEATURE_NAMES, levelFromXp, UNLOCKS, type Feature } from '../lib/progression';
import { rankOf } from '../lib/ranks';
import { fmt } from '../lib/share';
import { adventureStars, useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

const MODE_LABEL = { classic: 'Classic', daily: 'Daily', archive: 'Daily (practice)', adventure: 'Adventure' } as const;

export function ProfileScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const [name, setName] = useState(s.name);
  const lv = levelFromXp(s.xp);
  const t = s.totals;
  const rank = rankOf(s.rank.rp);
  const stats: [string, string][] = [
    ['Best Classic score', fmt(s.best)],
    ['Games played', fmt(t.games)],
    ['Lines cleared', fmt(t.lines)],
    ['Pieces placed', fmt(t.pieces)],
    ['Best combo', `x${t.maxCombo}`],
    ['Most lines at once', String(t.bestMulti)],
    ['Perfect Clears', String(t.perfects)],
    ['Gems collected', fmt(t.gems)],
    ['Adventure stars', `${adventureStars(s.adventure)} (level ${s.adventure.unlocked})`],
    ['Daily Boards played', `${s.streak.totalDays} days (best run ${s.streak.best})`],
    ['Collection', `${s.owned.length} items`],
  ];

  return (
    <Screen>
      <ScreenHeader title="Profile" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <div className="flex items-center gap-3">
            <CosmeticPreview item={mustCosmetic(s.loadout.avatar)} size={56} />
            <div className="flex-1">
              <label className="block text-xs font-bold text-white/60" htmlFor="name">
                Display name
              </label>
              <div className="flex gap-2">
                <input id="name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} className="min-h-tap w-full rounded-xl border-2 border-night-950 bg-night-950 px-3 py-2 font-bold text-white" />
                <Button tone="ghost" onClick={() => s.setName(name)} disabled={name.trim() === s.name}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-3 font-display font-extrabold">Level {lv.level}</p>
          <Meter value={lv.into / lv.need} tone="bg-amber-400" label="Level progress" />
          <p className="mt-1 text-xs font-bold text-white/60">
            {lv.into}/{lv.need} XP to level {lv.level + 1}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
            <span className="rounded-xl bg-night-950/50 p-2">
              {rank.emoji} {rank.label}
            </span>
            <span className="rounded-xl bg-night-950/50 p-2">
              {LEAGUES[s.league.tier].emoji} {LEAGUES[s.league.tier].name} League
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {(['skin', 'theme', 'burst'] as Slot[]).map((k) => (
              <button key={k} onClick={() => go('collection')} aria-label={`Change ${k}`}>
                <CosmeticPreview item={mustCosmetic(s.loadout[k])} size={40} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold">Lifetime</h2>
          <dl className="mt-1 space-y-1 text-sm font-bold">
            {stats.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-white/70">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold">
            🏆 Trophies {s.trophies.length}/{TROPHIES.length}
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {TROPHIES.map((tr) => {
              const got = s.trophies.includes(tr.id);
              return (
                <li key={tr.id} className={clsx('rounded-xl border-2 border-night-950 p-2 text-xs font-bold', got ? 'bg-amber-400/25' : 'bg-white/5 opacity-70')}>
                  <span className={clsx('text-2xl', !got && 'grayscale')} aria-hidden>
                    {tr.emoji}
                  </span>
                  <span className="block font-display text-sm font-extrabold">{tr.name}</span>
                  <span className="block text-white/70">{tr.how}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold">Unlocks</h2>
          <ul className="mt-1 space-y-1 text-sm font-bold">
            {(Object.entries(UNLOCKS) as [Feature, number][])
              .sort((a, b) => a[1] - b[1])
              .map(([f, l]) => (
                <li key={f} className="flex justify-between">
                  <span>{FEATURE_NAMES[f]}</span>
                  <span className={l <= lv.level ? 'text-emerald-300' : 'text-white/60'}>{l <= lv.level ? '✔ open' : `level ${l}`}</span>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold">Recent games</h2>
          {s.history.length === 0 && <p className="text-sm font-bold text-white/60">Nothing yet. Go place some blocks!</p>}
          <ul className="mt-1 space-y-1 text-sm font-bold">
            {[...s.history]
              .reverse()
              .slice(0, 12)
              .map((h) => (
                <li key={h.at} className="flex justify-between gap-2">
                  <span className="text-white/70">
                    {MODE_LABEL[h.mode]}
                    {h.level ? ` ${h.level}${h.won ? ' ✔' : ''}` : ''}
                  </span>
                  <span>
                    {fmt(h.score)} · {h.lines} lines
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </Screen>
  );
}
