import clsx from 'clsx';
import { useEffect } from 'react';
import { LockedCard } from './HomeScreen';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Meter, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { mustCosmetic } from '../lib/cosmetics';
import { levelFromXp, unlocked } from '../lib/progression';
import { classicRequest } from '../lib/requests';
import { DIVISIONS, parFor, rankOf, rankSeason, RP_PER_DIVISION, seasonReward, TIERS } from '../lib/ranks';
import { fmt } from '../lib/share';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav, type Screen as ScreenId } from '../stores/useNav';

/** Ranks and Leagues share the Compete tab; this switches between them. */
export function CompeteTabs({ current }: { current: 'ranks' | 'leagues' }) {
  const go = useNav((s) => s.go);
  const tabs: { id: ScreenId; label: string }[] = [
    { id: 'ranks', label: '🏅 Ranks (skill)' },
    { id: 'leagues', label: '🏆 League (this week)' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border-[3px] border-night-950 bg-night-950/60 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={current === t.id} onClick={() => go(t.id)} className={clsx('min-h-tap rounded-xl font-display text-sm font-extrabold', current === t.id ? 'bg-amber-400 text-night-950' : 'text-white/70')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export function RanksScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const start = useNav((x) => x.start);
  const level = levelFromXp(s.xp).level;
  useEffect(() => {
    useMetaStore.getState().syncWeek();
  }, []);

  if (!unlocked('ranks', level))
    return (
      <Screen>
        <ScreenHeader title="Compete" onBack={() => go('home')} />
        <div className="px-4">
          <CompeteTabs current="ranks" />
          <LockedCard feature="ranks" />
        </div>
      </Screen>
    );

  const r = rankOf(s.rank.rp);
  const peak = rankOf(s.rank.peak);
  const season = rankSeason();
  const par = parFor(r.step);
  const reward = seasonReward(peak.tier);

  return (
    <Screen>
      <ScreenHeader title="Compete" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <CompeteTabs current="ranks" />
        <Panel className="text-center">
          <p className="text-6xl" aria-hidden>
            {r.emoji}
          </p>
          <h2 className="font-display text-3xl font-extrabold" style={{ color: r.colour }}>
            {r.label}
          </h2>
          {r.division > 0 && (
            <>
              <Meter value={r.into / RP_PER_DIVISION} className="mx-auto mt-2 max-w-xs" tone="bg-amber-400" label="Progress to the next division" />
              <p className="mt-1 text-sm font-bold text-white/70">
                {r.into}/{RP_PER_DIVISION} RP to the next division
              </p>
            </>
          )}
          <p className="mt-2 text-sm font-bold">
            Par for your division: <span className="text-amber-300">{fmt(par)}</span>
          </p>
          <p className="text-xs font-bold text-white/70">
            Classic game ≥ {fmt(par * 2)}: +35 RP · ≥ {fmt(par)}: +25 · ≥ {fmt(Math.round(par / 2))}: +10 · below: −10
          </p>
          <Button tone="gold" className="mt-3 w-full" onClick={() => start(classicRequest(), 'ranks')}>
            ▶ Play a ranked Classic game
          </Button>
          <p className="mt-2 text-xs font-bold text-white/60">Every Classic game counts, except games where you used 💡 hints. Tiers you reach are floors: you can slip a division, never out of a tier.</p>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-extrabold">Season {season.index + 1}</h3>
          <p className="text-sm font-bold text-white/70">
            {day(season.start)} to {day(season.end - 1)} (UTC), 6 weeks. When it ends you keep a reward for your best tier, and your rank eases down one tier for a fresh climb.
          </p>
          <p className="mt-2 text-sm font-bold">
            Best this season: {peak.emoji} {peak.label}
          </p>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-night-950/50 p-2">
            <span className="text-sm font-bold">Reward so far: 🪙 {reward.coins}</span>
            {reward.cosmetic && <CosmeticPreview item={mustCosmetic(reward.cosmetic)} size={36} />}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl font-extrabold">The ladder</h3>
          <ol className="mt-2 space-y-1">
            {TIERS.map((t, i) => {
              const sr = seasonReward(i);
              return (
                <li key={t.name} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold', i === r.tier ? 'bg-amber-400/25' : i < r.tier ? 'opacity-80' : 'opacity-60')}>
                  <span className="text-xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="flex-1" style={{ color: t.colour }}>
                    {t.name}
                    {i < TIERS.length - 1 ? ` III–I` : ''}
                  </span>
                  <span className="text-xs text-white/70">
                    par from {fmt(parFor(i * DIVISIONS))} · season 🪙{sr.coins}
                    {sr.cosmetic && ` + ${mustCosmetic(sr.cosmetic).emoji}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>

        {s.rank.history.length > 0 && (
          <Panel>
            <h3 className="font-display text-xl font-extrabold">Past seasons</h3>
            <ul className="mt-1 space-y-1 text-sm font-bold">
              {[...s.rank.history].reverse().map((h) => (
                <li key={h.season} className="flex justify-between">
                  <span>
                    Season {h.season.slice(1)} · {TIERS[h.peakTier].emoji} {TIERS[h.peakTier].name}
                  </span>
                  <span>🪙{h.coins}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </Screen>
  );
}
