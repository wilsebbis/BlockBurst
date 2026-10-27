/**
 * Streak HUD. Total days played is the headline (it never goes down). No countdown, no warning colour, no
 * urgent copy. Rest days are free and used automatically.
 */
import { useMetaStore } from '../../stores/useMetaStore';
import { Pill } from '../shared/ui';

export function StreakHUD() {
  const s = useMetaStore((x) => x.streak);
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Daily Board streak">
      <Pill title="Days you've played the Daily Board. This number never goes down.">📅 {s.totalDays} days</Pill>
      <Pill title="Daily Boards in a row, with rest days covering any gaps.">🔥 {s.current} in a row</Pill>
      <Pill title="Free rest days: used automatically when you miss a day. One more every 7 days played (up to 3).">🛌 {s.restDays} rest</Pill>
    </div>
  );
}
