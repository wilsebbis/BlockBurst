/**
 * Two gentle ways coins arrive outside a run.
 *
 * The Gift Calendar (AntLink's Pantry): seven steps that move forward on any day you play. Days don't need to be
 * in a row, and a skipped day never resets it.
 *
 * The Gift Box (the "free gift" every crossing game has, minus the timer): it fills while you're away, up to an
 * 8-hour cap, and simply waits when full. There is no countdown, no "ready in 3:59:59", nothing to miss.
 */
export const CALENDAR = [15, 20, 25, 30, 35, 40, 80];

export interface CalendarState {
  step: number;
  lastDay: string | null;
}

export const canOpenCalendar = (s: CalendarState, day: string) => s.lastDay !== day;

export function openCalendar(s: CalendarState, day: string): { state: CalendarState; coins: number } | null {
  if (!canOpenCalendar(s, day)) return null;
  return { state: { step: (s.step + 1) % CALENDAR.length, lastDay: day }, coins: CALENDAR[s.step] };
}

export const BOX_COINS_PER_HOUR = 8;
export const BOX_CAP_HOURS = 8;
export const BOX_CAP = BOX_COINS_PER_HOUR * BOX_CAP_HOURS;

export function boxCoins(lastCollect: number, now: number): number {
  const hours = Math.max(0, now - lastCollect) / 3_600_000;
  return Math.min(BOX_CAP, Math.floor(hours * BOX_COINS_PER_HOUR));
}

export const boxFill = (lastCollect: number, now: number) => boxCoins(lastCollect, now) / BOX_CAP;

/**
 * The welcome-back gift ("Where the money comes from": comeback rewards). After a week or more away, a gift
 * waits in the app. It's a welcome, never a guilt trip: nothing was lost while you were gone.
 */
export const WELCOME_BACK_DAYS = 7;
export const WELCOME_BACK_COINS = 75;

export function welcomeBackDue(lastSeenDay: string | null, today: string): boolean {
  if (!lastSeenDay) return false;
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastSeenDay}T00:00:00Z`)) / 86_400_000 >= WELCOME_BACK_DAYS;
}
