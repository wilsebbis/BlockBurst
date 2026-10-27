import { challengesFor, progressFor, weeklyFor, weeklyProgressFor } from './challenges';
import type { Claimables } from './claimables';
import { poolTotal, reachedMilestones } from './crews';
import { isoWeek, utcDateKey } from './dates';
import { BOX_CAP, boxCoins, canOpenCalendar } from './gifts';
import { unclaimed } from './pass';
import { levelFromXp, unlocked } from './progression';
import { useNow } from './useNow';
import { onVacationToday, useMetaStore } from '../stores/useMetaStore';

const NONE: Claimables = { calendar: 0, giftBox: 0, challenges: 0, weekly: 0, crewMilestones: 0, pass: 0, welcomeBack: 0 };

/** Real claimables only, and only for features that are open. The gift box counts once full, so it never nags. */
export function computeClaimables(s: ReturnType<typeof useMetaStore.getState>, now: number): Claimables {
  const today = utcDateKey(new Date(now));
  if (onVacationToday(s.vacations, today)) return NONE;
  const level = levelFromXp(s.xp).level;
  const c = progressFor(s.challenges, today);
  const ready = challengesFor(today).filter((ch) => (c.progress[ch.stat] ?? 0) >= ch.target && !c.claimed.includes(ch.id)).length;
  const week = isoWeek(now);
  const w = weeklyProgressFor(s.weekly, week);
  const weeklyReady = weeklyFor(week).filter((q) => (w.progress[q.stat] ?? 0) >= q.target && !w.claimed.includes(q.id)).length;
  const crew = s.crew.crew;
  return {
    calendar: unlocked('gifts', level) && canOpenCalendar(s.calendar, today) ? 1 : 0,
    giftBox: unlocked('gifts', level) && boxCoins(s.boxLast, now) >= BOX_CAP ? 1 : 0,
    challenges: unlocked('challenges', level) ? ready + (c.claimed.length >= 3 && !c.allClear ? 1 : 0) : 0,
    weekly: unlocked('challenges', level) ? weeklyReady : 0,
    crewMilestones: crew && unlocked('crews', level) ? reachedMilestones(poolTotal(crew, s.crew.myShare, now), crew).filter((i) => !s.crew.claimed.includes(i)).length : 0,
    pass: unlocked('pass', level) ? unclaimed(s.pass).length : 0,
    welcomeBack: s.welcomeBack ? 1 : 0,
  };
}

export function useClaimables(): Claimables {
  const now = useNow(30_000);
  const s = useMetaStore();
  return computeClaimables(s, now);
}
