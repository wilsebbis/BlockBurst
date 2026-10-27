/**
 * Daily Road streak, the humane way (AntLink's total-days streak). The headline number is total days you've
 * played the Daily Road, which never goes down. The run count beside it uses free rest days for missed days
 * automatically (one banked every 7 days played, up to 3, plus one to start). When none are left the run simply
 * starts again from today. Nothing is ever wiped: no penalty, no countdown, no "expires in 2h", no paid freezes.
 *
 * Vacation mode ("Player psychology": free rest days and vacation mode, no penalty for a break) pauses the run for
 * up to 30 days: days inside a vacation are neither missed nor counted, and they don't use rest days.
 */
import { addDays, daysBetween } from './dates';

export interface StreakData {
  totalDays: number;
  current: number;
  best: number;
  restDays: number;
  lastDay: string | null;
  /** Days covered by a rest day, for the calendar. */
  restedOn: string[];
}

export const MAX_REST_DAYS = 3;

export const emptyStreak = (): StreakData => ({ totalDays: 0, current: 0, best: 0, restDays: 1, lastDay: null, restedOn: [] });

export interface Vacation {
  start: string;
  end: string;
}

export const MAX_VACATION_DAYS = 30;

const onVacation = (day: string, vacations: Vacation[]) => vacations.some((v) => day >= v.start && day <= v.end);

export function recordDay(s: StreakData, day: string, vacations: Vacation[] = []): StreakData {
  if (s.lastDay === day) return s;
  if (s.lastDay && daysBetween(s.lastDay, day) < 0) return s;
  const next: StreakData = { ...s, restedOn: [...s.restedOn] };
  const gap = s.lastDay ? daysBetween(s.lastDay, day) : 1;
  let vacationDays = 0;
  for (let i = 1; i < gap; i++) if (s.lastDay && onVacation(addDays(s.lastDay, i), vacations)) vacationDays++;
  const missed = gap - 1 - vacationDays;
  if (!s.lastDay || missed === 0) next.current = s.current + 1;
  else if (missed <= s.restDays) {
    next.restDays = s.restDays - missed;
    for (let i = 1, used = 0; i < gap && used < missed; i++) {
      const d = addDays(s.lastDay, i);
      if (!onVacation(d, vacations)) {
        next.restedOn.push(d);
        used++;
      }
    }
    next.current = s.current + 1;
  } else {
    // Out of rest days: the run starts again today. Total days played, your best and everything else stay.
    next.restDays = 0;
    next.current = 1;
  }
  next.totalDays = s.totalDays + 1;
  if (next.totalDays % 7 === 0) next.restDays = Math.min(MAX_REST_DAYS, next.restDays + 1);
  next.best = Math.max(next.best, next.current);
  next.lastDay = day;
  next.restedOn = next.restedOn.slice(-60);
  return next;
}
