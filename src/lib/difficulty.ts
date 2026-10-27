/**
 * How hard an Adventure level is, measured rather than made up: a slightly sloppy Burst Bot (it settles for a
 * worse move about a third of the time) plays the level a couple of dozen times, and the share it clears is the
 * level's clear rate. Every level is proven beatable by the full-strength bot; this says how forgiving it is.
 * Results are cached per level, and the work runs in small slices so the game never stutters.
 */
import { playOutLoose } from '../engine/bot';
import { levelFor } from '../engine/levels';
import { createRng } from '../engine/rng';
import { startState } from '../engine/rules';
import type { RunConfig } from '../types/game';

export const TRIES = 24;
const SLIP = 0.35;
const CACHE = 'burst-clear-rate-v2:';

/** One try of the sloppy bot at level `n`; deterministic for a given try number. */
function attempt(n: number, k: number): boolean {
  const spec = levelFor(n);
  const cfg: RunConfig = { mode: 'adventure', seed: spec.seed, level: n };
  return playOutLoose(cfg, startState(cfg, spec.grid, spec.gems, spec.goal), createRng(`clear-rate/${n}/${k}`).next, SLIP).won;
}

/** The share of tries the sloppy bot clears (synchronous; about a quarter of a second). */
export function clearRate(n: number, tries = TRIES): number {
  let wins = 0;
  for (let k = 0; k < tries; k++) if (attempt(n, k)) wins++;
  return wins / tries;
}

/** The same, cached and worked out a slice at a time between frames. */
export async function clearRateSoon(n: number): Promise<number> {
  try {
    const hit = localStorage.getItem(CACHE + n);
    if (hit !== null) return Number(hit);
  } catch {
    // Storage can be unavailable (private mode); just measure.
  }
  let wins = 0;
  for (let k = 0; k < TRIES; k++) {
    await new Promise((r) => setTimeout(r, 0));
    if (attempt(n, k)) wins++;
  }
  const rate = wins / TRIES;
  try {
    localStorage.setItem(CACHE + n, String(rate));
  } catch {
    // Not cached this time; that's fine.
  }
  return rate;
}

/** The line shown as a level starts, e.g. "🌶️ Tricky level · Burst Bot clears it 38% of the time". */
export function difficultyLine(rate: number): string {
  const pct = Math.round(rate * 100);
  const label = rate >= 0.8 ? '🌼 Breezy level' : rate >= 0.5 ? '🙂 Steady level' : rate >= 0.25 ? '🌶️ Tricky level' : '🔥 Super hard level';
  return `${label} · Burst Bot clears it ${pct}% of the time`;
}
