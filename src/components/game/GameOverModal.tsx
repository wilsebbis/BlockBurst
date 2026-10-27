/**
 * The end-of-game screen. It celebrates and summarises, and it sells nothing: no continues, no ads, no offers.
 * "Play again" is free and immediate. Rewards are staged (ticking numbers) rather than dumped all at once.
 */
import { useState } from 'react';
import { levelFor, worldOf } from '../../engine/levels';
import { CHALLENGE_LABEL } from './challengeLabel';
import { cosmeticById } from '../../lib/cosmetics';
import { LEAGUES } from '../../lib/leagues';
import { rankOf } from '../../lib/ranks';
import { downloadCard, drawBragCard, fmt, shareOrCopy, shareText } from '../../lib/share';
import { TROPHIES } from '../../lib/achievements';
import { suggestBreak } from '../../lib/wellbeing';
import { useMetaStore, type RunOutcome } from '../../stores/useMetaStore';
import type { GameState } from '../../types/game';
import type { RunMode } from '../../lib/progression';
import { TickingNumber } from '../shared/TickingNumber';
import { Button, Pill } from '../shared/ui';
import { ModalShell } from './ModalShell';

interface Props {
  state: GameState;
  mode: RunMode;
  day: string | null;
  level?: number;
  hinted: boolean;
  outcome: RunOutcome | null;
  sessionMs: number;
  onAgain(): void;
  onNext(): void;
  onHome(): void;
}

export function GameOverModal({ state: g, mode, day, level, hinted, outcome: o, sessionMs, onAgain, onNext, onHome }: Props) {
  const s = useMetaStore();
  const [shared, setShared] = useState<string | null>(null);
  const [breakShown] = useState(() => suggestBreak(sessionMs, s.settings.breakMinutes, false));
  const adventure = mode === 'adventure';
  const won = adventure && g.won;
  const title = adventure ? (won ? 'Level clear!' : 'Out of room') : o?.newBest ? 'New best!' : 'No more room';
  const daily = (mode === 'daily' || mode === 'archive') && day;
  const skin = cosmeticById(s.loadout.skin);

  async function share() {
    const info = { day: day!, score: g.score, lines: g.lines, maxCombo: g.maxCombo, bestMulti: g.bestMulti, perfects: g.perfects, daysPlayed: s.streak.totalDays, best: Math.max(g.score, s.daily[day!]?.score ?? 0), assisted: hinted };
    const card = drawBragCard(info, skin?.palette ?? [], cosmeticById(s.loadout.avatar)?.emoji ?? '🧊');
    const r = await shareOrCopy(shareText(info), card);
    setShared(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
    if (r === 'failed') downloadCard(card, `block-burst-${day}.png`);
  }

  const stats = (
    <>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        <Pill>➖ {g.lines} lines</Pill>
        <Pill>🔥 x{g.maxCombo} combo</Pill>
        <Pill>✖️ {g.bestMulti} at once</Pill>
        {g.perfects > 0 && <Pill>✨ {g.perfects} perfect</Pill>}
        {adventure && g.goal?.kind === 'gems' && (
          <Pill>
            💎 {g.gemsCollected}/{g.goal.count}
          </Pill>
        )}
        {adventure && level && won && <Pill>🧩 {g.placed} moves (par {levelFor(level).par})</Pill>}
        {hinted && <Pill title="This game used the Hint assist.">💡 hints used</Pill>}
      </div>

    </>
  );
  const rewards = (
    <>
      {!o ? (
        <div className="skeleton mt-4 h-24 rounded-xl" aria-label="Adding up rewards" />
      ) : (
        <ul className="mt-4 space-y-1 rounded-xl bg-night-950/50 p-3 text-sm font-bold">
          <li>
            ⭐ +<TickingNumber value={o.xp} /> XP{o.levelAfter > o.levelBefore && <span className="text-amber-300"> · Level {o.levelAfter}!</span>}
          </li>
          <li>
            🪙 +<TickingNumber value={o.coinsEarned + (o.adventure?.coins ?? 0)} /> coins{o.coinMultiplier > 1 && <span className="text-amber-300"> (Weekend Coin Fest x2)</span>}
          </li>
          {o.rescued > 0 && <li>🌷 {o.rescued} blobs rescued to the Sanctuary</li>}
          {o.rank &&
            (o.rank.counted ? (
              <li>
                {rankOf(o.rank.after).emoji} {o.rank.delta >= 0 ? '+' : ''}
                {o.rank.delta} RP · {rankOf(o.rank.after).label}
                {rankOf(o.rank.after).step > rankOf(o.rank.before).step && <span className="text-amber-300"> · Ranked up!</span>}
              </li>
            ) : (
              <li className="text-white/60">💡 Games with hints don't count for ranks.</li>
            ))}
          {o.leagueRankAfter !== o.leagueRankBefore && (
            <li>
              {LEAGUES[s.league.tier].emoji} League: #{o.leagueRankBefore} → #{o.leagueRankAfter}
            </li>
          )}
          {o.passTierAfter > o.passTierBefore && <li>🎟️ Blast Pass tier {o.passTierAfter} reached</li>}
          {o.crewShare > 0 && <li>🚩 +{o.crewShare} to your crew's pool (copied, not taken)</li>}
          {o.challengesDone.map((id) => (
            <li key={id}>✅ Challenge done: {CHALLENGE_LABEL(id)}</li>
          ))}
          {o.trophies.map((id) => {
            const t = TROPHIES.find((x) => x.id === id)!;
            return (
              <li key={id}>
                {t.emoji} Trophy: {t.name}
              </li>
            );
          })}
          {o.eventRewards.map((id) => (
            <li key={id}>🎁 Event reward: {cosmeticById(id)?.name}</li>
          ))}
          {o.newBest && o.prevBest > 0 && <li>🏁 Beat your best of {fmt(o.prevBest)}</li>}
        </ul>
      )}

    </>
  );
  const extras = (
    <>
      {breakShown && <p className="mt-3 rounded-xl bg-sky-900/70 p-3 text-sm font-bold">🌿 You've been playing a while. This is a good moment for a stretch. Your progress is saved.</p>}

      {daily && (
        <div className="mt-3">
          <Button tone="cool" className="w-full" onClick={share}>
            📤 Share result (no spoilers)
          </Button>
          {shared && <p className="mt-1 text-center text-xs font-bold text-white/70">{shared}</p>}
        </div>
      )}

    </>
  );
  const actions = (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button tone="ghost" onClick={onHome}>
          🏠 Home
        </Button>
        {won ? (
          <Button tone="go" onClick={onNext} autoFocus>
            Next level ▶
          </Button>
        ) : (
          <Button tone="gold" onClick={onAgain} autoFocus>
            ↺ Play again
          </Button>
        )}
      </div>
    </>
  );

  return (
    <ModalShell label={title}>
      <h2 className="text-center font-display text-4xl font-extrabold text-outline">{won ? '🎉 ' : ''}{title}</h2>
      {adventure && level && (
        <p className="text-center font-bold text-white/70">
          {worldOf(level).emoji} Level {level} · {worldOf(level).name}
        </p>
      )}
      {won && o?.adventure && (
        <p className="mt-1 text-center text-4xl" aria-label={`${o.adventure.stars} of 3 stars`}>
          {[1, 2, 3].map((k) => (
            <span key={k} className={k <= o.adventure!.stars ? '' : 'opacity-25 grayscale'}>
              ⭐
            </span>
          ))}
        </p>
      )}
      <p className="mt-1 text-center font-display text-6xl font-extrabold text-amber-300">
        <TickingNumber value={g.score} />
      </p>
      {stats}
      {rewards}
      {extras}
      {actions}
    </ModalShell>
  );
}
