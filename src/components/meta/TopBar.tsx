import { cosmeticById } from '../../lib/cosmetics';
import { levelFromXp } from '../../lib/progression';
import { useMetaStore } from '../../stores/useMetaStore';
import { useNav } from '../../stores/useNav';
import { Meter, Pill } from '../shared/ui';
import { TickingNumber } from '../shared/TickingNumber';

export function TopBar() {
  const xp = useMetaStore((s) => s.xp);
  const coins = useMetaStore((s) => s.coins);
  const avatar = useMetaStore((s) => s.loadout.avatar);
  const go = useNav((s) => s.go);
  const lv = levelFromXp(xp);
  return (
    <div className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <button onClick={() => go('profile')} className="flex min-h-tap flex-1 items-center gap-2 text-left" aria-label={`Profile. Level ${lv.level}.`}>
        <span className="relative grid h-11 w-11 place-items-center rounded-xl border-[3px] border-night-950 bg-night-600 text-2xl shadow-chunky-sm">
          {cosmeticById(avatar)?.emoji ?? '🧊'}
          <span className="absolute -bottom-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-night-950 bg-amber-400 px-1 font-display text-xs font-extrabold text-night-950">{lv.level}</span>
        </span>
        <span className="flex-1">
          <span className="block font-display text-xs font-extrabold text-white/80">Level {lv.level}</span>
          <Meter value={lv.into / lv.need} className="max-w-[9rem]" tone="bg-amber-400" label="Level progress" />
        </span>
      </button>
      <Pill title="Coins: earned by playing, never sold.">
        🪙 <TickingNumber value={coins} />
      </Pill>
      <button onClick={() => go('settings')} className="grid h-12 w-12 place-items-center rounded-xl border-[3px] border-night-950 bg-white/10 text-lg shadow-chunky-sm" aria-label="Settings">
        ⚙️
      </button>
    </div>
  );
}
