import { LockedCard } from './HomeScreen';
import { CosmeticPreview } from '../components/shared/CosmeticPreview';
import { Button, Panel, Screen, ScreenHeader } from '../components/shared/ui';
import { mustCosmetic } from '../lib/cosmetics';
import { utcDateKey } from '../lib/dates';
import { eventsOn, icsCalendar, upcoming } from '../lib/events';
import { levelFromXp, unlocked } from '../lib/progression';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

export function EventsScreen() {
  const s = useMetaStore();
  const go = useNav((x) => x.go);
  const today = utcDateKey();
  const level = levelFromXp(s.xp).level;
  const now = eventsOn(today);
  const list = upcoming(today, 365);

  if (!unlocked('events', level))
    return (
      <Screen>
        <ScreenHeader title="Events" onBack={() => go('home')} />
        <div className="px-4">
          <LockedCard feature="events" />
        </div>
      </Screen>
    );

  return (
    <Screen>
      <ScreenHeader title="Events" onBack={() => go('home')} />
      <div className="space-y-3 px-4">
        <Panel>
          <p className="text-sm font-bold text-white/80">Everything is on this public calendar ahead of time. Events never change the tray generator or how hard a board is, never sell anything, and every event cosmetic comes back every year.</p>
        </Panel>
        <Panel>
          <h2 className="font-display text-xl font-extrabold">On now</h2>
          <ul className="mt-1 space-y-3">
            {now.map((e) => (
              <li key={e.id} className="text-sm font-bold">
                {e.emoji} <b>{e.name}</b> ({e.start} to {e.end}): {e.blurb}
                {e.rewards && (
                  <span className="mt-1 flex gap-2">
                    {e.rewards.map((id) => (
                      <span key={id} className="flex items-center gap-1 text-xs">
                        <CosmeticPreview item={mustCosmetic(id)} size={28} dim={!s.owned.includes(id)} />
                        {s.owned.includes(id) ? '✔ yours' : mustCosmetic(id).name}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
            {now.length === 0 && <li className="text-sm font-bold text-white/60">No event today. The next ones are below.</li>}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-xl font-extrabold">Coming up</h2>
          <ul className="mt-1 space-y-1 text-sm font-bold">
            {list.slice(0, 16).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>
                  {e.emoji} {e.name}
                </span>
                <span className="text-white/70">
                  {e.start} – {e.end}
                </span>
              </li>
            ))}
          </ul>
          <Button
            tone="ghost"
            className="mt-3 w-full text-sm"
            onClick={() => {
              const blob = new Blob([icsCalendar(Number(today.slice(0, 4)))], { type: 'text/calendar' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'block-burst-events.ics';
              a.click();
            }}
          >
            📆 Add the yearly seasons to your calendar
          </Button>
        </Panel>
      </div>
    </Screen>
  );
}
