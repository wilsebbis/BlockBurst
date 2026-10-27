/** Daily Challenges: three deterministic goals per UTC day (the same for everyone), plus an all-clear bonus. */
import { createRng } from '../engine/rng';

export type ChallengeStat = 'runs' | 'lines' | 'bestScore' | 'combo' | 'multi' | 'perfects' | 'pieces' | 'gems' | 'daily' | 'adventure';

export interface Challenge {
  id: string;
  stat: ChallengeStat;
  target: number;
  label: string;
  emoji: string;
  coins: number;
}

const POOL: Omit<Challenge, 'id'>[] = [
  { stat: 'runs', target: 3, label: 'Play 3 games', emoji: '🧱', coins: 25 },
  { stat: 'lines', target: 30, label: 'Clear 30 lines', emoji: '➖', coins: 30 },
  { stat: 'lines', target: 60, label: 'Clear 60 lines', emoji: '➖', coins: 50 },
  { stat: 'bestScore', target: 3000, label: 'Score 3,000 in one game', emoji: '🏁', coins: 35 },
  { stat: 'bestScore', target: 8000, label: 'Score 8,000 in one game', emoji: '🏁', coins: 55 },
  { stat: 'combo', target: 4, label: 'Reach a x4 combo', emoji: '🔥', coins: 35 },
  { stat: 'multi', target: 2, label: 'Clear 2 lines with one piece', emoji: '✖️', coins: 30 },
  { stat: 'multi', target: 3, label: 'Clear 3 lines with one piece', emoji: '✖️', coins: 50 },
  { stat: 'pieces', target: 80, label: 'Place 80 pieces', emoji: '🧩', coins: 25 },
  { stat: 'gems', target: 8, label: 'Collect 8 gems in Adventure', emoji: '💎', coins: 30 },
  { stat: 'adventure', target: 2, label: 'Win 2 Adventure levels', emoji: '🗺️', coins: 35 },
  { stat: 'daily', target: 1, label: 'Play the Daily Board', emoji: '📅', coins: 30 },
];

export function challengesFor(day: string): Challenge[] {
  const rng = createRng(`burst/challenges/v1/${day}`);
  const picked: Challenge[] = [];
  for (const c of rng.shuffle(POOL.slice())) {
    if (picked.some((p) => p.stat === c.stat)) continue;
    picked.push({ ...c, id: `${day}-${c.stat}-${c.target}` });
    if (picked.length === 3) break;
  }
  return picked;
}

export const ALL_CLEAR_COINS = 40;

/** Stats that track the best single value instead of a running total. */
export const MAX_STATS: ChallengeStat[] = ['bestScore', 'combo', 'multi'];

export interface ChallengeProgress {
  day: string;
  progress: Partial<Record<ChallengeStat, number>>;
  claimed: string[];
  allClear: boolean;
}

/** Stored progress if it is for `day`, otherwise a fresh (empty) day. */
export const progressFor = (c: ChallengeProgress, day: string): ChallengeProgress => (c.day === day ? c : { day, progress: {}, claimed: [], allClear: false });

/** Weekly quests: three bigger goals per ISO week, the same for everyone. There's no penalty for missing one. */
export type WeeklyStat = 'runs' | 'lines' | 'score' | 'perfects' | 'adventure' | 'dailyDays';

export interface WeeklyQuest {
  id: string;
  stat: WeeklyStat;
  target: number;
  label: string;
  emoji: string;
  coins: number;
}

const WEEKLY_POOL: Omit<WeeklyQuest, 'id'>[] = [
  { stat: 'runs', target: 20, label: 'Play 20 games this week', emoji: '🧱', coins: 90 },
  { stat: 'lines', target: 400, label: 'Clear 400 lines this week', emoji: '➖', coins: 110 },
  { stat: 'score', target: 60000, label: 'Score 60,000 in total this week', emoji: '🏁', coins: 100 },
  { stat: 'perfects', target: 3, label: 'Make 3 Perfect Clears this week', emoji: '✨', coins: 90 },
  { stat: 'adventure', target: 8, label: 'Win 8 Adventure levels this week', emoji: '🗺️', coins: 90 },
  { stat: 'dailyDays', target: 4, label: 'Play the Daily Board on 4 days', emoji: '📅', coins: 110 },
];

export function weeklyFor(week: string): WeeklyQuest[] {
  const rng = createRng(`burst/weekly/v1/${week}`);
  return rng
    .shuffle(WEEKLY_POOL.slice())
    .slice(0, 3)
    .map((q) => ({ ...q, id: `${week}-${q.stat}` }));
}

export interface WeeklyProgress {
  week: string;
  progress: Partial<Record<WeeklyStat, number>>;
  claimed: string[];
}

export const weeklyProgressFor = (w: WeeklyProgress, week: string): WeeklyProgress => (w.week === week ? w : { week, progress: {}, claimed: [] });
