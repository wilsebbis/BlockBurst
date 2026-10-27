/**
 * Home: one obvious primary action (PLAY), real claimables inline instead of a pop-up stack, and features that
 * appear as the unlock ladder reaches them, with locked ones visible alongside their level.
 */
import clsx from 'clsx';
import { useState } from 'react';
import { NotifyAskCard } from '../components/meta/NotifyAskCard';
import { StreakHUD } from '../components/meta/StreakHUD';
import { TopBar } from '../components/meta/TopBar';
import { Button, Meter, Panel, Screen } from '../components/shared/ui';
import { worldOf } from '../engine/levels';
import { synth } from '../engine/WebAudioSynthesizer';
import { challengesFor, progressFor } from '../lib/challenges';
import { utcDateKey } from '../lib/dates';
import { eventsOn } from '../lib/events';
import { BOX_CAP, boxCoins, boxFill, CALENDAR, canOpenCalendar, WELCOME_BACK_COINS } from '../lib/gifts';
import { FEATURE_NAMES, levelFromXp, STORE_BUTTON_LEVEL, unlocked, UNLOCKS, type Feature } from '../lib/progression';
import { rankOf } from '../lib/ranks';
import { classicRequest, dailyRequest } from '../lib/requests';
import { clearGame, loadGame } from '../lib/resume';
import { fmt } from '../lib/share';
import { useClaimables } from '../lib/useClaimables';
import { useNow } from '../lib/useNow';
import { onVacationToday, useMetaStore } from '../stores/useMetaStore';
import { useNav, type Screen as ScreenId } from '../stores/useNav';

const PLACES: { feature?: Feature; screen: ScreenId; emoji: string; label: string }[] = [
  { feature: 'pass', screen: 'pass', emoji: '🎟️', label: 'Blast Pass' },
  { feature: 'events', screen: 'events', emoji: '🗓️', label: 'Events' },
  { screen: 'sanctuary', emoji: '🌷', label: 'Sanctuary' },
  { screen: 'collection', emoji: '🎨', label: 'Collection' },
  { feature: 'challenges', screen: 'challenges', emoji: '✅', label: 'Challenges' },
];

const LOGO = ['#ef4444', '#facc15', '#3b82f6', '#22c55e'];

export function HomeScreen() {
  const s = useMetaStore();
  const start = useNav((x) => x.start);
  const go = useNav((x) => x.go);
  const now = useNow(15_000);
  const claim = useClaimables();
  const [saved, setSaved] = useState(loadGame);
  const today = utcDateKey(new Date(now));
  const level = levelFromXp(s.xp).level;
  const todays = s.daily[today];
  const box = boxCoins(s.boxLast, now);
  const challenges = challengesFor(today);
  const cp = progressFor(s.challenges, today);
  const events = eventsOn(today);
  const vacation = onVacationToday(s.vacations, today);
  const nextUnlock = (Object.entries(UNLOCKS) as [Feature, number][]).filter(([, l]) => l > level).sort((a, b) => a[1] - b[1])[0];
  const adv = s.adventure.unlocked;
  const rank = rankOf(s.rank.rp);

  return (
    <Screen>
      <TopBar />
      <div className="px-4">
        <div className="mt-5 flex items-center justify-center gap-3" aria-hidden>
          <span className="grid grid-cols-2 gap-1">
            {LOGO.map((c) => (
              <span key={c} className="h-5 w-5 rounded-[5px] border-2 border-night-950" style={{ background: c, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.25)' }} />
            ))}
          </span>
          <h1 className="font-display text-5xl font-extrabold leading-none text-white text-outline">Block Burst</h1>
        </div>
        <p className="mt-1 text-center font-display text-sm font-extrabold text-white/70">
          👑 Best {fmt(s.best)}
          {unlocked('ranks', level) && ` · ${rank.emoji} ${rank.label}`}
        </p>

        {saved && (
          <Panel className="mt-3 !bg-sky-900/80 !p-3">
            <p className="text-sm font-bold">
              You have an unfinished {saved.req.mode === 'adventure' ? `Adventure level ${saved.req.cfg.level}` : saved.req.mode === 'classic' ? 'Classic game' : `Daily Board (${saved.req.day})`} with {saved.log.length} moves.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                tone="ghost"
                onClick={() => {
                  clearGame();
                  setSaved(null);
                }}
              >
                Discard
              </Button>
              <Button tone="cool" onClick={() => start(saved.req, 'home')}>
                ▶ Continue
              </Button>
            </div>
          </Panel>
        )}

        <Button tone="gold" className="bob mt-4 w-full py-4 text-3xl shadow-glow" onClick={() => start(classicRequest(), 'home')}>
          ▶ PLAY
        </Button>
        <Button tone="cool" className="mt-3 w-full py-3 text-xl" onClick={() => go('adventure')}>
          {worldOf(adv).emoji} Adventure · Level {adv}
        </Button>

        {vacation && (
          <Panel className="mt-3 !bg-sky-900/80 !p-3">
            <p className="text-sm font-bold">🏖️ Vacation mode is on. Your streak is paused and reminders and badges are off. Play whenever you like.</p>
          </Panel>
        )}

        {s.welcomeBack && (
          <Panel className="mt-3 !bg-amber-400/25">
            <h2 className="font-display text-lg font-extrabold">🎁 Welcome back!</h2>
            <p className="text-sm font-bold text-white/80">Everything is just as you left it. Here's a little something.</p>
            <Button tone="gold" className="mt-2 w-full" onClick={() => s.claimWelcomeBack() && synth.playChime()}>
              Open 🪙 {WELCOME_BACK_COINS}
            </Button>
          </Panel>
        )}

        {s.notices.map((n) => (
          <Panel key={n.id} className="mt-3 flex items-center gap-2 !p-3">
            <p className="flex-1 text-sm font-bold">{n.text}</p>
            <Button tone="ghost" className="!px-3 text-sm" onClick={() => s.dismissNotice(n.id)} aria-label="Dismiss">
              ✕
            </Button>
          </Panel>
        ))}

        <NotifyAskCard />

        {unlocked('events', level) && events.length > 0 && (
          <button onClick={() => go('events')} className="mt-3 min-h-tap w-full rounded-blob border-[3px] border-night-950 bg-violet-500/40 px-3 py-2 text-left text-sm font-extrabold shadow-chunky-sm">
            {events.map((e) => `${e.emoji} ${e.name}`).join(' · ')} on now (see the calendar)
          </button>
        )}

        {unlocked('daily', level) ? (
          <Panel className="mt-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">📅 Daily Board</h2>
              <span className="text-xs font-bold text-white/60">{today} (UTC)</span>
            </div>
            <p className="text-sm font-bold text-white/70">The same starting board for everyone today. {todays ? `Your best: ${fmt(todays.score)}.` : 'Not played yet.'}</p>
            <div className="mt-2">
              <StreakHUD />
            </div>
            <Button tone="cool" className="mt-3 w-full" onClick={() => start(dailyRequest(today), 'home')}>
              {todays ? 'Beat your best' : "Play today's board"}
            </Button>
          </Panel>
        ) : (
          <LockedCard feature="daily" />
        )}

        {unlocked('gifts', level) ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Panel className="!p-3">
              <h2 className="font-display font-extrabold">🎁 Gift box</h2>
              <p className="text-xs font-bold text-white/70">Fills while you're away, then waits.</p>
              <Meter value={boxFill(s.boxLast, now)} className="mt-2" tone="bg-amber-400" label="Gift box" />
              <Button tone="gold" className="mt-2 w-full text-sm" disabled={box <= 0} onClick={() => s.collectBox() > 0 && synth.playChime()}>
                {box > 0 ? `Collect 🪙 ${box}` : 'Filling…'}
              </Button>
              <p className="mt-1 text-[11px] font-bold text-white/60">Holds up to 🪙 {BOX_CAP}</p>
            </Panel>
            <Panel className="!p-3">
              <h2 className="font-display font-extrabold">🗓️ Gift calendar</h2>
              <p className="text-xs font-bold text-white/70">One step for each day you play. Gaps never reset it.</p>
              <div className="mt-2 flex gap-0.5">
                {CALENDAR.map((c, i) => (
                  <span key={i} className={clsx('h-3 flex-1 rounded-sm border border-night-950', i < s.calendar.step ? 'bg-emerald-400' : 'bg-white/10')} title={`🪙 ${c}`} />
                ))}
              </div>
              <Button tone="go" className="mt-2 w-full text-sm" disabled={!canOpenCalendar(s.calendar, today)} onClick={() => s.openCalendar() && synth.playChime()}>
                {canOpenCalendar(s.calendar, today) ? `Open 🪙 ${CALENDAR[s.calendar.step]}` : 'Opened today'}
              </Button>
            </Panel>
          </div>
        ) : (
          <LockedCard feature="gifts" />
        )}

        {unlocked('challenges', level) && (
          <Panel className="mt-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">✅ Challenges</h2>
              <Button tone={claim.challenges + claim.weekly > 0 ? 'gold' : 'ghost'} className="!px-3 text-sm" onClick={() => go('challenges')}>
                {claim.challenges + claim.weekly > 0 ? 'Claim' : 'All'}
              </Button>
            </div>
            <ul className="mt-1 space-y-1">
              {challenges.map((c) => {
                const p = Math.min(c.target, cp.progress[c.stat] ?? 0);
                return (
                  <li key={c.id} className="flex items-center gap-2 text-sm font-bold">
                    <span aria-hidden>{c.emoji}</span>
                    <span className="flex-1">{c.label}</span>
                    <span className="text-white/70">{cp.claimed.includes(c.id) ? '✔' : `${fmt(p)}/${fmt(c.target)}`}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {PLACES.map((p) => {
            const open = !p.feature || unlocked(p.feature, level);
            const dot = p.screen === 'pass' && claim.pass > 0;
            return (
              <button key={p.screen} onClick={() => go(p.screen)} className={clsx('relative min-h-tap rounded-blob border-[3px] border-night-950 bg-night-800 p-3 text-left shadow-chunky-sm', !open && 'opacity-60')}>
                <span className={clsx('text-3xl', !open && 'grayscale')} aria-hidden>
                  {p.emoji}
                </span>
                <span className="block font-display font-extrabold">{p.label}</span>
                <span className="block text-xs font-bold text-white/60">{open ? 'Open' : `🔒 Level ${UNLOCKS[p.feature!]}`}</span>
                {dot && <span className="absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-night-900 bg-rose-500" aria-label="Rewards waiting" />}
              </button>
            );
          })}
        </div>

        {nextUnlock && (
          <p className="mt-3 text-center text-sm font-extrabold text-white/80">
            Next up: {FEATURE_NAMES[nextUnlock[0]]} at level {nextUnlock[1]}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button tone="ghost" onClick={() => go('profile')}>
            📊 Profile
          </Button>
          {level >= STORE_BUTTON_LEVEL ? (
            <Button tone="ghost" onClick={() => go('store')}>
              💳 Store
            </Button>
          ) : (
            <Button tone="ghost" onClick={() => go('settings')}>
              ⚙️ Settings
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}

export function LockedCard({ feature }: { feature: Feature }) {
  return (
    <Panel className="mt-3 opacity-80">
      <h2 className="font-display text-lg font-extrabold text-white/80">
        🔒 {FEATURE_NAMES[feature]} · level {UNLOCKS[feature]}
      </h2>
      <p className="text-sm font-bold text-white/60">Every game earns XP. This opens the moment you reach level {UNLOCKS[feature]}.</p>
    </Panel>
  );
}
