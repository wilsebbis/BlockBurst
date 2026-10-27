/**
 * Weekly leagues: race 29 near-equals on XP earned this week (the league shape from Cluck Crossing and Bark
 * Battle).
 *
 * Industry-standard shape (Duolingo, Royal Match): a small group, a fresh race each week, the top of the table
 * moves up. The kinder parts: there is no relegation (a bad week holds you where you are), a week off leaves your
 * league exactly as it was, the near-equals are labelled practice bots until a backend supplies real players,
 * bot pace never reacts to how you play or spend, and nothing in a league is for sale.
 *
 * Leagues measure how much you played this week; Ranks (ranks.ts) measure how well. They are separate on purpose.
 */
import { createRng } from '../engine/rng';
import { isoWeek, weekProgress } from './dates';

export const LEAGUE_SIZE = 30;
export const PROMOTE_TOP = 7;

export const LEAGUES = [
  { name: 'Pebble', emoji: '🪨' },
  { name: 'Brick', emoji: '🧱' },
  { name: 'Copper', emoji: '🟫' },
  { name: 'Jade', emoji: '🟩' },
  { name: 'Ruby', emoji: '🟥' },
  { name: 'Sapphire', emoji: '🟦' },
  { name: 'Prism', emoji: '🌈' },
] as const;

const NAMES = ['Tetra', 'Blocky', 'Pixel', 'Cubert', 'Quad', 'Stacker', 'Brix', 'Lego', 'Tilly', 'Grid', 'Jade', 'Combo', 'Nova', 'Mochi', 'Dot', 'Prism', 'Luna', 'Ziggy', 'Olive', 'Rocket', 'Fig', 'Kiwi', 'Juniper', 'Bean', 'Gus', 'Poppy', 'Sunny', 'Clover', 'Dash', 'Hazel'];

export interface Racer {
  name: string;
  xp: number;
  bot: boolean;
}

/** A practice racer's full-week XP, scaled to the league. Deterministic per week, league and seat. */
function botWeekXp(league: number, week: string, seat: number): number {
  const rng = createRng(`burst/league/v1/${week}/${league}/${seat}`);
  const base = 260 + league * 150;
  return Math.round(base * (0.15 + rng.next() * 1.7));
}

/** The table for a league this week. Bots earn their week steadily as it goes by. Ties go to you. */
export function table(league: number, week: string, myXp: number, now: number, myName = 'You'): Racer[] {
  const p = isoWeek(now) === week ? weekProgress(now) : 1;
  const bots: Racer[] = Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => ({ name: NAMES[i % NAMES.length], xp: Math.round(botWeekXp(league, week, i) * p), bot: true }));
  return [...bots, { name: myName, xp: myXp, bot: false }].sort((a, b) => b.xp - a.xp || (a.bot ? 1 : -1));
}

export const rankIn = (t: Racer[]) => t.findIndex((r) => !r.bot) + 1;

/** League after a finished week: the top PROMOTE_TOP move up; nobody ever moves down. */
export const settle = (league: number, rank: number) => (rank <= PROMOTE_TOP ? Math.min(LEAGUES.length - 1, league + 1) : league);

/** Coins for a finished week, by final rank. Shown up front on the league screen. */
export const weekReward = (rank: number) => (rank === 1 ? 150 : rank <= 3 ? 100 : rank <= PROMOTE_TOP ? 60 : 25);

export interface LeagueState {
  tier: number;
  week: string;
  weeklyXp: number;
  history: { week: string; tier: number; rank: number; promoted: boolean; coins: number }[];
}

export const emptyLeague = (now = Date.now()): LeagueState => ({ tier: 0, week: isoWeek(now), weeklyXp: 0, history: [] });

/** Close out a stored week if a new one has started. A week with no XP isn't recorded and changes nothing. */
export function rollover(s: LeagueState, now = Date.now(), myName = 'You'): { state: LeagueState; result: LeagueState['history'][number] | null } {
  const week = isoWeek(now);
  if (s.week === week) return { state: s, result: null };
  if (s.weeklyXp <= 0) return { state: { ...s, week, weeklyXp: 0 }, result: null };
  const rank = rankIn(table(s.tier, s.week, s.weeklyXp, now, myName));
  const tier = settle(s.tier, rank);
  const result = { week: s.week, tier: s.tier, rank, promoted: tier > s.tier, coins: weekReward(rank) };
  return { state: { tier, week, weeklyXp: 0, history: [...s.history, result].slice(-26) }, result };
}
