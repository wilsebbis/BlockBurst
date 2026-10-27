/**
 * Glance page (`?glance=streak`): the web stand-in for a home-screen widget. Glanceable in one second: one number
 * and a cheerful line. It never looks disappointed about a missed day.
 */
import { cosmeticById } from '../lib/cosmetics';
import { utcDateKey } from '../lib/dates';
import { useMetaStore } from '../stores/useMetaStore';

export function GlancePage() {
  const s = useMetaStore();
  const playedToday = !!s.dailyRuns[utcDateKey()];
  return (
    <a href="./" className="app-bg flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="text-8xl" aria-hidden>
        {cosmeticById(s.loadout.avatar)?.emoji ?? '🧊'}
      </span>
      <p className="font-display text-7xl font-extrabold leading-none text-white text-outline">{s.streak.totalDays}</p>
      <p className="font-display text-xl font-extrabold text-white/90">days on the Daily Board</p>
      <p className="font-display text-sm font-extrabold text-white/80">{playedToday ? "✔ Today's board: done" : "Today's board is ready"}</p>
    </a>
  );
}
