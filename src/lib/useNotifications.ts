/**
 * Browser side of the notification policy in notify.ts. Uses the Notification API while the tab is open in the
 * background (a closed-app push needs a push server, which isn't built). Also keeps the opt-in app-icon badge
 * (Badging API) in step with real claimables. Both stay silent on vacation.
 */
import { useEffect } from 'react';
import { totalClaimables } from './claimables';
import { utcDateKey } from './dates';
import { startingOn } from './events';
import { BOX_CAP, BOX_COINS_PER_HOUR } from './gifts';
import { poolTotal, reachedMilestones } from './crews';
import { planNext } from './notify';
import { computeClaimables } from './useClaimables';
import { onVacationToday, useMetaStore } from '../stores/useMetaStore';

type BadgeNav = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function useNotifications(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const s = useMetaStore.getState();
      const now = new Date();
      const today = utcDateKey(now);
      const vacation = onVacationToday(s.vacations, today);
      // App badge: opt-in, real claimables only, off on vacation.
      const nav = navigator as BadgeNav;
      if (nav.setAppBadge && nav.clearAppBadge) {
        const n = s.settings.appBadge && !vacation ? totalClaimables(computeClaimables(s, now.getTime())) : 0;
        void (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => undefined);
      }
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const crew = s.crew.crew;
      const plan = planNext(now, s.notify.prefs, s.notify.log, {
        boxFullAt: s.boxLast + (BOX_CAP / BOX_COINS_PER_HOUR) * 3_600_000,
        dailyUnplayed: !s.dailyRuns[today],
        crewMilestoneReady: !!crew && reachedMilestones(poolTotal(crew, s.crew.myShare), crew).some((i) => !s.crew.claimed.includes(i)),
        eventToday: startingOn(today)?.name ?? null,
        lastPlayedAt: s.history.at(-1)?.at ?? Date.now(),
        appVisible: document.visibilityState === 'visible',
        vacation,
      });
      if (!plan) return;
      timer = setTimeout(
        () => {
          if (document.visibilityState === 'visible') return schedule();
          const n = new Notification(plan.title, { body: plan.body, icon: '/favicon.svg', tag: plan.kind });
          n.onclick = () => {
            window.focus();
            location.href = plan.url;
          };
          useMetaStore.getState().notifySent(plan);
          schedule();
        },
        Math.max(1000, Math.min(plan.at - now.getTime(), 2 ** 31 - 1)),
      );
    };
    schedule();
    const unsub = useMetaStore.subscribe(schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);
}
