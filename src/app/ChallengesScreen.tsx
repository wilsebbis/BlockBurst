import { LockedCard } from './HomeScreen';
import { Button, Meter, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { synth } from '../engine/WebAudioSynthesizer';
import { ALL_CLEAR_COINS, challengesFor, progressFor, weeklyFor, weeklyProgressFor } from '../lib/challenges';
import { isoWeek, utcDateKey } from '../lib/dates';
import { fmt } from '../lib/share';
import { levelFromXp, unlocked } from '../lib/progression';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function ChallengesScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const today = utcDateKey();
  const list = challengesFor(today);
  const c = progressFor(s.challenges, today);
  return (
    <Screen>
      <ScreenHeader title="Challenges" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        {!unlocked('challenges', levelFromXp(s.xp).level) ? (
          <LockedCard feature="challenges" />
        ) : (
          <>
            <p className="text-sm font-extrabold text-white/90">Three goals for today (UTC), the same for everyone. Finish what you like; nothing carries a penalty.</p>
            {list.map((ch) => {
              const p = Math.min(ch.target, c.progress[ch.stat] ?? 0);
              const done = p >= ch.target;
              const claimed = c.claimed.includes(ch.id);
              return (
                <Panel key={ch.id}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" aria-hidden>{ch.emoji}</span>
                    <div className="flex-1">
                      <p className="font-display text-lg font-extrabold leading-tight">{ch.label}</p>
                      <Meter value={p / ch.target} className="mt-1" />
                      <p className="mt-0.5 text-xs font-bold text-white/70">
                        {fmt(p)}/{fmt(ch.target)} · 🪙 {ch.coins}
                      </p>
                    </div>
                    <Button tone={done && !claimed ? 'gold' : 'ghost'} disabled={!done || claimed} onClick={() => s.claimChallenge(ch.id) && synth.playChime()}>
                      {claimed ? '✔' : 'Claim'}
                    </Button>
                  </div>
                </Panel>
              );
            })}
            <Panel>
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>🎉</span>
                <p className="flex-1 font-display text-lg font-extrabold">All three: 🪙 {ALL_CLEAR_COINS} bonus</p>
                <Button tone={c.claimed.length >= 3 && !c.allClear ? 'gold' : 'ghost'} disabled={c.claimed.length < 3 || c.allClear} onClick={() => s.claimAllClear() && synth.playChime()}>
                  {c.allClear ? '✔' : 'Claim'}
                </Button>
              </div>
            </Panel>
            <h2 className="pt-2 font-display text-2xl font-extrabold text-white text-outline">This week</h2>
            <p className="text-sm font-extrabold text-white/90">Three bigger goals for the week (UTC, Monday to Sunday). Missing one costs nothing.</p>
            {(() => {
              const week = isoWeek(Date.now());
              const w = weeklyProgressFor(s.weekly, week);
              return weeklyFor(week).map((q) => {
                const p = Math.min(q.target, w.progress[q.stat] ?? 0);
                const claimed = w.claimed.includes(q.id);
                return (
                  <Panel key={q.id}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden>{q.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display text-lg font-extrabold leading-tight">{q.label}</p>
                        <Meter value={p / q.target} className="mt-1" tone="bg-sky-400" />
                        <p className="mt-0.5 text-xs font-bold text-white/70">
                          {fmt(p)}/{fmt(q.target)} · 🪙 {q.coins}
                        </p>
                      </div>
                      <Button tone={p >= q.target && !claimed ? 'gold' : 'ghost'} disabled={p < q.target || claimed} onClick={() => s.claimWeekly(q.id) && synth.playChime()}>
                        {claimed ? '✔' : 'Claim'}
                      </Button>
                    </div>
                  </Panel>
                );
              });
            })()}
          </>
        )}
      </div>
    </Screen>
  );
}
