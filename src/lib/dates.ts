/** UTC calendar helpers. Every daily and weekly system keys off UTC so the whole world shares one day and week. */
const DAY = 86_400_000;

export const utcDateKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export const monthKey = (d: Date = new Date()) => d.toISOString().slice(0, 7);

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateKey(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** ISO-8601 week key, e.g. 2026-W43. Weeks start on Monday 00:00 UTC. */
export function isoWeek(t: number): string {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday 00:00 UTC of the week containing t. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** How far through its week t is, 0..1. */
export const weekProgress = (t: number) => Math.min(1, Math.max(0, (t - weekStart(t)) / (7 * DAY)));
