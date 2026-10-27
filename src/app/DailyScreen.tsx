import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { LockedCard } from './HomeScreen';
import { StreakHUD } from '../components/meta/StreakHUD';
import { NonHumanBadge } from '../components/shared/GuardrailBadge';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { SIZE } from '../engine/board';
import { dailyLayout } from '../engine/rules';
import { decodeLog, replay } from '../engine/RunLog';
import { dailyBots, dailySeed, type BoardEntry } from '../lib/bots';
import { cloudEnabled, fetchDailyBoard } from '../lib/cloud';
import { cosmeticById, mustCosmetic } from '../lib/cosmetics';
import { crewDailyBoard } from '../lib/crews';
import { addDays, utcDateKey } from '../lib/dates';
import { dailyTheme } from '../lib/events';
import { levelFromXp, unlocked } from '../lib/progression';
import { dailyRequest } from '../lib/requests';
import { downloadCard, drawBragCard, fmt, shareOrCopy, shareText } from '../lib/share';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function DailyScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const start = useNav((x) => x.start);
  const today = utcDateKey();
  const level = levelFromXp(s.xp).level;
  const mine = s.daily[today];
  const [cloud, setCloud] = useState<BoardEntry[]>([]);
  const [shared, setShared] = useState<string | null>(null);

  const layout = useMemo(() => dailyLayout(dailySeed(today)), [today]);
  const bots = useMemo(() => dailyBots(today), [today]);
  // Re-check your stored best by replaying its move log with the real rules, as a server would.
  const verified = useMemo(() => {
    if (!mine) return null;
    const r = replay({ mode: 'daily', seed: dailySeed(today) }, decodeLog(mine.log));
    return !r.error && r.state.score === mine.score;
  }, [mine, today]);

  useEffect(() => {
    if (!cloudEnabled) return;
    void fetchDailyBoard(today).then((rows) => setCloud(rows.map((r) => ({ name: r.display_name, score: r.score, kind: 'player' as const }))));
  }, [today]);

  if (!unlocked('daily', level))
    return (
      <Screen>
        <ScreenHeader title="Daily Board" onBack={() => go('home')} />
        <div className="px-4">
          <LockedCard feature="daily" />
        </div>
      </Screen>
    );

  const board: BoardEntry[] = [...cloud, ...bots, ...(mine ? [{ name: s.name, score: mine.score, kind: 'you' as const }] : [])].sort((a, b) => b.score - a.score);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const info = mine ? { day: today, score: mine.score, lines: mine.lines, maxCombo: mine.maxCombo, bestMulti: mine.bestMulti, perfects: mine.perfects, daysPlayed: s.streak.totalDays, best: mine.score, assisted: mine.hinted } : null;
  const skin = mustCosmetic(s.loadout.skin);
  const theme = cosmeticById(dailyTheme(today) ?? s.loadout.theme)!.board!;

  return (
    <Screen>
      <ScreenHeader title="Daily Board" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <div className="flex gap-3">
            <div className="grid shrink-0 grid-cols-8 gap-px rounded-lg p-1" style={{ background: theme.bg }} aria-label="Today's starting board">
              {layout.map((v, i) => (
                <span key={i} className="h-3 w-3 rounded-[2px]" style={{ background: v ? skin.palette![(v - 1) % 7] : theme.cell }} />
              ))}
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold">{today} (UTC)</h2>
              <p className="text-sm font-bold text-white/70">One starting board for the whole world, from a public seed. Play it as often as you like; your best score counts.</p>
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-emerald-300">
            ✅ Burst Bot <NonHumanBadge /> played today's board with the real rules and scored {fmt(bots[0].score)}. The tray generator only ever reads the board, never you.
          </p>
          {verified !== null && <p className="mt-1 text-xs font-bold text-emerald-300">{verified ? '🔐 Your best replays move for move to the same score (hash-chained log).' : '⚠️ Your stored best did not replay cleanly.'}</p>}
          <div className="mt-2">
            <StreakHUD />
          </div>
          <Button tone="cool" className="mt-3 w-full py-3 text-xl" onClick={() => start(dailyRequest(today), 'daily')}>
            {mine ? `Beat ${fmt(mine.score)}` : "Play today's board"}
          </Button>
          {info && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button tone="ghost" onClick={async () => setShared(await shareOrCopy(shareText(info)))}>
                📤 Share result
              </Button>
              <Button tone="ghost" onClick={() => downloadCard(drawBragCard(info, skin.palette!, cosmeticById(s.loadout.avatar)?.emoji ?? '🧊'), `block-burst-${today}.png`)}>
                🖼️ Brag card
              </Button>
            </div>
          )}
          {shared && <p className="mt-1 text-center text-xs font-bold text-white/70">{shared === 'copied' ? 'Copied to the clipboard.' : shared === 'shared' ? 'Shared!' : 'Sharing is not available here.'}</p>}
        </Panel>

        <Panel>
          <h2 className="font-display text-xl font-extrabold">🏁 Today's scores</h2>
          {!cloudEnabled && <p className="text-xs font-bold text-white/60">Offline: practice players stand in for the world board. Connect the backend for verified scores from real players.</p>}
          <ol className="mt-2 space-y-1">
            {board.map((e, i) => (
              <li key={`${e.kind}-${e.name}-${i}`} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold', e.kind === 'you' && 'bg-amber-400/25')}>
                <span className="w-6 text-white/60">{i + 1}</span>
                <span className="flex-1">
                  {e.name}
                  {e.kind === 'bot' && <NonHumanBadge />}
                </span>
                <span>{fmt(e.score)}</span>
              </li>
            ))}
          </ol>
        </Panel>

        {s.crew.crew && (
          <Panel>
            <h2 className="font-display text-xl font-extrabold">
              {s.crew.crew.emblem} {s.crew.crew.name} today
            </h2>
            <p className="text-xs font-bold text-white/60">Your crew's Daily Board scores. Only those who played are listed; nobody is shown as missing.</p>
            <ol className="mt-2 space-y-1">
              {[...crewDailyBoard(s.crew.crew, today), ...(mine ? [{ name: s.name, score: mine.score, bot: false }] : [])]
                .sort((a, b) => b.score - a.score)
                .map((e, i) => (
                  <li key={`${e.name}-${i}`} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold', !e.bot && 'bg-amber-400/25')}>
                    <span className="w-6 text-white/60">{i + 1}</span>
                    <span className="flex-1">
                      {e.name}
                      {e.bot && <NonHumanBadge />}
                    </span>
                    <span>{fmt(e.score)}</span>
                  </li>
                ))}
            </ol>
          </Panel>
        )}

        <Panel>
          <h2 className="font-display text-xl font-extrabold">🗓️ Last 4 weeks</h2>
          <p className="text-xs font-bold text-white/60">Tap a past day to practise its board. Archive games don't change your streak.</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const r = s.daily[d];
              const rested = s.streak.restedOn.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => start(dailyRequest(d), 'daily')}
                  className={clsx('aspect-square min-h-[44px] rounded-lg border-2 border-night-950 text-[10px] font-extrabold leading-tight', r ? 'bg-emerald-500 text-night-950' : rested ? 'bg-sky-900' : 'bg-white/10', d === today && 'ring-2 ring-amber-400')}
                  title={r ? `${d}: ${r.score}` : rested ? `${d}: rest day` : d}
                  aria-label={r ? `${d}: best ${r.score}` : rested ? `${d}: rest day` : `${d}: not played`}
                >
                  <span className="block opacity-80">{d.slice(8)}</span>
                  <span className="block">{r ? (r.score >= 1000 ? `${Math.round(r.score / 1000)}k` : r.score) : rested ? '🛌' : ''}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        <p className="text-center text-[11px] font-bold text-white/60">Board size {SIZE}×{SIZE}. Seed: burst/daily/v1/{today}</p>
      </div>
    </Screen>
  );
}
