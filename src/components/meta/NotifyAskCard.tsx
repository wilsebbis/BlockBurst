/**
 * Our own pre-permission card ("Notifications, widgets, interface and unlocks"): shown only after a positive
 * moment (a new best, or a few runs in), never on first launch. The browser's own prompt only appears if the
 * player taps "Yes", so a "no" here never burns the one-time system prompt. Asked once; Settings can change it.
 */
import { useMetaStore } from '../../stores/useMetaStore';
import { Button, Panel } from '../shared/ui';

export function shouldAskNotify(s: ReturnType<typeof useMetaStore.getState>): boolean {
  if (s.notify.prefs.asked || typeof Notification === 'undefined' || Notification.permission === 'denied') return false;
  return s.totals.games >= 3 && s.totals.lines >= 20;
}

export function NotifyAskCard() {
  const s = useMetaStore();
  if (!shouldAskNotify(s)) return null;
  return (
    <Panel className="mt-3 !bg-sky-900/80">
      <h2 className="font-display text-lg font-extrabold">🔔 Want a nudge for the Daily Board?</h2>
      <p className="text-sm font-bold text-white/80">At most one a day, at the time you usually play, never at night, and only about real things: a new Daily Board, a full gift box, a crew milestone. No guilt trips, no offers.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button tone="ghost" onClick={() => s.setNotifyPrefs({ asked: true, enabled: false })}>
          No thanks
        </Button>
        <Button
          tone="cool"
          onClick={async () => {
            const p = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
            s.setNotifyPrefs({ asked: true, enabled: p === 'granted' });
          }}
        >
          Yes, please
        </Button>
      </div>
    </Panel>
  );
}
