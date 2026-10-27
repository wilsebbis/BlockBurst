/**
 * Live ops, the humane way (Cluck Crossing's events calendar). Kept honest:
 *  - everything is on a public calendar with dates, known in advance (and exportable as .ics); no countdowns;
 *  - what an event says it does, it really does (Weekend Coin Fest really doubles coins from games);
 *  - event cosmetics come back every year, so missing one costs nothing;
 *  - nothing is sold through an event, and no event changes the generator or how hard a board is.
 */
import { addDays, utcDateKey } from './dates';

export interface GameEvent {
  id: string;
  name: string;
  emoji: string;
  /** Inclusive UTC days. */
  start: string;
  end: string;
  blurb: string;
  /** True if it comes back on the same dates every year. */
  yearly: boolean;
  /** Cosmetics earned by finishing one game during the event (they return every year). */
  rewards?: string[];
  /** Board theme the Daily Board wears during the event (cosmetic only). */
  theme?: string;
}

const dow = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** Weekend Coin Fest: coins from games are doubled on Saturdays and Sundays (UTC). */
export const isWeekend = (day: string) => dow(day) === 0 || dow(day) === 6;
export const coinMultiplier = (day: string) => (isWeekend(day) ? 2 : 1);

/** Annual seasons, the same dates every year. */
function seasonsFor(year: number): GameEvent[] {
  return [
    { id: `bloom-${year}`, name: 'Spring Bloom', emoji: '🌷', start: `${year}-04-01`, end: `${year}-04-14`, blurb: 'The Daily Board wears Sakura. Finish any game to get the Bloom Bunny (back every year).', yearly: true, rewards: ['bunny'], theme: 'sakura' },
    { id: `lava-${year}`, name: 'Lava Lagoon', emoji: '🌋', start: `${year}-07-15`, end: `${year}-07-28`, blurb: 'Summer heat. Finish any game to get the Lava Lamp skin and Embers burst (back every year).', yearly: true, rewards: ['lava', 'embers'], theme: 'sunrise' },
    { id: `party-${year}`, name: 'Block Party', emoji: '🎉', start: `${year}-10-20`, end: `${year}-10-26`, blurb: "The game's birthday week. The Daily Board wears Synthwave and every crew gift pays double.", yearly: true, theme: 'synth' },
    { id: `frost-${year}`, name: 'Frosty Fortnight', emoji: '⛄', start: `${year}-12-18`, end: `${year}-12-31`, blurb: 'Snow on the Daily Board. Finish any game to get Ice Blocks and Snowfall (back every year).', yearly: true, rewards: ['ice', 'snow'], theme: 'midnight' },
  ];
}

export function eventsOn(day: string): GameEvent[] {
  const year = Number(day.slice(0, 4));
  const out = seasonsFor(year).filter((e) => day >= e.start && day <= e.end);
  if (isWeekend(day)) {
    const sat = dow(day) === 6 ? day : addDays(day, -1);
    out.push({ id: `coinfest-${sat}`, name: 'Weekend Coin Fest', emoji: '🪙', start: sat, end: addDays(sat, 1), blurb: 'Coins from games are doubled all weekend (UTC). Every weekend.', yearly: false });
  }
  return out;
}

/** Crew gifts pay double during Block Party week. */
export const crewGiftMultiplier = (day: string) => (eventsOn(day).some((e) => e.id.startsWith('party')) ? 2 : 1);

/** The theme today's Daily Board wears, if an event dresses it. */
export const dailyTheme = (day: string) => eventsOn(day).find((e) => e.theme)?.theme ?? null;

/** Everything in the next `days` days, for the public calendar. */
export function upcoming(from = utcDateKey(), days = 60): GameEvent[] {
  const seen = new Map<string, GameEvent>();
  for (let i = 0; i < days; i++) for (const e of eventsOn(addDays(from, i))) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** An event that starts on `day`, for the one-a-day "it's started" reminder. */
export const startingOn = (day: string) => eventsOn(day).find((e) => e.start === day) ?? null;

/** A calendar file of the yearly seasons for the next two years, so players can add them to their own calendar. */
export function icsCalendar(fromYear: number): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Block Burst//Events//EN', 'CALSCALE:GREGORIAN'];
  for (const y of [fromYear, fromYear + 1]) {
    for (const e of seasonsFor(y)) {
      lines.push('BEGIN:VEVENT', `UID:${e.id}@block-burst`, `DTSTART;VALUE=DATE:${e.start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(e.end, 1).replace(/-/g, '')}`, `SUMMARY:${e.emoji} ${e.name} (Block Burst)`, `DESCRIPTION:${e.blurb}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
