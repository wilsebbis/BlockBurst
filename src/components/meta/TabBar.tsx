/**
 * Thumb-zone tab bar: the main places sit at the bottom where a thumb reaches. Locked tabs still show, with the
 * level that opens them, so nothing is hidden. Dots only ever mean something is ready to claim, never "new in the
 * shop".
 */
import clsx from 'clsx';
import { synth } from '../../engine/WebAudioSynthesizer';
import { levelFromXp, unlocked, UNLOCKS, type Feature } from '../../lib/progression';
import { useClaimables } from '../../lib/useClaimables';
import { useMetaStore } from '../../stores/useMetaStore';
import { useNav, type Screen } from '../../stores/useNav';

const TABS: { screen: Screen; label: string; emoji: string; feature?: Feature; also?: Screen[] }[] = [
  { screen: 'home', label: 'Play', emoji: '🧱', also: ['adventure', 'challenges', 'pass', 'events', 'profile', 'collection', 'settings', 'store', 'sanctuary'] },
  { screen: 'daily', label: 'Daily', emoji: '📅', feature: 'daily' },
  { screen: 'ranks', label: 'Compete', emoji: '🏆', feature: 'ranks', also: ['leagues'] },
  { screen: 'shop', label: 'Shop', emoji: '🛍️', feature: 'shop' },
  { screen: 'crew', label: 'Crew', emoji: '🚩', feature: 'crews' },
];

export function TabBar() {
  const screen = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const level = levelFromXp(useMetaStore((s) => s.xp)).level;
  const c = useClaimables();
  const dots: Partial<Record<Screen, number>> = { home: c.calendar + c.giftBox + c.challenges + c.weekly + c.pass + c.welcomeBack, crew: c.crewMilestones };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-night-950 bg-night-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const locked = t.feature ? !unlocked(t.feature, level) : false;
          const active = screen === t.screen || !!t.also?.includes(screen);
          return (
            <li key={t.screen} className="flex-1">
              <button
                onClick={() => {
                  synth.unlock();
                  synth.playTap();
                  go(t.screen);
                }}
                aria-current={active ? 'page' : undefined}
                className={clsx('relative flex min-h-[56px] w-full flex-col items-center justify-center py-1.5 font-display text-xs font-extrabold', active ? 'text-white' : 'text-white/60')}
              >
                <span className={clsx('text-2xl leading-none', locked && 'opacity-40 grayscale')} aria-hidden>
                  {t.emoji}
                </span>
                <span>{locked ? `🔒 Lv ${UNLOCKS[t.feature!]}` : t.label}</span>
                {!locked && (dots[t.screen] ?? 0) > 0 && <span className="absolute right-[26%] top-1 h-3 w-3 rounded-full border-2 border-night-900 bg-rose-500" aria-label="Something is ready to claim" />}
                {active && <span className="absolute inset-x-6 bottom-0 h-1 rounded-full bg-amber-400" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
