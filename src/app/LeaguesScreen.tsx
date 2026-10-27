import clsx from 'clsx';
import { useEffect } from 'react';
import { CompeteTabs } from './RanksScreen';
import { LockedCard } from './HomeScreen';
import { NonHumanBadge } from '../components/shared/GuardrailBadge';
import { Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { LEAGUES, PROMOTE_TOP, rankIn, table, weekReward } from '../lib/leagues';
import { levelFromXp, unlocked } from '../lib/progression';
import { useNow } from '../lib/useNow';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function LeaguesScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const now = useNow(60_000);
  const level = levelFromXp(s.xp).level;
  useEffect(() => {
    useMetaStore.getState().syncWeek();
  }, []);

  if (!unlocked('leagues', level))
    return (
      <Screen>
        <ScreenHeader title="Compete" onBack={() => go('home')} />
        <div className="px-4">
          <CompeteTabs current="leagues" />
          <LockedCard feature="leagues" />
        </div>
      </Screen>
    );

  const { tier, week, weeklyXp, history } = s.league;
  const rows = table(tier, week, weeklyXp, now, s.name);
  const rank = rankIn(rows);
  const L = LEAGUES[tier];

  return (
    <Screen>
      <ScreenHeader title="Compete" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <CompeteTabs current="leagues" />
        <Panel>
          <div className="flex gap-1 overflow-x-auto pb-1" aria-label="League ladder">
            {LEAGUES.map((l, i) => (
              <span key={l.name} className={clsx('grid min-w-[3.2rem] place-items-center rounded-xl border-2 border-night-950 px-1 py-1 text-center font-display text-[11px] font-extrabold', i === tier ? 'bg-amber-400 text-night-950' : i < tier ? 'bg-emerald-400/30' : 'bg-white/5 opacity-60')}>
                <span className="text-2xl">{l.emoji}</span>
                {l.name}
              </span>
            ))}
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold">
            {L.emoji} {L.name} League · week {week.split('-W')[1]}
          </h2>
          <p className="text-sm font-bold text-white/70">Race on XP earned this week. The top {PROMOTE_TOP} move up a league. Nobody ever moves down, and a week off leaves your league as it is.</p>
          <p className="mt-2 text-sm font-bold">
            You're #{rank} with {weeklyXp} XP. Week rewards: 🥇 🪙{weekReward(1)} · top 3 🪙{weekReward(2)} · top {PROMOTE_TOP} 🪙{weekReward(PROMOTE_TOP)} · everyone else who plays 🪙{weekReward(PROMOTE_TOP + 1)}.
          </p>
        </Panel>

        <Panel className="!p-2">
          <p className="px-2 pb-1 text-xs font-bold text-white/60">Practice racers are labelled bots. Their pace is fixed for the week and never reacts to you. Real players arrive with the backend. Leagues count how much you played this week; Ranks count how well.</p>
          <ol>
            {rows.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                {i === PROMOTE_TOP && <div className="my-1 border-t-2 border-dashed border-emerald-400 text-center text-[10px] font-extrabold text-emerald-300">▲ promotion zone</div>}
                <div className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold', !r.bot && 'bg-amber-400/25')}>
                  <span className="w-6 text-white/60">{i + 1}</span>
                  <span className="flex-1">
                    {r.name}
                    {r.bot && <NonHumanBadge />}
                  </span>
                  <span>{r.xp} XP</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        {history.length > 0 && (
          <Panel>
            <h2 className="font-display text-xl font-extrabold">Past weeks</h2>
            <ul className="mt-1 space-y-1 text-sm font-bold">
              {[...history].reverse().map((h) => (
                <li key={h.week} className="flex justify-between">
                  <span>
                    {h.week} · {LEAGUES[h.tier].emoji} {LEAGUES[h.tier].name}
                  </span>
                  <span>
                    #{h.rank} {h.promoted ? '▲' : ''} · 🪙{h.coins}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </Screen>
  );
}
