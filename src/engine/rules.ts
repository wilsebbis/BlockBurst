/**
 * The rules: start a run from its config, apply one move, report what happened. Pure functions over plain data,
 * so the same moves replay to the same score anywhere (RunLog.ts relies on this).
 *
 * Scoring:
 *  - placing a piece scores 1 point per cell;
 *  - a clear scores 10 x cells cleared x lines cleared x combo, where the combo counts clears in a row and
 *    survives two placements without a clear (it ends on the third);
 *  - emptying the whole board (a Perfect Clear) adds 300.
 */
import { anyFit, fullLines, masksOf, SIZE } from './board';
import { dealTray } from './generator';
import { levelFor } from './levels';
import { shapeById } from './pieces';
import { createRng } from './rng';
import type { GameState, Move, MoveEvents, RunConfig } from '../types/game';

export const COMBO_GRACE = 3;
export const PERFECT_POINTS = 300;

export function clearPoints(cells: number, lines: number, combo: number): number {
  return lines > 0 ? 10 * cells * lines * Math.max(1, combo) : 0;
}

/** The Daily Board's starting pattern: a mirror-symmetric sprinkle of blocks, seeded by the day alone. */
export function dailyLayout(seed: string): number[] {
  const rng = createRng(`burst/daily-layout/v1/${seed}`);
  const grid = new Array(SIZE * SIZE).fill(0);
  const pairs = rng.range(5, 8);
  for (let k = 0; k < pairs; k++) {
    const r = rng.range(2, 7);
    const c = rng.range(0, 3);
    const colour = rng.range(1, 7);
    grid[r * SIZE + c] = colour;
    grid[r * SIZE + (SIZE - 1 - c)] = colour;
  }
  // Never start with a full line.
  const m = masksOf(grid);
  for (const r of fullLines(m).rows) grid[r * SIZE] = 0;
  return grid;
}

function freshState(grid: number[], gems: number[], goal: GameState['goal']): GameState {
  return { grid, tray: [null, null, null], trayIndex: 0, score: 0, combo: 0, sinceClear: 0, maxCombo: 0, lines: 0, bestMulti: 0, perfects: 0, placed: 0, cells: 0, gems, gemsCollected: 0, goal, over: false, won: false };
}

/** Start a run from an explicit board (the level builder uses this to test candidate layouts). */
export function startState(cfg: RunConfig, grid: number[], gems: number[], goal: GameState['goal']): GameState {
  return deal(cfg, freshState(grid.slice(), gems.slice(), goal));
}

/** Start a run. Adventure configs carry the level's own seed (see `adventureConfig`). */
export function initialState(cfg: RunConfig): GameState {
  if (cfg.mode === 'adventure') {
    const lv = levelFor(cfg.level ?? 1);
    return startState(cfg, lv.grid, lv.gems, lv.goal);
  }
  if (cfg.mode === 'daily') return startState(cfg, dailyLayout(cfg.seed), [], null);
  return startState(cfg, new Array(SIZE * SIZE).fill(0), [], null);
}

export const adventureConfig = (level: number): RunConfig => ({ mode: 'adventure', seed: levelFor(level).seed, level });

function deal(cfg: RunConfig, s: GameState): GameState {
  const d = dealTray(cfg.seed, s.trayIndex, masksOf(s.grid), cfg.mode, shapeById, s.combo);
  const next = { ...s, tray: d.pieces, trayIndex: s.trayIndex + 1 };
  return checkOver(next);
}

function checkOver(s: GameState): GameState {
  if (s.over) return s;
  const m = masksOf(s.grid);
  const stuck = !s.tray.some((p) => p && anyFit(m, shapeById(p.shape)));
  return stuck ? { ...s, over: true } : s;
}

export function isLegal(s: GameState, mv: Move): boolean {
  if (s.over || mv.slot < 0 || mv.slot > 2) return false;
  const p = s.tray[mv.slot];
  if (!p) return false;
  const sh = shapeById(p.shape);
  if (mv.r < 0 || mv.c < 0 || mv.r + sh.h > SIZE || mv.c + sh.w > SIZE) return false;
  return sh.cells.every(([dr, dc]) => !s.grid[(mv.r + dr) * SIZE + mv.c + dc]);
}

/** Rows and columns a move would complete (for the drag preview), or null if it doesn't fit. */
export function previewLines(s: GameState, mv: Move): { rows: number[]; cols: number[] } | null {
  if (!isLegal(s, mv)) return null;
  const sh = shapeById(s.tray[mv.slot]!.shape);
  const m = masksOf(s.grid);
  for (let i = 0; i < sh.h; i++) m[mv.r + i] |= sh.rowMasks[i] << mv.c;
  return fullLines(m);
}

export function applyMove(cfg: RunConfig, s: GameState, mv: Move): { state: GameState; events: MoveEvents } {
  if (!isLegal(s, mv)) throw new Error(`illegal move ${mv.slot}@${mv.r},${mv.c}`);
  const piece = s.tray[mv.slot]!;
  const sh = shapeById(piece.shape);
  const grid = s.grid.slice();
  for (const [dr, dc] of sh.cells) grid[(mv.r + dr) * SIZE + mv.c + dc] = piece.colour;
  const { rows, cols } = fullLines(masksOf(grid));
  const lines = rows.length + cols.length;
  const clearedIdx = new Set<number>();
  for (const r of rows) for (let c = 0; c < SIZE; c++) clearedIdx.add(r * SIZE + c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) clearedIdx.add(r * SIZE + c);
  const gemSet = new Set(s.gems);
  const cleared = [...clearedIdx].sort((a, b) => a - b).map((i) => ({ i, colour: grid[i], gem: gemSet.has(i) }));
  for (const i of clearedIdx) grid[i] = 0;
  const gemsHit = cleared.filter((x) => x.gem).length;

  const combo = lines > 0 ? s.combo + 1 : s.sinceClear + 1 >= COMBO_GRACE ? 0 : s.combo;
  const sinceClear = lines > 0 ? 0 : s.sinceClear + 1;
  const placePoints = sh.size;
  const cp = clearPoints(cleared.length, lines, combo);
  const perfect = lines > 0 && grid.every((v) => v === 0);
  const perfectPoints = perfect ? PERFECT_POINTS : 0;
  const tray = s.tray.slice();
  tray[mv.slot] = null;

  let next: GameState = {
    ...s,
    grid,
    tray,
    score: s.score + placePoints + cp + perfectPoints,
    combo,
    sinceClear,
    maxCombo: Math.max(s.maxCombo, combo),
    lines: s.lines + lines,
    bestMulti: Math.max(s.bestMulti, lines),
    perfects: s.perfects + (perfect ? 1 : 0),
    placed: s.placed + 1,
    cells: s.cells + sh.size,
    gems: s.gems.filter((i) => !clearedIdx.has(i)),
    gemsCollected: s.gemsCollected + gemsHit,
  };
  if (next.goal) {
    const done = next.goal.kind === 'gems' ? next.gemsCollected >= next.goal.count : next.score >= next.goal.target;
    if (done) next = { ...next, over: true, won: true };
  }
  const dealt = !next.over && tray.every((p) => p === null);
  next = dealt ? deal(cfg, next) : checkOver(next);
  return { state: next, events: { placePoints, clearPoints: cp, perfectPoints, rows, cols, cleared, combo, perfect, gems: gemsHit, dealt } };
}

/** How many blocks a revive clears at least. */
export const REVIVE_BLOCKS = 3;

/**
 * The blocks a revive clears from a stuck board: the fewest blocks that make room for one of the tray's pieces
 * (avoiding gem blocks where it can), topped up to REVIVE_BLOCKS with other plain blocks picked by the seed.
 * Deterministic, so the same stuck board always offers the same blocks.
 */
export function reviveCells(cfg: RunConfig, s: GameState): number[] {
  const gems = new Set(s.gems);
  let best: number[] | null = null;
  let bestCost = Infinity;
  for (const piece of s.tray) {
    if (!piece) continue;
    const sh = shapeById(piece.shape);
    for (let r = 0; r + sh.h <= SIZE; r++) {
      for (let c = 0; c + sh.w <= SIZE; c++) {
        const under = sh.cells.map(([dr, dc]) => (r + dr) * SIZE + c + dc).filter((i) => s.grid[i]);
        // A gem block costs a lot more to clear: the player wants to free those with lines.
        const cost = under.length + under.filter((i) => gems.has(i)).length * 10;
        if (cost < bestCost) {
          bestCost = cost;
          best = under;
        }
      }
    }
  }
  const chosen = new Set(best ?? []);
  const rest = createRng(`${cfg.seed}/revive/${s.trayIndex}`).shuffle(
    s.grid.map((v, i) => (v && !chosen.has(i) && !gems.has(i) ? i : -1)).filter((i) => i >= 0),
  );
  for (const i of rest) {
    if (chosen.size >= REVIVE_BLOCKS) break;
    chosen.add(i);
  }
  return [...chosen].sort((a, b) => a - b);
}

/** A stuck game, revived: the chosen blocks are cleared (and any gems in them lost), and play goes on. */
export function applyRevive(s: GameState, cells: readonly number[]): GameState {
  const grid = s.grid.slice();
  for (const i of cells) grid[i] = 0;
  const cleared = new Set(cells);
  return checkOver({ ...s, grid, gems: s.gems.filter((i) => !cleared.has(i)), over: false, won: false });
}
