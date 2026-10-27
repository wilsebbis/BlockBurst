import clsx from 'clsx';
import { LockedCard } from './HomeScreen';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Meter, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { synth } from '../engine/WebAudioSynthesizer';
import { mustCosmetic } from '../lib/cosmetics';
import { formatCents } from '../lib/economy';
import { claimKey, GOLD_CENTS, PASS_TIERS, seasonOf, tierFromXp, TIERS, unclaimed, XP_PER_TIER, type PassReward } from '../lib/pass';
import { levelFromXp, unlocked } from '../lib/progression';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

function RewardChip({ r }: { r: PassReward }) {
  if (r.kind === 'coins') return <span className="font-display text-sm font-extrabold">🪙 {r.amount}</span>;
  const c = mustCosmetic(r.id);
  return (
    <span className="flex items-center gap-1 text-[11px] font-extrabold">
      <CosmeticPreview item={c} size={26} />
      <span className="leading-tight">{c.name}</span>
    </span>
  );
}

const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function PassScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const season = seasonOf();
  const xp = s.pass.xp[season.id] ?? 0;
  const tier = tierFromXp(xp);
  const hasGold = s.pass.gold.includes(season.id);
  const waiting = unclaimed(s.pass);
  const older = waiting.filter((u) => u.seasonId !== season.id);

  if (!unlocked('pass', levelFromXp(s.xp).level))
    return (
      <Screen>
        <ScreenHeader title="Blast Pass" onBack={() => go('home')} />
        <div className="px-4">
          <LockedCard feature="pass" />
        </div>
      </Screen>
    );

  return (
    <Screen>
      <ScreenHeader title="Blast Pass" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <h2 className="font-display text-2xl font-extrabold">
            {season.name} · season {season.index + 1}
          </h2>
          <p className="text-xs font-bold text-white/60">
            {fmtDate(season.start)} to {fmtDate(season.end - 1)} (UTC). Every reward is shown below from day one. Nothing expires: tiers you reach stay claimable after the season, forever.
          </p>
          <div className="mt-2 flex items-center justify-between text-sm font-extrabold">
            <span>
              Tier {tier}/{PASS_TIERS}
            </span>
            <span>{tier < PASS_TIERS ? `${xp % XP_PER_TIER}/${XP_PER_TIER} XP` : 'All tiers reached!'}</span>
          </div>
          <Meter value={tier >= PASS_TIERS ? 1 : (xp % XP_PER_TIER) / XP_PER_TIER} tone="bg-violet-400" label="Pass tier progress" />
          <p className="mt-2 text-xs font-bold text-white/70">
            Pass XP is the XP you already earn from games. The Gold Pass ({formatCents(GOLD_CENTS)}, cosmetic only) is in the Store. There are no tier skips.
            {hasGold && ' 🎟️ You have the Gold Pass this season.'}
          </p>
          {!hasGold && (
            <Button tone="ghost" className="mt-2 w-full text-sm" onClick={() => go('store')}>
              See the Gold Pass in the Store
            </Button>
          )}
        </Panel>

        {waiting.length > 1 && (
          <Panel className="!bg-amber-400/25">
            <p className="text-sm font-bold">
              {waiting.length} rewards are waiting{older.length ? `, ${older.length} from earlier seasons` : ''}.
            </p>
            <Button
              tone="gold"
              className="mt-2 w-full"
              onClick={() => {
                for (const u of waiting) s.claimPass(u.seasonId, u.tier, u.track);
                synth.playChime();
              }}
            >
              Claim them all
            </Button>
          </Panel>
        )}

        <Panel className="!p-2">
          <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-1 px-1 pb-1 text-xs font-extrabold text-white/60">
            <span>Tier</span>
            <span>Free</span>
            <span>🎟️ Gold</span>
          </div>
          <ol className="space-y-1">
            {TIERS.map((t) => {
              const reached = t.tier <= tier;
              return (
                <li key={t.tier} className={clsx('reveal grid min-h-[48px] grid-cols-[2.5rem_1fr_1fr] items-center gap-1 rounded-lg px-1 py-1', reached ? 'bg-emerald-400/20' : 'bg-white/5')}>
                  <span className="font-display font-extrabold">{t.tier}</span>
                  {(['free', 'gold'] as const).map((track) => {
                    const claimed = s.pass.claimed.includes(claimKey(season.id, t.tier, track));
                    const reward = track === 'free' ? t.free : t.gold;
                    if (!reward) return <span key={track} className="text-xs text-white/20">·</span>;
                    const can = reached && !claimed && (track === 'free' || hasGold);
                    return (
                      <div key={track} className="flex items-center justify-between gap-1">
                        <RewardChip r={reward} />
                        {claimed ? (
                          <span className="text-xs" aria-label="Claimed">
                            ✔
                          </span>
                        ) : can ? (
                          <button className="min-h-[40px] rounded-lg border-2 border-night-950 bg-amber-400 px-2 text-[11px] font-extrabold text-night-950" onClick={() => s.claimPass(season.id, t.tier, track) && synth.playChime()}>
                            Claim
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </Screen>
  );
}
