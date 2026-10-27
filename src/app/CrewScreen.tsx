import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { LockedCard } from './HomeScreen';
import { NonHumanBadge } from '../components/shared/GuardrailBadge';
import { Button, Meter, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { synth } from '../engine/WebAudioSynthesizer';
import { cosmeticById } from '../lib/cosmetics';
import { crewGiftMultiplier } from '../lib/events';
import { CREW_GIFT_COINS, directory, EMBLEMS, inviteCode, milestoneAt, MILESTONES, PHRASES, poolTotal, reachedMilestones, SHARE, standings, type Crew } from '../lib/crews';
import { levelFromXp, unlocked } from '../lib/progression';
import { utcDateKey } from '../lib/dates';
import { useNow } from '../lib/useNow';
import { crewChat, useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function CrewScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const level = levelFromXp(s.xp).level;
  useEffect(() => {
    useMetaStore.getState().syncWeek();
  }, []);

  return (
    <Screen>
      <ScreenHeader title="Crew" onBack={() => go('home')} />
      <div className="space-y-3 px-4">{!unlocked('crews', level) ? <LockedCard feature="crews" /> : s.crew.crew ? <InCrew crew={s.crew.crew} /> : <FindCrew />}</div>
    </Screen>
  );
}

function InCrew({ crew }: { crew: Crew }) {
  const s = useMetaStore();
  const now = useNow(60_000);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pool = poolTotal(crew, s.crew.myShare, now);
  const reached = reachedMilestones(pool, crew);
  const top = milestoneAt(MILESTONES.length - 1, crew);
  const giftToday = s.crew.giftDay === utcDateKey();
  const code = inviteCode(crew.id);
  const chat = crewChat(s.crew);
  const table = standings(crew, pool, now);
  const avatar = cosmeticById(s.loadout.avatar)?.emoji ?? '🧊';
  const gift = CREW_GIFT_COINS * crewGiftMultiplier(utcDateKey());

  return (
    <>
      <Panel>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-night-950 bg-night-600 text-3xl">{crew.emblem}</span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-tight">{crew.name}</h2>
            <p className="text-sm font-bold text-white/70">{crew.motto || 'We stack together.'}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-white/30 p-2 text-sm font-bold">
          <span className="flex-1">
            Invite code <span className="font-mono text-base">{code}</span>
            <span className="block text-[10px] text-white/60">Invites earn nothing. Share it only if a friend would enjoy it.</span>
          </span>
          <Button
            tone="ghost"
            className="!px-2 !py-1 text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${location.origin}${location.pathname}?crew=${code}`);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </Panel>

      <Panel>
        <h3 className="font-display text-xl font-extrabold">🧺 This week's pool</h3>
        <p className="text-sm font-bold text-white/70">{Math.round(SHARE * 100)}% of every member's XP is copied into the pool. Nobody loses any XP, and every milestone pays everyone the same.</p>
        <div className="relative mt-3">
          <Meter value={pool / top} tone="bg-emerald-400" className="h-5" />
          {MILESTONES.map((m, i) => (
            <span key={m.label} className="absolute top-0 h-5 w-0.5 bg-night-950" style={{ left: `${(milestoneAt(i, crew) / top) * 100}%` }} />
          ))}
        </div>
        <p className="mt-1 text-right text-sm font-extrabold">{pool} XP</p>
        <ul className="mt-2 space-y-2">
          {MILESTONES.map((m, i) => {
            const got = reached.includes(i);
            const claimed = s.crew.claimed.includes(i);
            return (
              <li key={m.label} className="flex items-center gap-2 text-sm font-bold">
                <span className="w-16 text-white/70">{milestoneAt(i, crew)} XP</span>
                <span className="flex-1">{m.label}</span>
                <Button
                  tone={got && !claimed ? 'gold' : 'ghost'}
                  className="!px-2 !py-1 text-xs"
                  disabled={!got || claimed}
                  onClick={() => {
                    if (s.claimMilestone(i)) synth.playChime();
                  }}
                >
                  {claimed ? '✔ Claimed' : got ? 'Claim' : 'Not yet'}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs font-bold text-white/60">Targets grow with the crew's size, so a small crew isn't disadvantaged. Anything reached but not claimed is paid out automatically when the week turns over.</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-xl font-extrabold">🎁 Share a gift</h3>
        <p className="text-sm font-bold text-white/70">Once a day, tap to have the game send everyone in the crew 🪙 {gift}, you included. Nobody owes anything back, and nobody is shown as not having shared.</p>
        <Button tone="gold" className="mt-2 w-full" disabled={giftToday} onClick={() => s.shareCrewGift() && synth.playChime()}>
          {giftToday ? 'Shared today 💛' : `Share 🪙 ${gift} with everyone`}
        </Button>
      </Panel>

      <Panel>
        <h3 className="font-display text-xl font-extrabold">👥 Members ({crew.members.length + 1}/10)</h3>
        <p className="text-xs font-bold text-white/60">No contribution rankings, no minimums and no kicking. Everyone here is welcome however much they play.</p>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-sm font-bold">
          <li className="rounded-lg bg-amber-400/25 px-2 py-1">{avatar} {s.name === 'You' ? 'You' : `${s.name} (you)`}</li>
          {crew.members.map((m) => (
            <li key={m.name} className="rounded-lg bg-white/5 px-2 py-1">
              {m.emblem} {m.name}
              {m.bot && <NonHumanBadge />}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <h3 className="font-display text-xl font-extrabold">💬 Quick chat</h3>
        <p className="text-xs font-bold text-white/60">Friendly phrases only, so there's nothing to moderate and nothing unkind to say.</p>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {chat.length === 0 && <li className="text-sm font-bold text-white/60">Quiet so far today.</li>}
          {chat.map((c) => (
            <li key={c.id} className={clsx('rounded-xl px-3 py-1.5 text-sm font-bold', c.bot ? 'bg-white/5' : 'ml-8 bg-emerald-400/20')}>
              <span className="text-white/70">
                {c.from}
                {c.bot && <NonHumanBadge />}:
              </span>{' '}
              {PHRASES[c.phrase]}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1">
          {PHRASES.map((p, i) => (
            <button key={p} className="min-h-[40px] rounded-full border-2 border-night-950 bg-night-900 px-3 py-1 text-xs font-bold hover:bg-amber-400/30" onClick={() => s.postPhrase(i)}>
              {p}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <h3 className="font-display text-xl font-extrabold">🏆 Crew standings</h3>
        <p className="text-xs font-bold text-white/60">Whole crews only, by this week's pool. The other crews are practice crews.</p>
        <ol className="mt-2 space-y-1">
          {table.map((r, i) => (
            <li key={r.name} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold', r.mine && 'bg-amber-400/25')}>
              <span className="w-6 text-white/60">{i + 1}</span>
              <span className="flex-1">
                {r.emblem} {r.name}
                {!r.mine && <NonHumanBadge />}
              </span>
              <span>{r.pool}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg font-extrabold">Play solo</h3>
        <p className="text-sm font-bold text-white/70">Leave whenever you like. You keep everything you've earned, nobody is told, and you can rejoin with one tap.</p>
        {confirmLeave ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button tone="ghost" onClick={() => setConfirmLeave(false)}>
              Stay
            </Button>
            <Button tone="dark" onClick={() => s.leaveCrew()}>
              Play solo
            </Button>
          </div>
        ) : (
          <Button tone="ghost" className="mt-2 w-full" onClick={() => setConfirmLeave(true)}>
            Leave crew
          </Button>
        )}
      </Panel>
    </>
  );
}

function FindCrew() {
  const s = useMetaStore();
  const now = useNow(60_000);
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [emblem, setEmblem] = useState(EMBLEMS[0]);
  const [code, setCode] = useState('');
  const list = directory();
  return (
    <>
      <Panel>
        <h2 className="font-display text-2xl font-extrabold">Play together</h2>
        <p className="text-sm font-bold text-white/70">A crew is up to 10 players sharing a weekly goal. 20% of your XP is copied into the pool (you keep all of it), and milestones reward everyone. No rankings inside, no minimums, no kicking.</p>
      </Panel>

      {s.crew.past.length > 0 && (
        <Panel>
          <h3 className="font-display text-lg font-extrabold">Rejoin</h3>
          {s.crew.past.map((c) => (
            <Button key={c.id} tone="ghost" className="mt-2 w-full justify-start" onClick={() => s.joinCrew(c)}>
              {c.emblem} {c.name}
            </Button>
          ))}
        </Panel>
      )}

      <Panel>
        <h3 className="font-display text-lg font-extrabold">Start a crew</h3>
        <label className="mt-2 block text-sm font-bold">
          Name
          <input value={name} maxLength={22} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-night-950 bg-night-950 px-3 py-2 text-white" placeholder="The Line Breakers" />
        </label>
        <label className="mt-2 block text-sm font-bold">
          Motto
          <input value={motto} maxLength={60} onChange={(e) => setMotto(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-night-950 bg-night-950 px-3 py-2 text-white" placeholder="Leave room for the big one." />
        </label>
        <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Emblem">
          {EMBLEMS.map((e) => (
            <button key={e} role="radio" aria-checked={emblem === e} onClick={() => setEmblem(e)} className={clsx('grid h-11 w-11 place-items-center rounded-lg border-2 text-xl', emblem === e ? 'border-night-950 bg-amber-400/40' : 'border-transparent')}>
              {e}
            </button>
          ))}
        </div>
        <Button tone="go" className="mt-3 w-full" onClick={() => s.createCrew(name, emblem, motto)}>
          Create crew
        </Button>
        <p className="mt-1 text-xs font-bold text-white/60">Offline, four labelled practice helpers keep you company until friends join with your code.</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg font-extrabold">Join with a code</h3>
        <div className="mt-2 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className="flex-1 rounded-xl border-2 border-night-950 bg-night-950 px-3 py-2 text-white font-mono" placeholder="ABC123" aria-label="Invite code" />
          <Button tone="cool" disabled={code.trim().length < 4} onClick={() => s.joinByCode(code)}>
            Join
          </Button>
        </div>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg font-extrabold">Practice crews</h3>
        <ul className="mt-2 space-y-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border-2 border-night-950 p-2">
              <span className="text-2xl">{c.emblem}</span>
              <div className="flex-1">
                <p className="font-display font-extrabold leading-tight">
                  {c.name} <NonHumanBadge />
                </p>
                <p className="text-xs font-bold text-white/70">
                  {c.members.length} members · {poolTotal(c, 0, now)} XP this week · {c.motto}
                </p>
              </div>
              <Button tone="go" className="!px-3 !py-1 text-sm" onClick={() => s.joinCrew(c)}>
                Join
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
