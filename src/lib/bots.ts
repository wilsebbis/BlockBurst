/**
 * Practice players for the Daily Board. Generated from the date alone and always shown with a [BOT] badge, plus
 * Burst Bot's real score: the greedy bot actually plays today's board with the real rules. Bot scores never react
 * to how you play or spend.
 */
import { playOut } from '../engine/bot';
import { createRng } from '../engine/rng';
import { initialState } from '../engine/rules';

export interface BoardEntry {
  name: string;
  score: number;
  kind: 'you' | 'bot' | 'player';
}

const NAMES = ['Tetra', 'Blocky', 'Cubert', 'Stacker', 'Brix', 'Pixel', 'Quad', 'Mochi', 'Kiwi', 'Juniper'];

export const dailySeed = (day: string) => `burst/daily/v1/${day}`;

const botScores = new Map<string, number>();

/** Burst Bot's score on a day's board (memoised; it takes a few milliseconds). */
export function burstBotScore(day: string): number {
  let s = botScores.get(day);
  if (s === undefined) {
    const cfg = { mode: 'daily' as const, seed: dailySeed(day) };
    s = playOut(cfg, initialState(cfg), 400).state.score;
    botScores.set(day, s);
  }
  return s;
}

export function dailyBots(day: string, count = 7): BoardEntry[] {
  const rng = createRng(`burst/daily-bots/v1/${day}`);
  const names = rng.shuffle(NAMES.slice()).slice(0, count);
  return [{ name: 'Burst Bot', score: burstBotScore(day), kind: 'bot' as const }, ...names.map((name) => ({ name, score: Math.round((600 + Math.pow(rng.next(), 1.6) * 18000) / 10) * 10, kind: 'bot' as const }))];
}
