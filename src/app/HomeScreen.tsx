/**
 * Home: the next Adventure level front and centre, then the Sanctuary and the Penguin Exhibit. Levels play in
 * order; clearing one opens the next.
 */
import { useState } from 'react';
import { Button, Panel, Pill, Screen } from '../components/shared/ui';
import { HomeLogo } from '../components/meta/HomeLogo';
import { TickingNumber } from '../components/shared/TickingNumber';
import { worldOf } from '../engine/levels';
import { PENGUIN_IDLE_IMAGE_PATH } from '../exhibit/tuning';
import { adventureRequest } from '../lib/requests';
import { clearGame, loadGame, type Saved } from '../lib/resume';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function HomeScreen() {
  const coins = useMetaStore((s) => s.coins);
  const nextLevel = useMetaStore((s) => s.adventure.unlocked);
  const reducedMotion = useMetaStore((s) => s.settings.reducedMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = useNav((x) => x.start);
  const go = useNav((x) => x.go);
  const world = worldOf(nextLevel);

  return (
    <Screen>
      <div className="flex items-center justify-end gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Pill title="Coins: earned by clearing levels and thanked for by the blobs.">
          🪙 <TickingNumber value={coins} />
        </Pill>
        <Button tone="ghost" className="w-12 !px-0 text-lg" onClick={() => go('settings')} aria-label="Settings">
          ⚙️
        </Button>
      </div>
      <div className="px-4">
        <h1 className="mt-4">
          <HomeLogo still={reducedMotion} />
        </h1>

        <p className="mt-6 text-center font-display text-sm font-extrabold uppercase tracking-wide text-white/70">
          {world.emoji} {world.name}
        </p>
        <h2 className="text-center font-display text-6xl font-extrabold leading-tight text-white">Level {nextLevel}</h2>

        <ContinueCard />

        <div className="mt-5 flex flex-col gap-3">
          <Button tone="gold" className="bob w-full py-4 text-3xl shadow-glow" onClick={() => start(adventureRequest(nextLevel))}>
            ▶ Play Level {nextLevel}
          </Button>
          <Button tone="ghost" className="w-full py-3 text-xl" onClick={() => go('sanctuary')}>
            🌷 Sanctuary
          </Button>
          <ExhibitButton />
        </div>
      </div>
    </Screen>
  );
}

/** A level left part-way (a reload, a closed tab, or Home from the pause menu) can be picked up again. */
function ContinueCard() {
  const start = useNav((x) => x.start);
  const [saved, setSaved] = useState<Saved | null>(loadGame);
  if (saved === null) return null;
  return (
    <Panel className="mt-4 !p-3">
      <p className="text-sm font-bold">
        You have an unfinished Level {saved.req.cfg.level} with {saved.log.length} moves.
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
        <Button tone="cool" onClick={() => start(saved.req)}>
          ▶ Continue
        </Button>
      </div>
    </Panel>
  );
}

/** The Penguin Exhibit: a calm pond to visit between levels. */
function ExhibitButton() {
  const go = useNav((x) => x.go);
  return (
    <button onClick={() => go('exhibit')} className="flex min-h-tap items-center gap-3 rounded-blob border-[3px] border-night-950 bg-sky-200 px-3 py-2 text-left text-[#3c2f27] shadow-chunky-sm transition-transform duration-150 active:translate-y-0.5">
      <img src={PENGUIN_IDLE_IMAGE_PATH} alt="" className="h-16 w-14 object-contain" />
      <span className="flex flex-col">
        <span className="font-display text-xl font-extrabold">Penguin Exhibit</span>
        <span className="text-sm font-bold opacity-80">Float, sip, sunbathe. Drag or tilt.</span>
      </span>
    </button>
  );
}
