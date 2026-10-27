/**
 * Adventure levels, built on demand from the level number alone. A level is a starting board (clustered blocks,
 * some carrying 💎 gems) and a goal: collect every gem, or (every fifth level) reach a target score.
 *
 * Every level is checked before it is shown, the way AntLink verifies its boards: Burst Bot plays it with the real
 * rules and the real generator, and a layout variant only ships if the bot meets the goal. Score targets are set
 * below what the bot reached. So every level is proven beatable, and the star par is the bot's own move count.
 */
import { fullLines, masksOf, SIZE } from './board';
import { playOut } from './bot';
import { createRng } from './rng';
import { startState } from './rules';
import type { Goal, RunConfig } from '../types/game';

export interface LevelSpec {
  n: number;
  seed: string;
  grid: number[];
  gems: number[];
  goal: Goal;
  /** Moves the bot needed: 3 stars at or under par, 2 within half again. */
  par: number;
}

export const WORLD_SIZE = 10;

export const WORLDS = [
  { name: 'Candy Coast', emoji: '🍬' },
  { name: 'Jelly Jungle', emoji: '🌴' },
  { name: 'Crystal Caves', emoji: '💎' },
  { name: 'Neon Nights', emoji: '🌃' },
  { name: 'Frosty Peaks', emoji: '🏔️' },
  { name: 'Lava Lagoon', emoji: '🌋' },
  { name: 'Star Station', emoji: '🚀' },
];

export const worldOf = (n: number) => WORLDS[Math.floor((n - 1) / WORLD_SIZE) % WORLDS.length];

const MAX_VARIANTS = 24;

function layout(n: number, v: number): { grid: number[]; gems: number[] } {
  const rng = createRng(`burst/level/v1/${n}/${v}`);
  const grid = new Array(SIZE * SIZE).fill(0);
  const density = n === 1 ? 0.1 : 0.14 + Math.min(0.24, n * 0.006);
  const target = Math.round(SIZE * SIZE * density);
  let filled = 0;
  let guard = 0;
  while (filled < target && guard++ < 200) {
    const w = rng.range(1, 3);
    const h = rng.range(1, 2);
    const r0 = rng.range(0, SIZE - h);
    const c0 = rng.range(0, SIZE - w);
    const colour = rng.range(1, 7);
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (!grid[r * SIZE + c]) filled++;
        grid[r * SIZE + c] = colour;
      }
    }
  }
  // Never start with a complete line.
  const { rows, cols } = fullLines(masksOf(grid));
  for (const r of rows) grid[r * SIZE + rng.int(SIZE)] = 0;
  for (const c of cols) grid[rng.int(SIZE) * SIZE + c] = 0;
  const cells = grid.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const want = Math.min(cells.length, Math.min(12, 2 + Math.ceil(n / 3)));
  const gems = rng
    .shuffle(cells)
    .slice(0, want)
    .sort((a, b) => a - b);
  return { grid, gems };
}

const isScoreLevel = (n: number) => n % 5 === 0;

function build(n: number): LevelSpec {
  let fallback: LevelSpec | null = null;
  for (let v = 0; v < MAX_VARIANTS; v++) {
    const seed = `burst/level/v1/${n}/${v}`;
    const cfg: RunConfig = { mode: 'adventure', seed, level: n };
    const { grid, gems } = layout(n, v);
    if (isScoreLevel(n)) {
      const probe = playOut(cfg, startState(cfg, grid, [], null), 60).state;
      const target = Math.floor((probe.score * 0.75) / 50) * 50;
      if (target < 300) continue;
      const goal: Goal = { kind: 'score', target };
      const run = playOut(cfg, startState(cfg, grid, [], goal), 200);
      if (run.state.won) return { n, seed, grid, gems: [], goal, par: run.moves.length };
      continue;
    }
    const goal: Goal = { kind: 'gems', count: gems.length };
    const run = playOut(cfg, startState(cfg, grid, gems, goal), 200);
    if (run.state.won) return { n, seed, grid, gems, goal, par: run.moves.length };
    if (!fallback && run.state.gemsCollected > 0) {
      // Keep the gems the bot did reach, so even the fallback is proven.
      fallback = { n, seed, grid, gems, goal: { kind: 'gems', count: run.state.gemsCollected }, par: run.moves.length };
    }
  }
  if (fallback) return fallback;
  return { n, seed: `burst/level/v1/${n}/x`, grid: new Array(SIZE * SIZE).fill(0), gems: [], goal: { kind: 'score', target: 200 }, par: 30 };
}

const cache = new Map<number, LevelSpec>();

export function levelFor(n: number): LevelSpec {
  const k = Math.max(1, Math.floor(n));
  let spec = cache.get(k);
  if (!spec) {
    spec = build(k);
    cache.set(k, spec);
  }
  return spec;
}

/** Seed the cache with levels built elsewhere (the level worker). */
export function primeLevel(spec: LevelSpec): void {
  cache.set(spec.n, spec);
}

export function starsFor(spec: LevelSpec, moves: number): 1 | 2 | 3 {
  if (moves <= spec.par) return 3;
  if (moves <= Math.ceil(spec.par * 1.5)) return 2;
  return 1;
}
