/**
 * Adventure: a trail of levels built from their number, ten to a world. Each level is a starting board with 💎 gems to collect
 * (or, every fifth level, a score to reach). Every level was beaten by Burst Bot before it was shown, and its move
 * count is the 3-star par. Levels unlock by playing, never by paying, and replaying a level is always free.
 */
import clsx from 'clsx';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { WORLD_SIZE, WORLDS, worldOf } from '../engine/levels';
import { adventureRequest } from '../lib/requests';
import { adventureStars, useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function AdventureScreen() {
  const a = useMetaStore((s) => s.adventure);
  const go = useNav((x) => x.go);
  const start = useNav((x) => x.start);
  const worldsOpen = Math.ceil(a.unlocked / WORLD_SIZE);
  const worlds = Array.from({ length: Math.max(worldsOpen, 1) + 1 }, (_, w) => w);

  return (
    <Screen>
      <ScreenHeader title="Adventure" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <p className="text-sm font-bold text-white/80">
            Clear the lines that hold 💎 gems to collect them. Every fifth level asks for a score instead. Beat a level in Burst Bot's move count or fewer for ⭐⭐⭐. A cleared level pays 🪙 50 per star, plus 50 for each world past the first.
          </p>
          <p className="mt-1 text-sm font-extrabold">⭐ {adventureStars(a)} stars · level {a.unlocked} reached</p>
          <Button tone="cool" className="mt-3 w-full py-3 text-xl" onClick={() => start(adventureRequest(a.unlocked), 'adventure')}>
            ▶ Play level {a.unlocked}
          </Button>
        </Panel>

        {worlds.map((w) => {
          const first = w * WORLD_SIZE + 1;
          const world = worldOf(first);
          const locked = first > a.unlocked;
          return (
            <Panel key={w} className={clsx('reveal', locked && 'opacity-70')}>
              <h2 className="font-display text-xl font-extrabold">
                {world.emoji} World {w + 1}: {world.name}
              </h2>
              {locked ? (
                <p className="text-sm font-bold text-white/60">🔒 Reach level {first} to open it. You can see what's next; it opens by playing.</p>
              ) : (
                <ol className="mt-2 grid grid-cols-5 gap-2">
                  {Array.from({ length: WORLD_SIZE }, (_, i) => {
                    const n = first + i;
                    const open = n <= a.unlocked;
                    const stars = a.stars[n] ?? 0;
                    return (
                      <li key={n}>
                        <button
                          disabled={!open}
                          onClick={() => start(adventureRequest(n), 'adventure')}
                          className={clsx('grid aspect-square min-h-tap w-full place-items-center rounded-xl border-[3px] border-night-950 font-display font-extrabold shadow-chunky-sm', n === a.unlocked ? 'bg-amber-400 text-night-950' : open ? 'bg-sky-500 text-night-950' : 'bg-white/10 text-white/60')}
                          aria-label={open ? `Level ${n}, ${stars} stars${n % 5 === 0 ? ', score goal' : ''}` : `Level ${n}, locked`}
                        >
                          <span className="leading-none">{open ? n : '🔒'}</span>
                          <span className="text-[10px] leading-none" aria-hidden>
                            {n % 5 === 0 ? '🎯' : ''}
                            {open && stars > 0 ? '⭐'.repeat(stars) : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          );
        })}
        <p className="text-center text-xs font-bold text-white/50">{WORLDS.length} worlds, then the trail loops with harder boards. It never ends.</p>
      </div>
    </Screen>
  );
}
